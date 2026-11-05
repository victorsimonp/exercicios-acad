import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  globalTeardown: './e2e/teardown.ts',
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:5173',
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
      command: 'pnpm --filter @ht/api dev',
      url: 'http://localhost:3333/api/v1/health',
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'pnpm dev',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
