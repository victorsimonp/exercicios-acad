import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const result = z
  .object({
    VITE_SUPABASE_URL: z.url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  })
  .safeParse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
  });
export const supabaseConfigError = result.success
  ? null
  : 'Configure SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no ambiente do frontend e faça um novo deploy ou reinicie o servidor local. Os nomes com prefixo VITE_ também são aceitos.';
export const supabase = result.success
  ? createClient(
      result.data.VITE_SUPABASE_URL,
      result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      },
    )
  : null;
export function getSupabase() {
  if (!supabase)
    throw new Error(supabaseConfigError ?? 'Supabase não configurado.');
  return supabase;
}
