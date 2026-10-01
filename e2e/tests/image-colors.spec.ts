import { test, expect } from "@playwright/test";

test("SVG and PNG source colors survive theme changes and zoom without washing out", async ({ page }) => {
  await page.goto("/e2e/image-colors.html");
  for (const theme of ["dark", "light", "dark"]) {
    await page.locator(`#${theme}`).click();
    await expect.poll(async () => page.evaluate(() => {
      const result = (window as any).imageColorFixture.sample();
      if (!result) return null;
      const equal = (a: number[][], b: number[][]) => a.every((p, i) => p.every((c, j) => Math.abs(c - b[i][j]) <= 1));
      return { theme: result.theme, filter: result.filter, svg: equal(result.svg, result.reference.pixels), png: equal(result.png, result.reference.pixels), shape: equal([result.shape], [result.reference.shape]) };
    })).toEqual({ theme, filter: "none", svg: true, png: true, shape: true });
    const exported = await page.evaluate(theme => (window as any).imageColorFixture.export(theme), theme);
    expect(exported.pixels).toEqual(exported.reference);
  }
  await page.evaluate(() => (window as any).imageColorFixture.zoom(1.5));
  await expect.poll(async () => page.evaluate(() => {
    const r = (window as any).imageColorFixture.sample();
    return r?.svg.every((p: number[], i: number) => p.every((c, j) => Math.abs(c - r.reference.pixels[i][j]) <= 1));
  })).toBe(true);
});
