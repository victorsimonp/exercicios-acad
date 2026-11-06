import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import type { VerifiedIdentity } from './identity.js';
import { createInitialProgram } from './seed.js';
export async function ensureProfile(identity: VerifiedIdentity) {
  const existing = await prisma.user.findUnique({
    where: { authUserId: identity.id },
    include: { _count: { select: { programs: true } } },
  });
  if (existing && existing._count.programs > 0) return existing;
  let profile = existing;
  if (!profile) {
    const rows = await prisma.$queryRaw<
      { id: string }[]
    >`SELECT app_private.claim_profile(${`c${randomUUID().replaceAll('-', '')}`},${identity.name}) AS id`;
    profile = await prisma.user.findUniqueOrThrow({
      where: { id: rows[0].id },
      include: { _count: { select: { programs: true } } },
    });
  }
  // Serialize initialization. A returning user keeps all imported programs.
  await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.id}))::text`;
  if (
    (await prisma.trainingProgram.count({ where: { userId: profile.id } })) ===
    0
  )
    await createInitialProgram(profile.id);
  return profile;
}
