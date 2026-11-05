import { seedCatalog } from './modules/seed.js';
import { prisma } from './db.js';
try {
  await seedCatalog();
  console.log(
    'Catálogo inicial: 32 exercícios, sem cargas fictícias. Programas são criados no cadastro.',
  );
} finally {
  await prisma.$disconnect();
}
