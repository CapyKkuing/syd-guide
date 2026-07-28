import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://localhost:4173";
const responsiveTest = /responsive\.spec\.ts/;

export default defineConfig({
  testDir: "./test/e2e",
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
      + " && npx wrangler d1 migrations apply couple-travel-guide-local"
      + " --local --persist-to .tmp/e2e-state --config wrangler.jsonc"
      + " && npx wrangler dev --local --ip 127.0.0.1 --port 4173"
      + " --persist-to .tmp/e2e-state"
      + " --config dist/couple_travel_guide_local/wrangler.json"
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
      testMatch: responsiveTest,
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2.75,
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
    }
  ]
});
