import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import pg from 'pg';
process.stdin.setRawMode?.(true);
let input = '';
await new Promise((resolve) =>
  process.stdin.on('data', (chunk) => {
    input += chunk;
    if (/[\r\n]/.test(input)) {
      process.stdin.pause();
      resolve();
    }
  }),
);
process.stdin.setRawMode?.(false);
const credentials = JSON.parse(input);
const ref = 'exvcchwfftfafaovkydj';
const candidates = [
  { host: `db.${ref}.supabase.co`, user: 'ht_runtime' },
  { host: 'aws-0-us-east-1.pooler.supabase.com', user: `ht_runtime.${ref}` },
  { host: 'aws-1-us-east-1.pooler.supabase.com', user: `ht_runtime.${ref}` },
];
let selected;
for (const candidate of candidates) {
  const client = new pg.Client({
    host: candidate.host,
    user: candidate.user,
    password: credentials.runtime,
    database: 'postgres',
    port: 5432,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync('../../certs/supabase-ca.crt', 'utf8'),
    },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query('SELECT 1');
    selected = candidate;
    break;
  } catch (error) {
    console.log(`Conexão ${candidate.host}: ${error.code ?? 'falhou'}`);
  } finally {
    await client.end().catch(() => {});
  }
}
const userFor = (role) =>
  selected?.host.startsWith('db.') ? role : `${role}.${ref}`;
const urlFor = (role) => {
  const url = new URL(
    `postgresql://${selected?.host ?? 'aws-1-us-east-1.pooler.supabase.com'}:5432/postgres`,
  );
  url.username = userFor(role);
  url.password = credentials[role === 'ht_runtime' ? 'runtime' : 'migrator'];
  url.searchParams.set('sslmode', 'verify-full');
  url.searchParams.set('sslrootcert', '../../certs/supabase-ca.crt');
  return url.toString();
};
// Preserve the original environment before selecting the cloud database.
if (!existsSync('.env.local-before-supabase'))
  writeFileSync('.env.local-before-supabase', readFileSync('.env'));
let content = readFileSync('.env', 'utf8');
for (const [name, value] of Object.entries({
  DATABASE_URL: urlFor('ht_runtime'),
  DIRECT_URL: urlFor('ht_migrator'),
})) {
  const pattern = new RegExp('^' + name + '=.*$', 'm');
  content = pattern.test(content)
    ? content.replace(pattern, `${name}=${value}`)
    : content.trimEnd() + `\n${name}=${value}\n`;
}
writeFileSync('.env.supabase', content);
console.log(
  selected
    ? 'Conexão Supabase validada; credenciais salvas em apps/api/.env.supabase, sem substituir o ambiente ativo.'
    : 'Credenciais salvas em .env.supabase; conectividade ainda precisa ser resolvida.',
);
if (!selected) process.exitCode = 1;
