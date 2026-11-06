import { database, asIdentity, closeDatabases } from './db.js';
try {
  await database.$queryRaw`SELECT 1`;
  const count = await asIdentity(
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'diagnostic@example.invalid',
      name: 'Diagnóstico',
    },
    (tx) => tx.exercise.count({ where: { userId: null } }),
  );
  console.log(
    `PostgreSQL acessível; contexto RLS ht_api validado; ${count} exercícios globais disponíveis.`,
  );
} finally {
  await closeDatabases();
}
