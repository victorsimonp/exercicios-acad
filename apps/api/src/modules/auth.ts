import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { createInitialProgram } from './seed.js';
const scrypt = promisify(scryptCallback);
export const fail = (statusCode: number, message: string): never => {
  throw Object.assign(new Error(message), { statusCode });
};
const digest = (token: string) =>
  createHash('sha256').update(token).digest('hex');
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}
export async function authenticate(request: FastifyRequest) {
  const token = request.cookies.ht_session;
  if (!token) return fail(401, 'Entre na sua conta para continuar.');
  const session = await prisma.authSession.findUnique({
    where: { id: digest(token) },
  });
  if (!session || session.expiresAt < new Date())
    return fail(401, 'Sessão expirada. Entre novamente.');
  request.userId = session.userId;
}
const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(10).max(128),
});
const safeUser = { id: true, name: true, email: true, settings: true } as const;
export async function authRoutes(app: FastifyInstance) {
  for (const action of ['register', 'login'] as const)
    app.post(
      `/auth/${action}`,
      {
        config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
        schema: {
          tags: ['Autenticação'],
          summary:
            action === 'register'
              ? 'Criar conta e programa inicial'
              : 'Entrar com email e senha',
          body: {
            type: 'object',
            required: ['email', 'password'],
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              password: { type: 'string' },
            },
          },
        },
      },
      async (req, reply) => {
        const input = credentials
          .extend({ name: z.string().trim().min(1).max(100).optional() })
          .parse(req.body);
        let user = await prisma.user.findUnique({
          where: { email: input.email },
        });
        if (action === 'register') {
          if (user) return fail(409, 'Email já cadastrado.');
          const salt = randomBytes(16).toString('hex');
          const hash = (await scrypt(input.password, salt, 64)) as Buffer;
          user = await prisma.user.create({
            data: {
              name: input.name ?? 'Atleta',
              email: input.email,
              passwordHash: `${salt}:${hash.toString('hex')}`,
            },
          });
          try {
            await createInitialProgram(user.id);
          } catch (error) {
            await prisma.user.delete({ where: { id: user.id } });
            throw error;
          }
          reply.code(201);
        } else {
          const [salt, expected] = (
            user?.passwordHash ?? 'invalid:' + '00'.repeat(64)
          ).split(':');
          const actual = (await scrypt(input.password, salt, 64)) as Buffer;
          if (!user || !timingSafeEqual(actual, Buffer.from(expected, 'hex')))
            return fail(401, 'Email ou senha inválidos.');
        }
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 30 * 86400000);
        await prisma.authSession.create({
          data: { id: digest(token), userId: user.id, expiresAt },
        });
        reply.setCookie('ht_session', token, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          expires: expiresAt,
        });
        return prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: safeUser,
        });
      },
    );
  app.post('/auth/logout', async (req, reply) => {
    if (req.cookies.ht_session)
      await prisma.authSession.deleteMany({
        where: { id: digest(req.cookies.ht_session) },
      });
    reply.clearCookie('ht_session', { path: '/' });
    return { ok: true };
  });
  app.get('/auth/me', { preHandler: authenticate }, (req) =>
    prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: safeUser,
    }),
  );
  app.patch('/auth/me', { preHandler: authenticate }, async (req) => {
    const data = z
      .object({
        name: z.string().trim().min(1).max(100).optional(),
        settings: z
          .object({
            theme: z.enum(['dark', 'light']).optional(),
            warmupSets: z.number().int().min(0).max(5).optional(),
            feederSets: z.number().int().min(0).max(3).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    return prisma.user.update({
      where: { id: req.userId },
      data,
      select: safeUser,
    });
  });
}
