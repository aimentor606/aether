import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:13737';
const apiURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup',
  globalTeardown: './e2e/global-teardown',
  timeout: 300_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // sequential — tests depend on prior state
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../test-results/html' }]],
  outputDir: '../test-results/artifacts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  metadata: {
    baseURL,
    apiURL,
  },
});
