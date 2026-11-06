import { beforeEach, expect, test, vi } from 'vitest';
const getUser = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser } }),
}));
import { verifyAccessToken } from './supabase.js';
beforeEach(() => getUser.mockReset());
test('valida o token com Supabase Auth e usa a identidade verificada, não user_metadata', async () => {
  getUser.mockResolvedValue({
    data: {
      user: {
        id: 'verified-identity',
        email: 'USER@example.com',
        email_confirmed_at: '2026-11-06T12:00:00Z',
        is_anonymous: false,
        user_metadata: { id: 'spoofed-owner', name: 'Nome visual' },
      },
    },
    error: null,
  });
  expect(await verifyAccessToken('access-token')).toEqual({
    id: 'verified-identity',
    email: 'user@example.com',
    name: 'Nome visual',
  });
  expect(getUser).toHaveBeenCalledWith('access-token');
});
test.each([
  { data: { user: null }, error: new Error('invalid') },
  {
    data: {
      user: { id: 'a', email: 'a@example.com', email_confirmed_at: null },
    },
    error: null,
  },
  {
    data: {
      user: {
        id: 'a',
        email: 'a@example.com',
        email_confirmed_at: '2026-11-06',
        is_anonymous: true,
      },
    },
    error: null,
  },
])(
  'rejeita token inválido, email não confirmado ou identidade anônima',
  async (response) => {
    getUser.mockResolvedValue(response);
    expect(await verifyAccessToken('token')).toBeNull();
  },
);
