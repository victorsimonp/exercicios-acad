import type { HealthResponse } from '@ht/shared';
const baseUrl = (
  import.meta.env.VITE_API_URL || 'http://localhost:3333'
).replace(/\/$/, '');
export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/api/v1/health`, { signal });
  if (!response.ok) throw new Error(`A API respondeu HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (
    !data ||
    typeof data !== 'object' ||
    !('status' in data) ||
    data.status !== 'ok'
  )
    throw new Error('Resposta inesperada da API');
  return { status: 'ok' };
}
