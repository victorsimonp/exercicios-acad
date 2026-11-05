import { expect, test } from 'vitest';
import { buildApp } from './app.js';
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
