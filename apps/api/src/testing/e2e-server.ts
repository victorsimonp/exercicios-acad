// Local-only identity provider simulation. No remote Supabase Auth accounts or
// emails are created. Production server.ts never imports this module.
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildApp } from '../app.js';
import { asMigration, closeDatabases } from '../db.js';
import { seedCatalog } from '../modules/seed.js';
import { env } from '../env.js';
import type { VerifiedIdentity } from '../modules/identity.js';
if (
  process.env.NODE_ENV !== 'test' ||
  !['localhost', '127.0.0.1'].includes(new URL(env.DATABASE_URL).hostname)
)
  throw new Error('Este servidor só pode rodar no banco local de teste.');
const identities = new Map<
  string,
  { identity: VerifiedIdentity; user: object }
>();
const provider = Fastify();
await provider.register(cors, {
  origin: 'http://localhost:5174',
  methods: ['GET', 'POST', 'OPTIONS'],
});
provider.post('/auth/v1/signup', async (req) => {
  const input = z
    .object({
      email: z.email(),
      password: z.string().min(10),
      data: z.object({ name: z.string().optional() }).optional(),
    })
    .parse(req.body);
  const identity = {
    id: randomUUID(),
    email: input.email,
    name: input.data?.name ?? 'Atleta E2E',
  };
  const user = {
    id: identity.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: identity.email,
    email_confirmed_at: new Date().toISOString(),
    confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: identity.name },
    identities: [],
  };
  const payload = {
    sub: identity.id,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    aud: 'authenticated',
    role: 'authenticated',
    session_id: randomUUID(),
  };
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.local-test-only`;
  identities.set(token, { identity, user });
  return {
    user,
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: payload.exp,
    refresh_token: randomUUID(),
  };
});
provider.get('/auth/v1/user', async (req, reply) => {
  const entry = identities.get(
    req.headers.authorization?.replace(/^Bearer /i, '') ?? '',
  );
  return (
    entry?.user ?? reply.code(401).send({ message: 'Token local inválido' })
  );
});
provider.post('/auth/v1/logout', async (req, reply) => {
  identities.delete(req.headers.authorization?.replace(/^Bearer /i, '') ?? '');
  return reply.code(204).send();
});
const app = buildApp('http://localhost:5174', false, {
  verifyToken: async (token) => identities.get(token)?.identity ?? null,
});
await asMigration(() => seedCatalog());
await provider.listen({ host: '127.0.0.1', port: 54321 });
await app.listen({ host: '127.0.0.1', port: 3334 });
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, async () => {
    await app.close();
    await provider.close();
    await closeDatabases();
    process.exit(0);
  });
