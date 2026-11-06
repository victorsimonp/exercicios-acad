import { seedCatalog } from './modules/seed.js';
import { asMigration, closeDatabases } from './db.js';
try {
  await asMigration(() => seedCatalog());
  console.log(
    'Catálogo inicial: 32 exercícios, sem cargas fictícias. Programas são criados no cadastro.',
  );
} finally {
  await closeDatabases();
}
