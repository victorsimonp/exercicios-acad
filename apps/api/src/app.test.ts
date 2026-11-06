import { expect, test } from 'vitest';
import { buildApp } from './app.js';
import { z } from 'zod';

test('erros de rota, JSON e validação são exibidos em português', async () => {
  const app = buildApp('http://localhost:5173');
  app.post('/validation-test', async (request) =>
    z.object({ count: z.number().min(1) }).parse(request.body),
  );
  try {
    const missing = await app.inject({ method: 'GET', url: '/missing' });
    expect(missing.json()).toEqual({ error: 'Endereço não encontrado.' });
    const malformed = await app.inject({
      method: 'POST',
      url: '/validation-test',
      headers: { 'content-type': 'application/json' },
      payload: '{',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.json()).toEqual({
      error: 'Requisição inválida. Confira os dados enviados.',
    });
    const invalid = await app.inject({
      method: 'POST',
      url: '/validation-test',
      payload: { count: 0 },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error).not.toMatch(/Too small|Invalid input/);
    expect(invalid.json().error).toContain('count:');
  } finally {
    await app.close();
  }
});
test('health e CORS para o frontend', async () => {
  const app = buildApp('http://localhost:5173');
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: { origin: 'http://localhost:5173' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/sessions/1/sets/1',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflight.headers['access-control-allow-methods']).toContain(
      'PATCH',
    );
    expect(
      (await app.inject({ method: 'GET', url: '/missing' })).statusCode,
    ).toBe(404);
  } finally {
    await app.close();
  }
});
