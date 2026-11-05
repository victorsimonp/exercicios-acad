import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { fail } from './auth.js';
import { exerciseSchema, idParams, pagination } from './schemas.js';
import { normalize } from './training.js';
import { z } from 'zod';
export async function exerciseRoutes(app: FastifyInstance) {
  app.get('/muscles', () => prisma.muscleGroup.findMany());
  app.post('/muscles', async (req, reply) => {
    const d = z
      .object({
        name: z.string().trim().min(2).max(80),
        region: z.string().max(80).default(''),
      })
      .parse(req.body);
    reply.code(201);
    return prisma.muscleGroup.create({
      data: { ...d, id: `custom-${crypto.randomUUID()}` },
    });
  });
  app.get('/exercises', async (req) => {
    const q = pagination.parse(req.query);
    const where = {
      isActive: true,
      OR: [{ userId: null }, { userId: req.userId }],
      normalizedName: { contains: normalize(q.search) },
      primaryMuscleGroupId: q.muscle,
    };
    const [items, total] = await Promise.all([
      prisma.exercise.findMany({
        where,
        include: {
          primaryMuscle: true,
          muscles: true,
          _count: {
            select: {
              prescriptions: {
                where: { workout: { program: { userId: req.userId } } },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
        take: q.pageSize,
        skip: (q.page - 1) * q.pageSize,
      }),
      prisma.exercise.count({ where }),
    ]);
    return { items, total, page: q.page, pageSize: q.pageSize };
  });
  app.get(
    '/exercises/:id',
    async (req) =>
      (await prisma.exercise.findFirst({
        where: {
          id: idParams.parse(req.params).id,
          OR: [{ userId: null }, { userId: req.userId }],
        },
        include: {
          primaryMuscle: true,
          muscles: { include: { muscleGroup: true } },
        },
      })) ?? fail(404, 'Exercício não encontrado.'),
  );
  app.post('/exercises', async (req, reply) => {
    const { secondaryMuscles, ...d } = exerciseSchema.parse(req.body);
    reply.code(201);
    return prisma.exercise.create({
      data: {
        ...d,
        userId: req.userId,
        normalizedName: normalize(d.name),
        muscles: {
          create: secondaryMuscles?.map((m) => ({ ...m, role: 'secondary' })),
        },
      },
    });
  });
  app.patch('/exercises/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    const e =
      (await prisma.exercise.findFirst({
        where: { id, userId: req.userId },
      })) ??
      fail(
        403,
        'Exercícios do catálogo são compartilhados. Crie uma cópia personalizada para editar.',
      );
    const { secondaryMuscles, ...d } = exerciseSchema.parse(req.body);
    return prisma.exercise.update({
      where: { id: e.id },
      data: {
        ...d,
        normalizedName: normalize(d.name),
        ...(secondaryMuscles
          ? {
              muscles: {
                deleteMany: {},
                create: secondaryMuscles.map((m) => ({
                  ...m,
                  role: 'secondary',
                })),
              },
            }
          : {}),
      },
    });
  });
  app.delete('/exercises/:id', async (req) => {
    const { id } = idParams.parse(req.params);
    if (
      !(await prisma.exercise.findFirst({ where: { id, userId: req.userId } }))
    )
      return fail(
        403,
        'Apenas exercícios personalizados podem ser desativados.',
      );
    return prisma.exercise.update({ where: { id }, data: { isActive: false } });
  });
}
