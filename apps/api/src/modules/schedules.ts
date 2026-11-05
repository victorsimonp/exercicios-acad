import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from './auth.js';
import { idParams } from './schemas.js';
import { ownedWorkout } from './programs.js';
export async function scheduleRoutes(app: FastifyInstance) {
  app.get('/schedules', async (req) => {
    const schedules = await prisma.workoutSchedule.findMany({
      where: { userId: req.userId },
      include: { workout: true },
      orderBy: { scheduledDate: 'asc' },
      take: 500,
    });
    return schedules.map((s) => ({
      ...s,
      status:
        s.status !== 'completed' &&
        s.status !== 'cancelled' &&
        !s.sessionId &&
        s.scheduledDate.getTime() + 86400000 < Date.now()
          ? 'missed'
          : s.status,
    }));
  });
  app.post('/schedules', async (req, reply) => {
    const d = z
      .object({
        workoutTemplateId: z.string(),
        scheduledDate: z.iso.datetime(),
        notes: z.string().max(1000).default(''),
      })
      .parse(req.body);
    await ownedWorkout(d.workoutTemplateId, req.userId);
    reply.code(201);
    return prisma.workoutSchedule.create({
      data: { ...d, userId: req.userId },
    });
  });
  app.patch('/schedules/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const d = z
      .object({
        scheduledDate: z.iso.datetime().optional(),
        status: z.enum(['cancelled', 'missed']).optional(),
        notes: z.string().max(1000).optional(),
      })
      .parse(req.body);
    const s =
      (await prisma.workoutSchedule.findFirst({
        where: { id, userId: req.userId },
      })) ?? fail(404, 'Agendamento não encontrado.');
    if (s.sessionId || s.status === 'completed')
      return fail(409, 'A sessão deste agendamento já foi iniciada.');
    return prisma.workoutSchedule.update({
      where: { id },
      data: {
        ...d,
        ...(d.scheduledDate
          ? {
              status: 'rescheduled',
              previousDates: [
                ...(Array.isArray(s.previousDates) ? s.previousDates : []),
                s.scheduledDate.toISOString(),
              ],
            }
          : {}),
      },
    });
  });
}
