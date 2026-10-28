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
    CREATE TABLE IF NOT EXISTS users (
      id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email         text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS companies (
      id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name       text NOT NULL,
      website    text,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;

    -- Each user sees only the companies they created. Names are unique per owner.
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;
    ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_name_key;
    CREATE UNIQUE INDEX IF NOT EXISTS companies_owner_name_key ON companies (owner_id, name);
    CREATE INDEX IF NOT EXISTS companies_owner_idx ON companies (owner_id);

    -- Users added as admins of a company by an existing admin. The owner_id stays the creator.
    CREATE TABLE IF NOT EXISTS company_admins (
        company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (company_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS company_admins_user_idx ON company_admins (user_id);

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
    -- Postal address put on every vCard of the company's employees.
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text;
    ALTER TABLE employees DROP COLUMN IF EXISTS department, DROP COLUMN IF EXISTS phone;
    -- JPEG profile photo, used for the pass thumbnail. Never sent in list responses; see has_photo.
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS photo bytea;
    -- LinkedIn profile URL, added to the vCard as a social profile.
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS linkedin text;
    -- Free-text location of the employee (for example an office), added to the vCard note.
    ALTER TABLE employees ADD COLUMN IF NOT EXISTS location text;
  `);
}

// A user may manage a company if they created it or were added as an admin. $N is the user id placeholder.
const canManage = (alias, param) =>
  `(${alias}.owner_id = ${param} OR ${alias}.id IN (SELECT company_id FROM company_admins WHERE user_id = ${param}))`;

// The token is the only credential for an employee's public card URL, so it
// must be unguessable. Rotating it revokes the old links.
export function newToken() {
  return randomBytes(24).toString('base64url');
}

// Everything except the icon bytes, which would bloat every JSON response.
const COMPANY_COLUMNS = 'id, name, website, address, created_at, (icon IS NOT NULL) AS has_icon';

// Everything except the photo bytes, which would bloat every JSON response.
const EMPLOYEE_COLUMN_NAMES = ['id', 'company_id', 'name', 'job_title', 'email', 'mobile', 'linkedin', 'location', 'token', 'created_at'];
const EMPLOYEE_COLUMNS = [...EMPLOYEE_COLUMN_NAMES, '(photo IS NOT NULL) AS has_photo'].join(', ');
const employeeColumnsOf = (alias) =>
  [...EMPLOYEE_COLUMN_NAMES.map((c) => `${alias}.${c}`), `(${alias}.photo IS NOT NULL) AS has_photo`].join(', ');

export function createRepository(pool) {
  return {
    async ping() {
      await pool.query('SELECT 1');
    },

    async createUser({ email, passwordHash }) {
      const { rows } = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email, passwordHash],
      );
      return rows[0];
    },

    async findUserByEmail(email) {
      const { rows } = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
      return rows[0] ?? null;
    },

    async getUser(id) {
      const { rows } = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [id]);
      return rows[0] ?? null;
    },

    async updateUserName(id, name) {
      const { rows } = await pool.query(
        'UPDATE users SET name = $2 WHERE id = $1 RETURNING id, email, name, created_at',
        [id, name],
      );
      return rows[0] ?? null;
    },

    async getUserPasswordHash(id) {
      const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [id]);
      return rows[0]?.password_hash ?? null;
    },

    async setUserPasswordHash(id, passwordHash) {
      await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash]);
    },

    async listCompanies(ownerId) {
      const { rows } = await pool.query(`
        SELECT c.id, c.name, c.website, c.created_at, (c.icon IS NOT NULL) AS has_icon,
               count(e.id)::int AS employee_count
        FROM companies c
        LEFT JOIN employees e ON e.company_id = c.id
        WHERE ${canManage('c', '$1')}
        GROUP BY c.id
        ORDER BY lower(c.name)`, [ownerId]);
      return rows;
    },

    async getCompany(id, ownerId) {
      const { rows } = await pool.query(
        `SELECT ${COMPANY_COLUMNS} FROM companies WHERE id = $1 AND ${canManage('companies', '$2')}`,
        [id, ownerId],
      );
      return rows[0] ?? null;
    },

    async getCompanyIcon(id) {
      const { rows } = await pool.query('SELECT icon FROM companies WHERE id = $1', [id]);
      return rows[0]?.icon ?? null;
    },

    async setCompanyIcon(id, icon) {
      await pool.query('UPDATE companies SET icon = $2 WHERE id = $1', [id, icon]);
    },

    async createCompany({ name, website, address }, ownerId) {
      const { rows } = await pool.query(
        `INSERT INTO companies (name, website, address, owner_id) VALUES ($1, $2, $3, $4) RETURNING ${COMPANY_COLUMNS}`,
        [name, website, address, ownerId],
      );
      return rows[0];
    },

    async updateCompany(id, { name, website, address }) {
      const { rows } = await pool.query(
        `UPDATE companies SET name = $2, website = $3, address = $4 WHERE id = $1 RETURNING ${COMPANY_COLUMNS}`,
        [id, name, website, address],
      );
      return rows[0] ?? null;
    },

    async deleteCompany(id) {
      await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    },

    // Admins of a company, with the creator flagged as owner.
    async listCompanyAdmins(companyId) {
      const { rows } = await pool.query(
        `SELECT u.id, u.email, u.name, (u.id = c.owner_id) AS is_owner
         FROM companies c
         JOIN users u ON u.id = c.owner_id OR u.id IN (SELECT user_id FROM company_admins WHERE company_id = c.id)
         WHERE c.id = $1
         ORDER BY is_owner DESC, lower(u.email)`,
        [companyId],
      );
      return rows;
    },

    // Returns false when the user is already an admin.
    async addCompanyAdmin(companyId, userId) {
      const { rowCount } = await pool.query(
        'INSERT INTO company_admins (company_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [companyId, userId],
      );
      return rowCount === 1;
    },

    async removeCompanyAdmin(companyId, userId) {
      const { rowCount } = await pool.query(
        'DELETE FROM company_admins WHERE company_id = $1 AND user_id = $2',
        [companyId, userId],
      );
      return rowCount === 1;
    },

    async listEmployees(companyId) {
      const { rows } = await pool.query(
        `SELECT ${EMPLOYEE_COLUMNS} FROM employees WHERE company_id = $1 ORDER BY lower(name)`,
        [companyId],
      );
      return rows;
    },

    // Returns the employee only if the user may manage its company.
    async getEmployee(id, ownerId) {
      const { rows } = await pool.query(
        `SELECT ${employeeColumnsOf('e')}
         FROM employees e JOIN companies c ON c.id = e.company_id
         WHERE e.id = $1 AND ${canManage('c', '$2')}`,
        [id, ownerId],
      );
      return rows[0] ?? null;
    },

    // Joins the company so a public request needs only one query.
    async getEmployeeByToken(token) {
      const { rows } = await pool.query(
        `SELECT e.*, json_build_object('id', c.id, 'name', c.name, 'website', c.website, 'address', c.address, 'has_icon', c.icon IS NOT NULL) AS company
         FROM employees e JOIN companies c ON c.id = e.company_id
         WHERE e.token = $1`,
        [token],
      );
      return rows[0] ?? null;
    },

    async createEmployee(companyId, fields) {
      const { rows } = await pool.query(
        `INSERT INTO employees
           (company_id, name, job_title, email, mobile, linkedin, location, token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${EMPLOYEE_COLUMNS}`,
        [
          companyId,
          fields.name,
          fields.job_title,
          fields.email,
          fields.mobile,
          fields.linkedin,
          fields.location,
          newToken(),
        ],
      );
      return rows[0];
    },

    async updateEmployee(id, fields) {
      const { rows } = await pool.query(
        `UPDATE employees SET
           name = $2, job_title = $3,
           email = $4, mobile = $5, linkedin = $6, location = $7
         WHERE id = $1
         RETURNING ${EMPLOYEE_COLUMNS}`,
        [
          id,
          fields.name,
          fields.job_title,
          fields.email,
          fields.mobile,
          fields.linkedin,
          fields.location,
        ],
      );
      return rows[0] ?? null;
    },

    async rotateEmployeeToken(id) {
      const { rows } = await pool.query(
        `UPDATE employees SET token = $2 WHERE id = $1 RETURNING ${EMPLOYEE_COLUMNS}`,
        [id, newToken()],
      );
      return rows[0] ?? null;
    },

    async getEmployeePhoto(id) {
      const { rows } = await pool.query('SELECT photo FROM employees WHERE id = $1', [id]);
      return rows[0]?.photo ?? null;
    },

    async setEmployeePhoto(id, photo) {
      await pool.query('UPDATE employees SET photo = $2 WHERE id = $1', [id, photo]);
    },

    async deleteEmployee(id) {
      await pool.query('DELETE FROM employees WHERE id = $1', [id]);
    },
  };
}
