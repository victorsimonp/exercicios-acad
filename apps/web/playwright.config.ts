import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  globalTeardown: './e2e/teardown.ts',
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command:
        'node --env-file=.env.test --import tsx src/testing/e2e-server.ts',
      cwd: fileURLToPath(new URL('../api/', import.meta.url)),
      url: 'http://localhost:3334/api/v1/health',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command:
        'pnpm exec vite --mode test --host 127.0.0.1 --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
