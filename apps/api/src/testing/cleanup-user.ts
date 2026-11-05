import type { Prisma } from '../generated/prisma/client.js';
// Kept outside application routes; used exclusively by automated tests.
export async function cleanupUser(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.workoutSchedule.deleteMany({ where: { userId } });
  await tx.exerciseChangeLog.deleteMany({ where: { userId } });
  await tx.progressionRecommendation.deleteMany({ where: { userId } });
  await tx.exerciseSet.deleteMany({
    where: { sessionExercise: { session: { userId } } },
  });
  await tx.sessionExercise.deleteMany({ where: { session: { userId } } });
  await tx.workoutSession.deleteMany({ where: { userId } });
  await tx.workoutExercise.deleteMany({
    where: { workout: { program: { userId } } },
  });
  await tx.workoutTemplate.deleteMany({ where: { program: { userId } } });
  await tx.programWeek.deleteMany({ where: { program: { userId } } });
  await tx.trainingProgram.deleteMany({ where: { userId } });
  await tx.exerciseMuscle.deleteMany({ where: { exercise: { userId } } });
  await tx.exercise.deleteMany({ where: { userId } });
  await tx.user.delete({ where: { id: userId } });
}
