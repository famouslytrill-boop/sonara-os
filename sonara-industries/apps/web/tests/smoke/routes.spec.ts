import { expect, test } from "@playwright/test";

const routes = ["/", "/music", "/tableops", "/civic", "/legal", "/legal/privacy", "/music/pricing"];

for (const route of routes) {
  test(`${route} loads`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("body")).toContainText(/SONARA|SoundOS|TableOS|AlertOS|Legal/);
  });
}
