const baseUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:3333'
).replace(/\/$/, '');
import { ConnectionError, withDeadline } from '../lib/deadline';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  try {
    return await withDeadline(
      (async () => {
        const { data: authData, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (!authData.session)
          throw new ApiError(401, 'Entre na sua conta para continuar.');
        const response = await fetch(`${baseUrl}/api/v1${path}`, {
          signal,
          method,
          headers: {
            Authorization: `Bearer ${authData.session.access_token}`,
            ...(body === undefined
              ? {}
              : { 'Content-Type': 'application/json' }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
        if (response.status === 204) return undefined as T;
        const data = await response.json().catch(() => {
          if (response.ok)
            throw new ApiError(
              502,
              'O servidor retornou uma resposta inválida.',
            );
          return {};
        });
        if (!response.ok)
          throw new ApiError(
            response.status,
            data.error ?? `Erro HTTP ${response.status}`,
          );
        return data as T;
      })(),
      options.timeoutMs,
    );
  } catch (error) {
    if (error instanceof ConnectionError) controller.abort();
    if (error instanceof TypeError && !signal.aborted)
      throw new ConnectionError('network');
    throw error;
  }
}
export function queryString(
  params: Record<string, string | number | undefined>,
) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== '') q.set(k, String(v));
  return q.size ? `?${q}` : '';
}
import { getSupabase } from '../lib/supabase';
