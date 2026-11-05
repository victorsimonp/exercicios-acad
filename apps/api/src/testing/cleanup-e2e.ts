import { prisma } from '../db.js';
import { cleanupUser } from './cleanup-user.js';
// Only the disposable accounts created by e2e/training.spec.ts match this namespace.
try {
  const users = await prisma.user.findMany({
    where: {
      name: 'Atleta E2E',
      email: { startsWith: 'e2e-', endsWith: '@example.invalid' },
    },
    select: { id: true, email: true },
  });
  for (const user of users) {
    if (!/^e2e-[0-9a-f-]{36}@example\.invalid$/.test(user.email)) continue;
    const userId = user.id;
    await prisma.$transaction((tx) => cleanupUser(tx, userId));
  }
  console.log(`${users.length} contas descartáveis E2E removidas.`);
} finally {
  await prisma.$disconnect();
}
