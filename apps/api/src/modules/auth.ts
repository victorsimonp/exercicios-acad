import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { prisma, asIdentity } from '../db.js';
import { fail } from './errors.js';
import { verifyAccessToken } from './supabase.js';
import type { VerifiedIdentity } from './identity.js';
import { ensureProfile } from './profile.js';
export { fail } from './errors.js';
declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    identity?: VerifiedIdentity;
  }
}
export async function authenticate(
  request: FastifyRequest,
  verifyToken = verifyAccessToken,
) {
  const match = request.headers.authorization?.match(/^Bearer ([^\s]+)$/i);
  if (!match) return fail(401, 'Entre na sua conta para continuar.');
  const identity = await verifyToken(match[1]);
  if (!identity)
    return fail(401, 'Sessão inválida ou expirada. Entre novamente.');
  request.identity = identity;
}
export function protectRoutes(
  app: FastifyInstance,
  verifyToken = verifyAccessToken,
) {
  app.addHook('preHandler', async (request) =>
    authenticate(request, verifyToken),
  );
  app.addHook('onRoute', (route) => {
    const handler = route.handler;
    route.handler = async function (request, reply) {
      const identity =
        request.identity ?? fail(401, 'Identidade não verificada.');
      reply.header('Cache-Control', 'private, no-store');
      return asIdentity(identity, async () => {
        const profile = await ensureProfile(identity);
        request.userId = profile.id;
        return handler.call(this, request, reply);
      });
    };
  });
}
const safeUser = {
  id: true,
  authUserId: true,
  name: true,
  email: true,
  settings: true,
} as const;
export async function authRoutes(app: FastifyInstance) {
  app.get('/auth/me', (req) =>
    prisma.user.findUniqueOrThrow({
      where: { id: req.userId },
      select: safeUser,
    }),
  );
  app.patch('/auth/me', async (req) => {
    const d = z
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
      data: d,
      select: safeUser,
    });
  });
}
