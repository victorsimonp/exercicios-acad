import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import type { Prisma } from '../generated/prisma/client.js';
import { fail } from './auth.js';
import { idParams, pagination, prescription, setSchema } from './schemas.js';
import { availableExercise, ownedWorkout } from './programs.js';
import { prescribedSets, progression } from './training.js';
export const sessionInclude = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      sets: { orderBy: { setNumber: 'asc' as const } },
      exercise: true,
    },
  },
  recommendations: true,
};
export async function ownedSession(id: string, userId: string) {
  return (
    (await prisma.workoutSession.findFirst({
      where: { id, userId },
      include: sessionInclude,
    })) ?? fail(404, 'Sessão não encontrada.')
  );
}
async function lock(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))::text`;
}
async function updateRecommendations(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
) {
  const s = await tx.workoutSession.findUniqueOrThrow({
    where: { id },
    include: sessionInclude,
  });
  await tx.progressionRecommendation.deleteMany({ where: { sessionId: id } });
  for (const e of s.exercises) {
    const suggestion = progression(e.sets, {
      sets: e.prescribedSetsSnapshot,
      min: e.minRepsSnapshot,
      max: e.maxRepsSnapshot,
      rirMin: e.targetRirMinSnapshot,
      rirMax: e.targetRirMaxSnapshot,
      increment: Number(e.exercise.increment),
      percent: Number(e.exercise.incrementPercent),
      deload: s.isDeloadSnapshot,
    });
    await tx.progressionRecommendation.upsert({
      where: {
        sessionId_exerciseId: { sessionId: id, exerciseId: e.exerciseId },
      },
      update: suggestion,
      create: {
        ...suggestion,
        userId,
        exerciseId: e.exerciseId,
        sessionId: id,
      },
    });
  }
}
export async function sessionRoutes(app: FastifyInstance) {
  app.post('/sessions', async (req, reply) => {
    const input = z
      .object({
        workoutTemplateId: z.string(),
        weekNumber: z.number().int().min(1).max(52),
        idempotencyKey: z.string().min(8).max(100),
        scheduleId: z.string().optional(),
      })
      .parse(req.body);
    const existing = await prisma.workoutSession.findUnique({
      where: {
        userId_idempotencyKey: {
          userId: req.userId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: sessionInclude,
    });
    if (existing) return existing;
    const w = await ownedWorkout(input.workoutTemplateId, req.userId);
    const p = await prisma.trainingProgram.findUniqueOrThrow({
      where: { id: w.programId },
      include: { weeks: true },
    });
    const week = p.weeks.find(
      (a) => a.weekNumber === input.weekNumber && a.focus === w.focus,
    );
    if (p.status !== 'active' || input.weekNumber > p.totalWeeks || !week)
      return fail(400, 'Semana e foco não correspondem ao programa ativo.');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
    });
    const settings = z
      .object({
        warmupSets: z.number().default(2),
        feederSets: z.number().default(1),
      })
      .parse(user.settings);
    try {
      const session = await prisma.$transaction(async (tx) => {
        if (input.scheduleId) {
          await lock(tx, input.scheduleId);
          const schedule = await tx.workoutSchedule.findFirst({
            where: {
              id: input.scheduleId,
              userId: req.userId,
              workoutTemplateId: w.id,
              sessionId: null,
              status: { in: ['scheduled', 'rescheduled', 'missed'] },
            },
          });
          if (!schedule) return fail(409, 'Agendamento indisponível.');
        }
        const created = await tx.workoutSession.create({
          data: {
            userId: req.userId,
            programId: p.id,
            programWeekId: week.id,
            workoutTemplateId: w.id,
            idempotencyKey: input.idempotencyKey,
            nameSnapshot: w.name,
            focusSnapshot: w.focus,
            weekNumberSnapshot: week.weekNumber,
            isDeloadSnapshot: week.isDeload,
            exercises: {
              create: await Promise.all(
                w.exercises.map(async (original, index) => {
                  const override = original.futureOverride
                    ? prescription.parse(original.futureOverride)
                    : null;
                  const e = override
                    ? {
                        ...original,
                        ...override,
                        exercise: await availableExercise(
                          override.exerciseId,
                          req.userId,
                        ),
                      }
                    : original;
                  const count = prescribedSets(e.targetSets, week);
                  const prep = [
                    ...Array.from(
                      { length: index === 0 ? settings.warmupSets : 0 },
                      () => ({ type: 'warmup', min: 15, max: 20 }),
                    ),
                    ...Array.from(
                      {
                        length:
                          e.exercise.movementType === 'compound'
                            ? settings.feederSets
                            : 0,
                      },
                      () => ({ type: 'feeder', min: 4, max: 6 }),
                    ),
                  ];
                  return {
                    exerciseId: e.exerciseId,
                    exerciseNameSnapshot: e.exercise.name,
                    muscleSnapshot: e.exercise.primaryMuscle.name,
                    muscleParticipationSnapshot: e.exercise.muscles.map(
                      (m) => ({
                        name: m.muscleGroup.name,
                        role: m.role,
                        emphasis: m.emphasis,
                      }),
                    ),
                    weightBasisSnapshot: e.exercise.weightBasis,
                    order: index,
                    prescribedSetsSnapshot: count,
                    minRepsSnapshot: e.minReps,
                    maxRepsSnapshot: e.maxReps,
                    targetRirMinSnapshot:
                      week.volumeRule === 'target' &&
                      week.rirMin === 1 &&
                      week.rirMax === 2
                        ? e.targetRirMin
                        : week.rirMin,
                    targetRirMaxSnapshot:
                      week.volumeRule === 'target' &&
                      week.rirMin === 1 &&
                      week.rirMax === 2
                        ? e.targetRirMax
                        : week.rirMax,
                    restSecondsSnapshot: e.restSeconds,
                    notes: e.notes,
                    sets: {
                      create: [
                        ...prep,
                        ...Array.from({ length: count }, () => ({
                          type: 'work',
                          min: e.minReps,
                          max: e.maxReps,
                        })),
                      ].map((set, i) => ({
                        setNumber: i + 1,
                        setType: set.type,
                        prescribedRepsMin: set.min,
                        prescribedRepsMax: set.max,
                        weightBasis: e.exercise.weightBasis,
                      })),
                    },
                  };
                }),
              ),
            },
          },
          include: sessionInclude,
        });
        if (input.scheduleId)
          await tx.workoutSchedule.update({
            where: { id: input.scheduleId },
            data: { sessionId: created.id },
          });
        return created;
      });
      reply.code(201);
      return session;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 'P2002'
      )
        return prisma.workoutSession.findUniqueOrThrow({
          where: {
            userId_idempotencyKey: {
              userId: req.userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: sessionInclude,
        });
      throw error;
    }
  });
  app.get('/sessions', async (req) => {
    const q = pagination.parse(req.query);
    const where = {
      userId: req.userId,
      programId: q.programId,
      weekNumberSnapshot: q.weekNumber,
      focusSnapshot: q.focus,
      status: q.status,
      startedAt: {
        gte: q.from ? new Date(q.from) : undefined,
        lte: q.to ? new Date(q.to) : undefined,
      },
      exercises:
        q.exerciseId || q.muscle
          ? { some: { exerciseId: q.exerciseId, muscleSnapshot: q.muscle } }
          : undefined,
    };
    const [items, total] = await Promise.all([
      prisma.workoutSession.findMany({
        where,
        include: sessionInclude,
        orderBy: { startedAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      prisma.workoutSession.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  });
  app.get('/sessions/:id', async (req) =>
    ownedSession(idParams.parse(req.params).id, req.userId),
  );
  app.patch('/sessions/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    const data = z
      .object({
        notes: z.string().max(4000).optional(),
        status: z.enum(['active', 'paused']).optional(),
        restEndsAt: z.iso.datetime().nullable().optional(),
      })
      .parse(req.body);
    return prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const s = await tx.workoutSession.findUniqueOrThrow({ where: { id } });
      if (s.status === 'completed' && data.status)
        return fail(409, 'Sessão já concluída.');
      return tx.workoutSession.update({
        where: { id },
        data,
        include: sessionInclude,
      });
    });
  });
  app.patch('/sessions/:id/sets/:setId', async (req) => {
    const { id, setId } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    const { revision, ...d } = setSchema.parse(req.body);
    return prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const before =
        (await tx.exerciseSet.findFirst({
          where: { id: setId, sessionExercise: { sessionId: id } },
        })) ?? fail(404, 'Série não encontrada.');
      if (before.revision !== revision)
        return fail(
          409,
          'A série mudou em outra aba. Atualize antes de salvar.',
        );
      const after = await tx.exerciseSet.update({
        where: { id: before.id },
        data: {
          ...d,
          revision: { increment: 1 },
          completedAt: d.completed ? (before.completedAt ?? new Date()) : null,
        },
      });
      await tx.exerciseChangeLog.create({
        data: {
          userId: req.userId,
          resourceId: before.id,
          changeScope: 'set-correction',
          before: JSON.parse(JSON.stringify(before)),
          after: JSON.parse(JSON.stringify(after)),
        },
      });
      const s = await tx.workoutSession.findUniqueOrThrow({ where: { id } });
      if (s.status === 'completed')
        await updateRecommendations(tx, id, req.userId);
      return after;
    });
  });
  app.post('/sessions/:id/sets', async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    const d = z
      .object({
        sessionExerciseId: z.string(),
        setType: z.enum(['warmup', 'feeder', 'work']),
      })
      .parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const s = await tx.workoutSession.findUniqueOrThrow({ where: { id } });
      if (s.status === 'completed') return fail(409, 'Sessão concluída.');
      const e =
        (await tx.sessionExercise.findFirst({
          where: { id: d.sessionExerciseId, sessionId: id },
          include: { sets: true },
        })) ?? fail(404, 'Exercício não encontrado.');
      if (d.setType === 'work')
        await tx.sessionExercise.update({
          where: { id: e.id },
          data: { prescribedSetsSnapshot: { increment: 1 } },
        });
      return tx.exerciseSet.create({
        data: {
          ...d,
          setNumber: Math.max(0, ...e.sets.map((s) => s.setNumber)) + 1,
          prescribedRepsMin:
            d.setType === 'warmup'
              ? 15
              : d.setType === 'feeder'
                ? 4
                : e.minRepsSnapshot,
          prescribedRepsMax:
            d.setType === 'warmup'
              ? 20
              : d.setType === 'feeder'
                ? 6
                : e.maxRepsSnapshot,
          weightBasis: e.weightBasisSnapshot,
        },
      });
    });
    reply.code(201);
    return result;
  });
  app.patch('/sessions/:id/exercises/:itemId', async (req) => {
    const { id, itemId } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    const d = prescription.parse(req.body);
    const exercise = await availableExercise(d.exerciseId, req.userId);
    return prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const s = await tx.workoutSession.findUniqueOrThrow({ where: { id } });
      if (s.status === 'completed') return fail(409, 'Sessão concluída.');
      const before =
        (await tx.sessionExercise.findFirst({
          where: { id: itemId, sessionId: id },
          include: { sets: true },
        })) ?? fail(404, 'Exercício não encontrado.');
      if (
        before.sets.some(
          (s) => s.weight !== null || s.actualReps !== null || s.completed,
        )
      )
        return fail(
          409,
          'Este exercício já tem registros. Edite os resultados ou altere apenas os treinos futuros.',
        );
      await tx.exerciseSet.deleteMany({
        where: { sessionExerciseId: before.id },
      });
      const after = await tx.sessionExercise.update({
        where: { id: before.id },
        data: {
          exerciseId: d.exerciseId,
          exerciseNameSnapshot: exercise.name,
          muscleSnapshot: exercise.primaryMuscle.name,
          muscleParticipationSnapshot: exercise.muscles.map((m) => ({
            name: m.muscleGroup.name,
            role: m.role,
            emphasis: m.emphasis,
          })),
          weightBasisSnapshot: exercise.weightBasis,
          prescribedSetsSnapshot: d.targetSets,
          minRepsSnapshot: d.minReps,
          maxRepsSnapshot: d.maxReps,
          targetRirMinSnapshot: d.targetRirMin,
          targetRirMaxSnapshot: d.targetRirMax,
          restSecondsSnapshot: d.restSeconds,
          notes: d.notes,
          sets: {
            create: Array.from({ length: d.targetSets }, (_, i) => ({
              setNumber: i + 1,
              setType: 'work',
              prescribedRepsMin: d.minReps,
              prescribedRepsMax: d.maxReps,
              weightBasis: exercise.weightBasis,
            })),
          },
        },
      });
      await tx.exerciseChangeLog.create({
        data: {
          userId: req.userId,
          resourceId: before.id,
          previousExerciseId: before.exerciseId,
          newExerciseId: d.exerciseId,
          changeScope: 'session',
          before: JSON.parse(JSON.stringify(before)),
          after: JSON.parse(JSON.stringify(after)),
        },
      });
      return after;
    });
  });
  app.post('/sessions/:id/complete', async (req) => {
    const { id } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    await prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const s = await tx.workoutSession.findUniqueOrThrow({
        where: { id },
        include: sessionInclude,
      });
      if (s.status === 'completed') return;
      if (
        !s.exercises.some((e) =>
          e.sets.some((a) => a.completed && a.setType === 'work'),
        )
      )
        return fail(400, 'Conclua ao menos uma série de trabalho.');
      await tx.workoutSession.update({
        where: { id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          restEndsAt: null,
        },
      });
      await tx.workoutSchedule.updateMany({
        where: { sessionId: id, userId: req.userId },
        data: { status: 'completed' },
      });
      await updateRecommendations(tx, id, req.userId);
    });
    return ownedSession(id, req.userId);
  });
  app.get('/audit/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    return prisma.exerciseChangeLog.findMany({
      where: { userId: req.userId, resourceId: id },
      orderBy: { changedAt: 'desc' },
      take: 100,
    });
  });
  app.post('/sessions/:id/exercises/:itemId/skip-warmup', async (req) => {
    const { id, itemId } = idParams.parse(req.params);
    await ownedSession(id, req.userId);
    await prisma.$transaction(async (tx) => {
      await lock(tx, id);
      const session = await tx.workoutSession.findUniqueOrThrow({
        where: { id },
      });
      if (session.status === 'completed') return fail(409, 'Sessão concluída.');
      const sets = await tx.exerciseSet.findMany({
        where: {
          sessionExerciseId: itemId,
          sessionExercise: { sessionId: id },
          setType: 'warmup',
          completed: false,
        },
      });
      for (const s of sets) {
        await tx.exerciseSet.update({
          where: { id: s.id },
          data: { skipped: true, revision: { increment: 1 } },
        });
        await tx.exerciseChangeLog.create({
          data: {
            userId: req.userId,
            resourceId: s.id,
            changeScope: 'skip-warmup',
            before: JSON.parse(JSON.stringify(s)),
            after: { skipped: true },
          },
        });
      }
    });
    return ownedSession(id, req.userId);
  });
}
