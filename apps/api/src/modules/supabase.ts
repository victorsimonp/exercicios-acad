import { createClient } from '@supabase/supabase-js';
import { env } from '../env.js';
// No secret/service-role key is needed to validate a user's access token.
const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});
export async function verifyAccessToken(token: string) {
  const { data, error } = await client.auth.getUser(token);
  if (
    error ||
    !data.user ||
    !data.user.email ||
    !data.user.email_confirmed_at ||
    data.user.is_anonymous
  )
    return null;
  return {
    id: data.user.id,
    email: data.user.email.toLowerCase(),
    name:
      typeof data.user.user_metadata?.name === 'string'
        ? data.user.user_metadata.name.slice(0, 100)
        : 'Atleta',
  };
}
