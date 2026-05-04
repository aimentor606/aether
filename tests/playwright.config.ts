import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:13737';
const apiURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
const isCI = !!process.env.CI;

const reporters: NonNullable<Parameters<typeof defineConfig>[0]>['reporter'] = [
  ['list'],
  ['html', { open: 'never', outputFolder: '../test-results/html' }],
];

if (isCI) {
  reporters.push(
    ['junit', { outputFile: '../test-results/junit.xml' }],
    ['blob'],
  );
}

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup',
  globalTeardown: './e2e/global-teardown',
  timeout: 300_000,
  expect: {
    timeout: 30_000,
  },
  fullyParallel: false,
  retries: isCI ? 2 : 1,
  workers: 1,
  reporter: reporters,
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
