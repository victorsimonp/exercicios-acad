import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
const result = z
  .object({
    VITE_SUPABASE_URL: z.url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  })
  .safeParse(import.meta.env);
export const supabaseConfigError = result.success
  ? null
  : 'Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY em apps/web/.env e reinicie o frontend.';
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
