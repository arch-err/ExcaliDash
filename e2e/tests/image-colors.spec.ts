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

// The previous color fix filtered each cached copy into the scene. This asserts
// the operation that caused the regression, without a machine-dependent FPS limit.
test("large dark scenes reuse themed caches without filtering redraws", async ({ page }) => {
  await page.goto("/e2e/image-colors.html");
  await expect.poll(() => page.evaluate(() => (window as any).imageColorFixture?.ready())).toBe(true);
  await page.evaluate(() => {
    const prototype = CanvasRenderingContext2D.prototype;
    const original = prototype.drawImage;
    const stats = { sceneCopies: 0, filteredSceneCopies: 0, filteredCacheCopies: 0 };
    (window as any).renderStats = stats;
    prototype.drawImage = function (...args: any[]) {
      if (this.canvas.matches("canvas.static")) {
        stats.sceneCopies++;
        if (this.filter !== "none") stats.filteredSceneCopies++;
      } else if (this.filter !== "none") stats.filteredCacheCopies++;
      return (original as any).apply(this, args);
    };
    (window as any).imageColorFixture.loadLarge(1000);
  });
  await expect.poll(() => page.evaluate(() => (window as any).renderStats.sceneCopies)).toBeGreaterThanOrEqual(1000);
  const creation = await page.evaluate(() => ({ ...(window as any).renderStats }));
  expect(creation.filteredCacheCopies).toBe(1000);
  expect(creation.filteredSceneCopies).toBe(0);
  for (const x of [55, 60, 65]) {
    const before = await page.evaluate(() => (window as any).renderStats.sceneCopies);
    await page.evaluate(x => (window as any).imageColorFixture.pan(x), x);
    await expect.poll(() => page.evaluate(() => (window as any).renderStats.sceneCopies)).toBeGreaterThanOrEqual(before + 1000);
  }
  const redraw = await page.evaluate(() => ({ ...(window as any).renderStats }));
  expect(redraw.filteredCacheCopies).toBe(creation.filteredCacheCopies);
  expect(redraw.filteredSceneCopies).toBe(0);
  await page.evaluate(() => (window as any).imageColorFixture.zoom(1.1));
  await expect.poll(() => page.evaluate(() => (window as any).renderStats.filteredCacheCopies)).toBeGreaterThan(creation.filteredCacheCopies);
  expect(await page.evaluate(() => (window as any).renderStats.filteredSceneCopies)).toBe(0);
});

test("mixed shapes and large caches preserve images through pan, zoom and theme changes", async ({ page }) => {
  await page.goto("/e2e/image-colors.html");
  await expect.poll(() => page.evaluate(() => (window as any).imageColorFixture?.ready())).toBe(true);
  await page.evaluate(() => (window as any).imageColorFixture.loadMixed());
  const assertColors = async (theme: string) => {
    await expect.poll(() => page.evaluate(() => {
      const r = (window as any).imageColorFixture.sample();
      return r && { theme: r.theme, images: JSON.stringify(r.svg) === JSON.stringify(r.reference.pixels) && JSON.stringify(r.png) === JSON.stringify(r.reference.pixels), shape: JSON.stringify(r.shape) === JSON.stringify(r.reference.shape), filter: r.filter };
    })).toEqual({ theme, images: true, shape: true, filter: "none" });
  };
  await assertColors("dark");
  await page.evaluate(() => (window as any).imageColorFixture.pan(65));
  await assertColors("dark");
  await page.evaluate(() => (window as any).imageColorFixture.zoom(1.1));
  await assertColors("dark");
  await page.locator("#light").click();
  await assertColors("light");
  await page.locator("#dark").click();
  await assertColors("dark");
});
