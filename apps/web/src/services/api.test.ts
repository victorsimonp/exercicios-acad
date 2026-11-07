import { afterEach, expect, test, vi } from 'vitest';
import { api, ApiError } from './api';
import { ConnectionError } from '../lib/deadline';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
test('interrompe uma leitura parada e permite repetir após o servidor voltar', async () => {
  vi.useFakeTimers();
  let signal: AbortSignal | undefined;
  const fetchMock = vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation((_url, options) => {
      signal = options?.signal as AbortSignal;
      return new Promise(() => {});
    });
  const request = api('/auth/me');
  const assertion = expect(request).rejects.toMatchObject({ kind: 'timeout' });
  await vi.advanceTimersByTimeAsync(60000);
  await assertion;
  expect(signal?.aborted).toBe(true);
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 'restored' })));
  await expect(api('/auth/me')).resolves.toEqual({ id: 'restored' });
});
test('falha de rede é diferente de erro HTTP e não vira sessão ausente', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(
    new TypeError('Failed to fetch'),
  );
  await expect(api('/auth/me')).rejects.toBeInstanceOf(ConnectionError);
});
test('gateway indisponível retornando HTML preserva a classificação de erro do servidor', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('<html>Unavailable</html>', { status: 503 }),
  );
  const request = api('/auth/me');
  await expect(request).rejects.toBeInstanceOf(ApiError);
  await expect(request).rejects.toMatchObject({ status: 503 });
});
