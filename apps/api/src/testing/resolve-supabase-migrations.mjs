import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const directory of readdirSync('prisma/migrations', {
  withFileTypes: true,
})
  .filter((d) => d.isDirectory())
  .sort((a, b) => a.name.localeCompare(b.name))) {
  const result = spawnSync(
    process.execPath,
    [
      '--env-file=.env.supabase',
      'node_modules/prisma/build/index.js',
      'migrate',
      'resolve',
      '--applied',
      directory.name,
    ],
    { encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0 && !result.stderr.includes('P3008')) {
    console.error(
      `Falha ao registrar ${directory.name}: ${result.stderr.replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[conexão omitida]')}`,
    );
    process.exit(1);
  }
  console.log(`Migration registrada: ${directory.name}`);
}
