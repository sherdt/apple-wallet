import { buildApp } from './app.js';
import { createPool, createRepository, migrate } from './db.js';
import { loadCertificates, loadIcons } from './pass.js';

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

export function readConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    publicOrigin: requireEnv(env, 'PUBLIC_ORIGIN').replace(/\/+$/, ''),
    passTypeIdentifier: requireEnv(env, 'PASS_TYPE_IDENTIFIER'),
    teamIdentifier: requireEnv(env, 'TEAM_IDENTIFIER'),
    adminUser: requireEnv(env, 'ADMIN_USER'),
    adminPassword: requireEnv(env, 'ADMIN_PASSWORD'),
    certDir: env.WALLET_CERT_DIR ?? '/certs',
  };
}

async function main() {
  const config = readConfig();
  const pool = createPool();
  await migrate(pool);

  const app = await buildApp({
    config,
    repo: createRepository(pool),
    certificates: await loadCertificates(config.certDir),
    icons: await loadIcons(),
  });

  const shutdown = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
