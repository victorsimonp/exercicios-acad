import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'dotenv';
import pg from 'pg';
const sourceEnv = parse(readFileSync('.env.local-before-supabase'));
const cloudEnv = parse(readFileSync('.env.supabase'));
if (
  !['localhost', '127.0.0.1'].includes(new URL(sourceEnv.DATABASE_URL).hostname)
)
  throw new Error('Origem precisa ser o banco local preservado.');
const source = new pg.Client({ connectionString: sourceEnv.DATABASE_URL });
const target = new pg.Client({
  connectionString: cloudEnv.DIRECT_URL,
  connectionTimeoutMillis: 10000,
});
const tables = [
  'MuscleGroup',
  'User',
  'Exercise',
  'ExerciseMuscle',
  'TrainingProgram',
  'ProgramWeek',
  'WorkoutTemplate',
  'WorkoutExercise',
  'WorkoutSession',
  'SessionExercise',
  'ExerciseSet',
  'WorkoutSchedule',
  'ProgressionRecommendation',
  'ExerciseChangeLog',
];
const canonical = (value) =>
  value instanceof Date
    ? value.toISOString()
    : Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])]),
          )
        : value;
const checksum = (rows) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(rows)))
    .digest('hex');
const select = (table) =>
  `SELECT * FROM public."${table}" ORDER BY ${table === 'ExerciseMuscle' ? '"exerciseId","muscleGroupId"' : 'id'}`;
const report = {};
try {
  await source.connect();
  await target.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await target.query('BEGIN');
  for (const table of tables) {
    const count = await target.query(
      `SELECT count(*)::int AS count FROM public."${table}"`,
    );
    if (count.rows[0].count !== 0)
      throw new Error(
        `Destino não está vazio: ${table}. Importação cancelada para não sobrescrever registros.`,
      );
  }
  for (const table of tables) {
    const { rows, fields } = await source.query(select(table));
    const jsonColumns = new Set(
      fields
        .filter((f) => f.dataTypeID === 114 || f.dataTypeID === 3802)
        .map((f) => f.name),
    );
    if (table === 'User')
      for (const row of rows) {
        row.passwordHash = null;
        row.authUserId = null;
      }
    for (const row of rows) {
      const columns = Object.keys(row);
      await target.query(
        `INSERT INTO public."${table}" (${columns.map((c) => `"${c}"`).join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')})`,
        columns.map((c) =>
          jsonColumns.has(c) && row[c] !== null
            ? JSON.stringify(row[c])
            : row[c],
        ),
      );
    }
    const imported = (await target.query(select(table))).rows;
    if (
      rows.length !== imported.length ||
      checksum(rows) !== checksum(imported)
    )
      throw new Error(`Verificação de integridade falhou em ${table}.`);
    report[table] = {
      source: rows.length,
      target: imported.length,
      sha256: checksum(rows),
    };
  }
  await target.query('COMMIT');
  await source.query('COMMIT');
  writeFileSync(
    '../../.backups/supabase-transfer-report.json',
    JSON.stringify(
      {
        project: 'exvcchwfftfafaovkydj',
        verifiedAt: new Date().toISOString(),
        excluded: ['AuthSession', 'User.passwordHash'],
        tables: report,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      migrated: true,
      counts: Object.fromEntries(
        Object.entries(report).map(([table, r]) => [table, r.target]),
      ),
      integrity:
        'Todas as contagens e checksums conferem; credenciais antigas não foram transferidas.',
    }),
  );
} catch (error) {
  await target.query('ROLLBACK').catch(() => {});
  await source.query('ROLLBACK').catch(() => {});
  console.error(`Importação interrompida: ${error.code ?? error.message}`);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
