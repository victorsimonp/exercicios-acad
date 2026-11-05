import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { HealthResponse } from '@ht/shared';
export function buildApp(origin: string, logger = false) {
  const app = Fastify({ logger });
  app.register(cors, { origin });
  app.get<{ Reply: HealthResponse }>('/api/v1/health', async () => ({ status: 'ok' }));
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const status = error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : 500;
    reply.code(status).send({ error: status >= 500 ? 'Erro interno do servidor' : 'Requisição inválida' });
  });
  return app;
}
