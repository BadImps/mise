import { defineConfig, devices } from '@playwright/test';

// One cheap smoke spec: the app boots offline, core flows work.
// Not a test suite — one spec, one worker, Chromium only.
export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  workers: 1,
  reporter: [['line']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node tools/serve.mjs',
    url: 'http://127.0.0.1:4173/index.html',
    reuseExistingServer: true,
    timeout: 10000,
  },
});
