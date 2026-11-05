import { prisma } from './db.js';
try {
  await prisma.$queryRaw`SELECT 1`;
  await prisma.setupCheck.count();
  console.log('PostgreSQL e migration acessíveis pelo Prisma.');
} finally { await prisma.$disconnect(); }
