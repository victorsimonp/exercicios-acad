import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('.', import.meta.url));
  const env = loadEnv(mode, envDir, [
    'API_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'VITE_',
  ]);
  // Only these public values are embedded in the browser bundle.
  // Keep the internal VITE_* names so existing local environments still work.
  const publicNames = ['API_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
  const define: Record<string, string> = {};
  for (const name of publicNames) {
    const value = env[name] ?? env[`VITE_${name}`];
    if (value !== undefined)
      define[`import.meta.env.VITE_${name}`] = JSON.stringify(value);
  }
  return {
    envDir,
    define,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
  };
});
