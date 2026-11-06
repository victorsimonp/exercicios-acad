import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
vi.mock('./lib/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'component-test-token' } },
        error: null,
      }),
    },
  }),
}));
import { cleanup } from '@testing-library/react';
afterEach(() => {
  cleanup();
  localStorage.clear();
});
