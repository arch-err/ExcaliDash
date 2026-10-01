import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import { patchExcalidraw, patches } from "./patch-excalidraw.mjs";

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "excalidraw-patch-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.18.1" }));
  for (const patch of patches) {
    const directory = path.join(root, "dist", patch.directory);
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "chunk.js"), patch.before);
  }
  return root;
}

test("patching is repeatable and retains source-map offsets", async (t) => {
  const root = await fixture(t);
  await patchExcalidraw(root);
  await patchExcalidraw(root);
  for (const patch of patches) {
    const source = await fs.readFile(path.join(root, "dist", patch.directory, "chunk.js"), "utf8");
    assert.equal(source, patch.after.padEnd(patch.before.length, " "));
  }
});

test("an Excalidraw upgrade requires patch review", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ version: "0.19.0" }));
  await assert.rejects(patchExcalidraw(root), /Review the SVG dark-mode patch/);
});

test("a changed production bundle fails before modifying development", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "dist/prod/chunk.js"), "changed upstream predicate");
  await assert.rejects(patchExcalidraw(root), /Expected one Excalidraw prod/);
  assert.equal(await fs.readFile(path.join(root, "dist/dev/chunk.js"), "utf8"), patches[0].before);
});

test("duplicate predicates are rejected", async (t) => {
  const root = await fixture(t);
  await fs.writeFile(path.join(root, "dist/dev/chunk.js"), patches[0].before.repeat(2));
  await assert.rejects(patchExcalidraw(root), /Ambiguous patch target/);
});

for (const patch of patches) {
  test(`${patch.directory} installed renderer compensates SVGs and rasters only when loaded in dark mode`, async () => {
    const directory = new URL(`../node_modules/@excalidraw/excalidraw/dist/${patch.directory}/`, import.meta.url);
    let source;
    for (const filename of (await fs.readdir(directory)).filter((name) => name.endsWith(".js"))) {
      const content = await fs.readFile(new URL(filename, directory), "utf8");
      if (content.includes(patch.after.padEnd(patch.before.length, " "))) source = content;
    }
    assert.ok(source, "The installed bundle must be patched before testing");
    const expression = patch.directory === "dev"
      ? source.match(/var shouldResetImageFilter = (\([\s\S]*?\n\});/)[1]
      : source.slice(source.indexOf("A1=") + 3, source.indexOf("A1=") + patch.after.length - 1);
    const initialized = (element) => element.type === "image" && Boolean(element.fileId);
    const pending = (element, config) => initialized(element) && !config.imageCache.has(element.fileId);
    const predicate = vm.runInNewContext(`(${expression})`, {
      THEME: { DARK: "dark" }, ke: { DARK: "dark" },
      isInitializedImageElement: initialized, At: initialized,
      isPendingImageElement: pending, O1: pending,
    });
    const element = { type: "image", fileId: "file" };
    for (const mimeType of ["image/svg+xml", "image/png", "image/jpeg"]) {
      const config = { imageCache: new Map([["file", { mimeType }]]) };
      assert.equal(predicate(element, config, { theme: "dark" }), true, mimeType);
      assert.equal(predicate(element, config, { theme: "light" }), false, mimeType);
    }
    assert.equal(predicate(element, { imageCache: new Map() }, { theme: "dark" }), false);
    assert.equal(predicate({ type: "rectangle" }, { imageCache: new Map() }, { theme: "dark" }), false);
  });
}
