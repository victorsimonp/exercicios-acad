import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { HealthResponse } from '@ht/shared';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { z } from 'zod';
z.config(z.locales.pt());
import { authRoutes, protectRoutes } from './modules/auth.js';
import { exerciseRoutes } from './modules/exercises.js';
import { programRoutes } from './modules/programs.js';
import { sessionRoutes } from './modules/sessions.js';
import { analyticsRoutes } from './modules/analytics.js';
import { documentRoutes } from './modules/docs.js';
import { scheduleRoutes } from './modules/schedules.js';
import type { verifyAccessToken } from './modules/supabase.js';
export function buildApp(
  origin: string,
  logger = false,
  options: { verifyToken?: typeof verifyAccessToken } = {},
) {
  const app = Fastify({ logger });
  // Zod validates every body in its handler. Do not let AJV coerce null numeric inputs to zero.
  app.setValidatorCompiler(() => (data) => ({ value: data }));
  app.register(cors, {
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.register(cookie);
  app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Muitas solicitações. Aguarde um pouco e tente novamente.',
    }),
  });
  app.addHook('onRequest', async (request, reply) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.origin &&
      request.headers.origin !== origin
    ) {
      return reply.code(403).send({ error: 'Origem não permitida.' });
    }
  });
  app.register(swagger, {
    openapi: {
      info: {
        title: 'Hypertrophy Tracker API',
        version: '1.0.0',
        description:
          'API autenticada por token Bearer validado pelo Supabase Auth. Consultas executadas com RLS por usuário. Cargas em kg, com base total/por lado/por halter. Exercícios e sessões são paginados.',
      },
      components: {
        securitySchemes: {
          supabaseAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
    transform: ({ schema, url }) => ({
      schema: {
        summary: `${url}`,
        ...schema,
        security: url.includes('/health') ? [] : [{ supabaseAuth: [] }],
      },
      url,
    }),
  });
  app.register(swaggerUi, { routePrefix: '/docs' });
  documentRoutes(app);
  app.register(
    async (protectedApp) => {
      protectRoutes(protectedApp, options.verifyToken);
      await authRoutes(protectedApp);
      await exerciseRoutes(protectedApp);
      await programRoutes(protectedApp);
      await sessionRoutes(protectedApp);
      await analyticsRoutes(protectedApp);
      await scheduleRoutes(protectedApp);
    },
    { prefix: '/api/v1' },
  );
  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({
    status: 'ok',
  }));
  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: 'Endereço não encontrado.' });
  });
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    if (error instanceof ZodError)
      return reply.code(400).send({
        error: error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      });
    if (typeof error === 'object' && error && 'code' in error) {
      if (error.code === 'P2002')
        return reply.code(409).send({ error: 'Registro duplicado.' });
      if (error.code === 'P2003')
        return reply
          .code(400)
          .send({ error: 'Referência inválida ou registro em uso.' });
      if (error.code === 'P2025')
        return reply.code(404).send({ error: 'Registro não encontrado.' });
    }
    const status =
      error instanceof Error &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    reply.code(status).send({
      error:
        status >= 500
          ? 'Erro interno do servidor'
          : status === 429
            ? 'Muitas solicitações. Aguarde um pouco e tente novamente.'
            : typeof error === 'object' &&
                error &&
                'code' in error &&
                typeof error.code === 'string' &&
                error.code.startsWith('FST_')
              ? 'Requisição inválida. Confira os dados enviados.'
              : error instanceof Error
                ? error.message
                : 'Requisição inválida',
    });
  });
  return app;
}
