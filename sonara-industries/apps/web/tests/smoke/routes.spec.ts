import { expect, test } from "@playwright/test";

const routes = ["/", "/trackfoundry", "/lineready", "/noticegrid", "/legal", "/legal/privacy", "/trackfoundry/pricing"];

for (const route of routes) {
  test(`${route} loads`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("body")).toContainText(/SONARA|TrackFoundry|LineReady|NoticeGrid|Legal/);
  });
}
