import { randomBytes } from 'node:crypto';
import pg from 'pg';

// PGHOST, PGDATABASE, PGUSER, PGPASSWORD and PGPORT are read by node-postgres
// from the environment. PGSSLMODE=require turns on TLS with certificate checks.
export function createPool(env = process.env) {
  const ssl = env.PGSSLMODE === 'require' ? { rejectUnauthorized: true } : undefined;
  return new pg.Pool({ ssl, max: 5 });
}

// Idempotent; the role owns the database, so it may create its own tables.
export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name       text NOT NULL UNIQUE,
      website    text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS employees (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name        text NOT NULL,
      job_title   text,
      email       text,
      mobile      text,
      token       text NOT NULL UNIQUE,
      created_at  timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS employees_company_idx ON employees (company_id);

    -- Merge first_name and last_name into name for databases created earlier.
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS name text;
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'employees' AND column_name = 'first_name') THEN
        UPDATE employees SET name = trim(first_name || ' ' || last_name) WHERE name IS NULL;
        ALTER TABLE employees DROP COLUMN first_name, DROP COLUMN last_name;
      END IF;
    END $$;
    ALTER TABLE employees ALTER COLUMN name SET NOT NULL;

    -- Columns removed from the UI. Dropped here so existing databases match the schema.
    ALTER TABLE companies DROP COLUMN IF EXISTS color;

    -- PNG fetched from the company website. Never sent to the browser; see has_icon.
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS icon bytea;
    ALTER TABLE employees DROP COLUMN IF EXISTS department, DROP COLUMN IF EXISTS phone;
  `);
}

// The token is the only credential for an employee's public card URL, so it
// must be unguessable. Rotating it revokes the old links.
export function newToken() {
  return randomBytes(24).toString('base64url');
}

// Everything except the icon bytes, which would bloat every JSON response.
const COMPANY_COLUMNS = 'id, name, website, created_at, (icon IS NOT NULL) AS has_icon';

export function createRepository(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1');
    },

    async listCompanies() {
      const { rows } = await pool.query(`
        SELECT c.id, c.name, c.website, c.created_at, (c.icon IS NOT NULL) AS has_icon,
               count(e.id)::int AS employee_count
        FROM companies c
        LEFT JOIN employees e ON e.company_id = c.id
        GROUP BY c.id
        ORDER BY lower(c.name)`);
      return rows;
    },

    async getCompany(id) {
      const { rows } = await pool.query(`SELECT ${COMPANY_COLUMNS} FROM companies WHERE id = $1`, [id]);
      return rows[0] ?? null;
    },

    async getCompanyIcon(id) {
      const { rows } = await pool.query('SELECT icon FROM companies WHERE id = $1', [id]);
      return rows[0]?.icon ?? null;
    },

    async setCompanyIcon(id, icon) {
      await pool.query('UPDATE companies SET icon = $2 WHERE id = $1', [id, icon]);
    },

    async createCompany({ name, website }) {
      const { rows } = await pool.query(
        `INSERT INTO companies (name, website) VALUES ($1, $2) RETURNING ${COMPANY_COLUMNS}`,
        [name, website],
      );
      return rows[0];
    },

    async updateCompany(id, { name, website }) {
      const { rows } = await pool.query(
        `UPDATE companies SET name = $2, website = $3 WHERE id = $1 RETURNING ${COMPANY_COLUMNS}`,
        [id, name, website],
      );
      return rows[0] ?? null;
    },

    async deleteCompany(id) {
      await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    },

    async listEmployees(companyId) {
      const { rows } = await pool.query(
        'SELECT * FROM employees WHERE company_id = $1 ORDER BY lower(name)',
        [companyId],
      );
      return rows;
    },

    async getEmployee(id) {
      const { rows } = await pool.query('SELECT * FROM employees WHERE id = $1', [id]);
      return rows[0] ?? null;
    },

    // Joins the company so a public request needs only one query.
    async getEmployeeByToken(token) {
      const { rows } = await pool.query(
        `SELECT e.*, json_build_object('id', c.id, 'name', c.name, 'website', c.website) AS company
         FROM employees e JOIN companies c ON c.id = e.company_id
         WHERE e.token = $1`,
        [token],
      );
      return rows[0] ?? null;
    },

    async createEmployee(companyId, fields) {
      const { rows } = await pool.query(
        `INSERT INTO employees
           (company_id, name, job_title, email, mobile, token)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          companyId,
          fields.name,
          fields.job_title,
          fields.email,
          fields.mobile,
          newToken(),
        ],
      );
      return rows[0];
    },

    async updateEmployee(id, fields) {
      const { rows } = await pool.query(
        `UPDATE employees SET
           name = $2, job_title = $3,
           email = $4, mobile = $5
         WHERE id = $1
         RETURNING *`,
        [
          id,
          fields.name,
          fields.job_title,
          fields.email,
          fields.mobile,
        ],
      );
      return rows[0] ?? null;
    },

    async rotateEmployeeToken(id) {
      const { rows } = await pool.query(
        'UPDATE employees SET token = $2 WHERE id = $1 RETURNING *',
        [id, newToken()],
      );
      return rows[0] ?? null;
    },

    async deleteEmployee(id) {
      await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    },
  };
}
