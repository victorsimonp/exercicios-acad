import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from './auth.js';
import { idParams } from './schemas.js';
import { sessionInclude } from './sessions.js';
import { volume } from './training.js';
export async function analyticsRoutes(app: FastifyInstance) {
  app.get('/progression/recommendations', (req) =>
    prisma.progressionRecommendation.findMany({
      where: { userId: req.userId },
      include: { exercise: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  );
  for (const action of ['accept', 'dismiss'])
    app.post(`/progression/recommendations/:id/${action}`, async (req) => {
      const { id } = idParams.parse(req.params);
      const d = z
        .object({ suggestedWeight: z.number().min(0).max(2000).optional() })
        .parse(req.body ?? {});
      const rec =
        (await prisma.progressionRecommendation.findFirst({
          where: { id, userId: req.userId },
        })) ?? fail(404, 'Sugestão não encontrada.');
      return prisma.progressionRecommendation.update({
        where: { id: rec.id },
        data: {
          status: action === 'accept' ? 'accepted' : 'dismissed',
          ...(d.suggestedWeight !== undefined
            ? { suggestedWeight: d.suggestedWeight }
            : {}),
        },
      });
    });
  for (const path of [
    '/analytics/dashboard',
    '/analytics/volume',
    '/analytics/progression',
    '/analytics/attendance',
    '/analytics/exercises/:id',
  ])
    app.get(path, async (req) => {
      const q = z
        .object({
          exerciseId: z.string().optional(),
          from: z.iso.datetime().optional(),
          to: z.iso.datetime().optional(),
        })
        .parse(req.query);
      const exerciseId = path.includes(':id')
        ? idParams.parse(req.params).id
        : q.exerciseId;
      const sessions = await prisma.workoutSession.findMany({
        where: {
          userId: req.userId,
          status: 'completed',
          startedAt: {
            gte: q.from ? new Date(q.from) : undefined,
            lte: q.to ? new Date(q.to) : undefined,
          },
        },
        include: sessionInclude,
        orderBy: { startedAt: 'asc' },
      });
      const sets = sessions.flatMap((s) => s.exercises.flatMap((e) => e.sets));
      const muscleVolume: Record<
        string,
        { direct: number; secondary: number }
      > = {};
      const points: {
        date: string;
        weight: number;
        weightBasis: string;
        reps: number;
        rir: number | null;
        volume: number;
        sessionId: string;
        exerciseId: string;
        name: string;
      }[] = [];
      const records: Record<
        string,
        {
          name: string;
          weight: number;
          basis: string;
          reps: number;
          date: string;
        }
      > = {};
      for (const s of sessions)
        for (const e of s.exercises) {
          const work = e.sets.filter(
            (a) => a.completed && a.setType === 'work',
          );
          const group = (muscleVolume[e.muscleSnapshot] ??= {
            direct: 0,
            secondary: 0,
          });
          group.direct += work.length;
          const secondary = z
            .array(
              z.object({
                name: z.string(),
                role: z.string(),
                emphasis: z.number(),
              }),
            )
            .parse(e.muscleParticipationSnapshot);
          for (const m of secondary.filter((m) => m.role === 'secondary'))
            (muscleVolume[m.name] ??= { direct: 0, secondary: 0 }).secondary +=
              work.length * m.emphasis;
          for (const basis of [...new Set(work.map((a) => a.weightBasis))]) {
            const comparable = work.filter((a) => a.weightBasis === basis);
            const best = comparable.reduce<(typeof work)[number] | null>(
              (best, set) =>
                !best || Number(set.weight) > Number(best.weight) ? set : best,
              null,
            );
            if (best) {
              const recordKey = `${e.exerciseId}:${best.weightBasis}`;
              if (
                !records[recordKey] ||
                Number(best.weight) > records[recordKey].weight
              )
                records[recordKey] = {
                  name: e.exerciseNameSnapshot,
                  weight: Number(best.weight),
                  basis: best.weightBasis,
                  reps: best.actualReps ?? 0,
                  date: s.startedAt.toISOString(),
                };
              if (exerciseId === e.exerciseId)
                points.push({
                  date: s.startedAt.toISOString(),
                  weight: Number(best.weight),
                  weightBasis: basis,
                  reps: best.actualReps ?? 0,
                  rir: best.rir,
                  volume: volume(comparable),
                  sessionId: s.id,
                  exerciseId: e.exerciseId,
                  name: e.exerciseNameSnapshot,
                });
            }
          }
        }
      // Calendar week in the user's configured product timezone (São Paulo).
      const local = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }),
      );
      const localKey = (date: Date) =>
        date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
      const monday = new Date(
        Date.UTC(
          local.getFullYear(),
          local.getMonth(),
          local.getDate() - ((local.getDay() + 6) % 7),
          3,
        ),
      );
      const weekly = sessions.filter((s) => s.startedAt >= monday);
      const dueSchedules = await prisma.workoutSchedule.findMany({
        where: {
          userId: req.userId,
          scheduledDate: { lte: new Date() },
          status: { not: 'cancelled' },
        },
      });
      return {
        completed: sessions.length,
        weeklyCompleted: weekly.length,
        weeklySets: weekly
          .flatMap((s) => s.exercises.flatMap((e) => e.sets))
          .filter((s) => s.completed && s.setType === 'work').length,
        totalSets: sets.filter((s) => s.completed && s.setType === 'work')
          .length,
        volume: volume(sets),
        averageMinutes: sessions.length
          ? Math.round(
              sessions.reduce(
                (a, s) =>
                  a +
                  ((s.completedAt?.getTime() ?? s.startedAt.getTime()) -
                    s.startedAt.getTime()) /
                    60000,
                0,
              ) / sessions.length,
            )
          : 0,
        muscleVolume,
        points,
        records: Object.values(records),
        attendance: sessions.map((s) => ({
          date: localKey(s.startedAt),
          focus: s.focusSnapshot,
          name: s.nameSnapshot,
          sessionId: s.id,
        })),
        bySession: sessions.map((s) => ({
          date: localKey(s.startedAt),
          focus: s.focusSnapshot,
          volume: volume(s.exercises.flatMap((e) => e.sets)),
        })),
        adherencePercent: dueSchedules.length
          ? Math.round(
              (dueSchedules.filter((s) => s.status === 'completed').length /
                dueSchedules.length) *
                100,
            )
          : null,
        secondaryNote:
          'Séries diretas: grupo principal da sessão. Participação secundária: estimativa ponderada configurada no exercício e copiada ao iniciar a sessão; não equivale a séries diretas integrais. Exercícios iniciais aguardam revisão desses metadados.',
      };
    });
}
