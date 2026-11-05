import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from './auth.js';
import { idParams, pagination, prescription } from './schemas.js';
import { initialWeeks } from './training.js';
import { createInitialProgram } from './seed.js';
import { Prisma } from '../generated/prisma/client.js';
export const workoutInclude = {
  exercises: {
    orderBy: { order: 'asc' as const },
    include: {
      exercise: {
        include: {
          primaryMuscle: true,
          muscles: { include: { muscleGroup: true } },
        },
      },
    },
  },
};
export const programInclude = {
  weeks: { orderBy: { weekNumber: 'asc' as const } },
  workouts: {
    orderBy: [{ focus: 'asc' as const }, { dayNumber: 'asc' as const }],
    include: workoutInclude,
  },
};
export async function ownedProgram(id: string, userId: string) {
  return (
    (await prisma.trainingProgram.findFirst({
      where: { id, userId },
      include: programInclude,
    })) ?? fail(404, 'Programa não encontrado.')
  );
}
export async function ownedWorkout(id: string, userId: string) {
  return (
    (await prisma.workoutTemplate.findFirst({
      where: { id, program: { userId } },
      include: workoutInclude,
    })) ?? fail(404, 'Treino não encontrado.')
  );
}
export async function availableExercise(id: string, userId: string) {
  return (
    (await prisma.exercise.findFirst({
      where: { id, isActive: true, OR: [{ userId: null }, { userId }] },
      include: {
        primaryMuscle: true,
        muscles: { include: { muscleGroup: true } },
      },
    })) ?? fail(404, 'Exercício não encontrado.')
  );
}
export async function programRoutes(app: FastifyInstance) {
  app.get('/programs', async (req) =>
    prisma.trainingProgram.findMany({
      where: { userId: req.userId },
      include: programInclude,
      orderBy: { createdAt: 'desc' },
    }),
  );
  app.get('/programs/:id', async (req) =>
    ownedProgram(idParams.parse(req.params).id, req.userId),
  );
  app.post('/programs', async (req, reply) => {
    reply.code(201);
    return createInitialProgram(req.userId);
  });
  app.patch('/programs/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    await ownedProgram(id, req.userId);
    const data = z
      .object({
        name: z.string().min(1).max(150).optional(),
        description: z.string().max(2000).optional(),
        startDate: z.iso.datetime().optional(),
      })
      .parse(req.body);
    return prisma.trainingProgram.update({ where: { id }, data });
  });
  app.post('/programs/:id/archive', async (req) => {
    const p = await ownedProgram(idParams.parse(req.params).id, req.userId);
    return prisma.trainingProgram.update({
      where: { id: p.id },
      data: { status: 'archived' },
    });
  });
  for (const action of ['duplicate', 'restart'])
    app.post(`/programs/:id/${action}`, async (req, reply) => {
      const p = await ownedProgram(idParams.parse(req.params).id, req.userId);
      const result = await prisma.$transaction(async (tx) => {
        if (action === 'restart')
          await tx.trainingProgram.update({
            where: { id: p.id },
            data: { status: 'archived' },
          });
        return tx.trainingProgram.create({
          data: {
            userId: req.userId,
            name: `${p.name} • novo ciclo`,
            description: p.description,
            totalWeeks: p.totalWeeks,
            startDate: new Date(),
            weeks: {
              create: p.weeks
                .filter((w) => w.weekNumber <= p.totalWeeks)
                .map((w) => ({
                  weekNumber: w.weekNumber,
                  focus: w.focus,
                  isDeload: w.isDeload,
                  rirMin: w.rirMin,
                  rirMax: w.rirMax,
                  volumeRule: w.volumeRule,
                  setsOverride: w.setsOverride,
                })),
            },
            workouts: {
              create: p.workouts.map((w) => ({
                name: w.name,
                description: w.description,
                focus: w.focus,
                dayNumber: w.dayNumber,
                exercises: {
                  create: w.exercises.map((e) => ({
                    exerciseId: e.exerciseId,
                    order: e.order,
                    targetSets: e.targetSets,
                    minReps: e.minReps,
                    maxReps: e.maxReps,
                    targetRirMin: e.targetRirMin,
                    targetRirMax: e.targetRirMax,
                    restSeconds: e.restSeconds,
                    restMaxSeconds: e.restMaxSeconds,
                    notes: e.notes,
                    ...(e.futureOverride
                      ? {
                          futureOverride:
                            e.futureOverride as Prisma.InputJsonValue,
                        }
                      : {}),
                  })),
                },
              })),
            },
          },
        });
      });
      reply.code(201);
      return result;
    });
  app.get('/periodization/:programId', async (req) => {
    const { programId } = z.object({ programId: z.string() }).parse(req.params);
    return (await ownedProgram(programId, req.userId)).weeks;
  });
  app.get('/periodization/:programId/current', async (req) => {
    const { programId } = z.object({ programId: z.string() }).parse(req.params);
    const p = await ownedProgram(programId, req.userId);
    const weekNumber = Math.max(
      1,
      Math.min(
        p.totalWeeks,
        Math.floor((Date.now() - p.startDate.getTime()) / 604800000) + 1,
      ),
    );
    return p.weeks.find((w) => w.weekNumber === weekNumber);
  });
  app.patch('/periodization/:programId', async (req) => {
    const { programId } = z.object({ programId: z.string() }).parse(req.params);
    await ownedProgram(programId, req.userId);
    const weekSchema = z
      .object({
        weekNumber: z.number().int().min(1).max(52),
        focus: z.enum(['A', 'B']),
        isDeload: z.boolean(),
        rirMin: z.number().int().min(0).max(10),
        rirMax: z.number().int().min(0).max(10),
        volumeRule: z.enum(['target', 'fixed', 'deload']),
        setsOverride: z.number().int().min(1).max(20).nullable(),
      })
      .refine(
        (w) =>
          w.rirMin <= w.rirMax &&
          (w.volumeRule === 'target' || w.setsOverride !== null),
        'Revise RIR e séries.',
      );
    const data = z
      .object({
        totalWeeks: z.number().int().min(1).max(52),
        weeks: z.array(weekSchema).min(1).max(52).optional(),
      })
      .parse(req.body);
    const weeks = data.weeks ?? initialWeeks(data.totalWeeks);
    if (
      weeks.length !== data.totalWeeks ||
      new Set(weeks.map((w) => w.weekNumber)).size !== data.totalWeeks ||
      weeks.some((w) => w.weekNumber > data.totalWeeks)
    )
      return fail(400, 'Informe cada semana uma única vez.');
    return prisma.$transaction(async (tx) => {
      // Retain old week rows referenced by historical sessions; hide them via totalWeeks in UI.
      for (const w of weeks)
        await tx.programWeek.upsert({
          where: {
            programId_weekNumber: { programId, weekNumber: w.weekNumber },
          },
          create: { ...w, programId },
          update: w,
        });
      return tx.trainingProgram.update({
        where: { id: programId },
        data: { totalWeeks: data.totalWeeks },
        include: programInclude,
      });
    });
  });
  app.get('/workouts', async (req) => {
    const q = pagination.parse(req.query);
    return prisma.workoutTemplate.findMany({
      where: {
        program: { userId: req.userId, status: 'active' },
        focus: q.focus,
      },
      include: workoutInclude,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      orderBy: [{ focus: 'asc' }, { dayNumber: 'asc' }],
    });
  });
  app.get('/workouts/:id', async (req) =>
    ownedWorkout(idParams.parse(req.params).id, req.userId),
  );
  app.post('/workouts', async (req, reply) => {
    const d = z
      .object({
        programId: z.string(),
        name: z.string().min(1).max(150),
        focus: z.enum(['A', 'B']),
        dayNumber: z.number().int().min(1).max(7),
        description: z.string().max(2000).default(''),
      })
      .parse(req.body);
    await ownedProgram(d.programId, req.userId);
    reply.code(201);
    return prisma.workoutTemplate.create({ data: d, include: workoutInclude });
  });
  app.patch('/workouts/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    await ownedWorkout(id, req.userId);
    return prisma.workoutTemplate.update({
      where: { id },
      data: z
        .object({
          name: z.string().min(1).max(150),
          description: z.string().max(2000).optional(),
        })
        .parse(req.body),
    });
  });
  app.patch('/workouts/:id/reorder', async (req) => {
    const w = await ownedWorkout(idParams.parse(req.params).id, req.userId);
    const { ids } = z
      .object({ ids: z.array(z.string()).max(100) })
      .parse(req.body);
    if (
      ids.length !== w.exercises.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !w.exercises.some((e) => e.id === id))
    )
      return fail(400, 'Ordem inválida.');
    await prisma.$transaction(
      ids.map((id, order) =>
        prisma.workoutExercise.update({ where: { id }, data: { order } }),
      ),
    );
    return ownedWorkout(w.id, req.userId);
  });
  app.post('/workouts/:id/exercises', async (req, reply) => {
    const w = await ownedWorkout(idParams.parse(req.params).id, req.userId);
    const d = prescription.parse(req.body);
    await availableExercise(d.exerciseId, req.userId);
    reply.code(201);
    return prisma.workoutExercise.create({
      data: {
        ...d,
        workoutTemplateId: w.id,
        order: Math.max(-1, ...w.exercises.map((e) => e.order)) + 1,
      },
    });
  });
  app.patch('/workouts/:id/exercises/:itemId', async (req) => {
    const { id, itemId } = idParams.parse(req.params);
    const w = await ownedWorkout(id, req.userId);
    const before =
      w.exercises.find((e) => e.id === itemId) ??
      fail(404, 'Item não encontrado.');
    const { scope, ...raw } = z
      .object({ scope: z.enum(['future', 'template']).default('template') })
      .passthrough()
      .parse(req.body);
    const d = prescription.parse(raw);
    await availableExercise(d.exerciseId, req.userId);
    return prisma.$transaction(async (tx) => {
      const result = await tx.workoutExercise.update({
        where: { id: before.id },
        data:
          scope === 'future'
            ? { futureOverride: d }
            : { ...d, futureOverride: Prisma.DbNull },
      });
      await tx.exerciseChangeLog.create({
        data: {
          userId: req.userId,
          programId: w.programId,
          workoutTemplateId: w.id,
          resourceId: before.id,
          previousExerciseId: before.exerciseId,
          newExerciseId: d.exerciseId,
          changeScope: scope,
          before: JSON.parse(JSON.stringify(before)),
          after: d,
        },
      });
      return result;
    });
  });
  app.delete('/workouts/:id/exercises/:itemId', async (req) => {
    const { id, itemId } = idParams.parse(req.params);
    const w = await ownedWorkout(id, req.userId);
    const before =
      w.exercises.find((e) => e.id === itemId) ??
      fail(404, 'Item não encontrado.');
    await prisma.$transaction(async (tx) => {
      await tx.exerciseChangeLog.create({
        data: {
          userId: req.userId,
          resourceId: before.id,
          workoutTemplateId: id,
          changeScope: 'remove-template',
          before: JSON.parse(JSON.stringify(before)),
          after: {},
        },
      });
      await tx.workoutExercise.delete({ where: { id: before.id } });
    });
    return { ok: true };
  });
}
