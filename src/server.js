import { buildApp } from './app.js';
import { backfillIconFlags, createPool, createRepository, migrate } from './db.js';
import { isLightArtwork } from './icon.js';
import { loadCertificates, loadIcons } from './pass.js';

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

// HS256 needs a long random key; a short one would make forged tokens cheap to brute-force.
function requireJwtSecret(env) {
  const secret = requireEnv(env, 'JWT_SECRET');
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  return secret;
}

export function readConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 3000),
    publicOrigin: requireEnv(env, 'PUBLIC_ORIGIN').replace(/\/+$/, ''),
    passTypeIdentifier: requireEnv(env, 'PASS_TYPE_IDENTIFIER'),
    teamIdentifier: requireEnv(env, 'TEAM_IDENTIFIER'),
    jwtSecret: requireJwtSecret(env),
    certDir: env.WALLET_CERT_DIR ?? '/certs',
  };
}

async function main() {
  const config = readConfig();
  const pool = createPool();
  await migrate(pool);
  await backfillIconFlags(pool, isLightArtwork);

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
