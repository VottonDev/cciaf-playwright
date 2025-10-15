import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from 'dotenv';
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use - Monocart for enhanced reporting */
  reporter: [
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never'
    }],
    ['monocart-reporter', {
      name: 'CCIAF Playwright Test Report',
      outputFile: './test-results/monocart-report.html',
      coverage: {
        entryFilter: (entry) => true,
        sourceFilter: (sourcePath) => sourcePath.search(/node_modules/) === -1,
      },
      trend: './test-results/trend',
    }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { 
      name: 'setup-salesforce', 
      testMatch: /auth\.setup\.ts/ 
    },
    { 
      name: 'setup-frontend', 
      testMatch: /frontendauth\.setup\.ts/ 
    },

    {
      name: 'devscripts',
      testMatch: /.*\.devscript\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    {
      name: 'chromium-backend',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/salesforce.json',
      },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-salesforce'],
    },

    {
      name: 'firefox-backend',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/salesforce.json',
      },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-salesforce'],
    },

    {
      name: 'webkit-backend',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/salesforce.json',
      },
      testMatch: /.*\.spec\.ts/,
      testIgnore: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-salesforce'],
    },

    {
      name: 'chromium-frontend',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/govuk-frontend.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },

    {
      name: 'firefox-frontend',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/govuk-frontend.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },

    {
      name: 'webkit-frontend',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/govuk-frontend.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },

    {
      name: 'chromium-frontend-pr',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/govuk-pr.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },

    {
      name: 'firefox-frontend-pr',
      use: { 
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/govuk-pr.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },

    {
      name: 'webkit-frontend-pr',
      use: { 
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/govuk-pr.json',
      },
      testMatch: /.*frontend.*\.spec\.ts/,
      dependencies: ['setup-frontend'],
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});