import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173";
const responsiveTest = /responsive\.spec\.ts/;
const androidOnlineTest = /android-online\.spec\.ts/;
const e2eStatePath = process.env.E2E_STATE_PATH ?? `.tmp/e2e-state-${Date.now()}`;

process.env.E2E_STATE_PATH = e2eStatePath;

export default defineConfig({
  testDir: "./test/e2e",
  globalSetup: "./test/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  outputDir: ".tmp/playwright-results",
  reporter: [
    ["line"],
    ["html", { open: "never", outputFolder: ".tmp/playwright-report" }]
  ],
  use: {
    baseURL,
    serviceWorkers: "allow",
    screenshot: "only-on-failure",
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run build"
      + " && npx wrangler d1 migrations apply couple-travel-guide"
      + ` --local --persist-to ${e2eStatePath} --config wrangler.jsonc`
      + " && npx wrangler dev --local --ip 127.0.0.1 --port 4173"
      + ` --persist-to ${e2eStatePath}`
      + " --config dist/couple_travel_guide/wrangler.json"
      + " --var SURFACE:partner"
      + " --var APP_ORIGIN:http://localhost:4173"
      + " --var PARTNER_ORIGIN:http://localhost:4173"
      + " --var DEV_AUTH:enabled",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe"
  },
  projects: [
    {
      name: "desktop-chromium",
      testMatch: /.*\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: "android-chromium",
      testMatch: [responsiveTest, androidOnlineTest],
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.75,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "compact-chromium-320",
      testMatch: responsiveTest,
      use: {
        browserName: "chromium",
        viewport: { width: 320, height: 720 },
        deviceScaleFactor: 2,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "iphone-webkit",
      testMatch: responsiveTest,
      use: {
        browserName: "webkit",
        viewport: { width: 393, height: 852 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    },
    {
      name: "wide-mobile-webkit-430",
      testMatch: responsiveTest,
      use: {
        browserName: "webkit",
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        hasTouch: true,
        isMobile: true
      }
    }
  ]
});
