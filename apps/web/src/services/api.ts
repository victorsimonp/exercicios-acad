const baseUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:3333'
).replace(/\/$/, '');
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
): Promise<T> {
  const { data: authData, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  if (!authData.session)
    throw new ApiError(401, 'Entre na sua conta para continuar.');
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authData.session.access_token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      response.status,
      data.error ?? `Erro HTTP ${response.status}`,
    );
  return data as T;
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
