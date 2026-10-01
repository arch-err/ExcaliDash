import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.join(frontendRoot, "node_modules/@excalidraw/excalidraw");

// Excalidraw excludes SVGs from its raster-image dark-mode compensation.
// Patch both shipped bundles so development, exports, and Docker builds agree.
export const patches = [
  {
    directory: "dev",
    before: "return appState.theme === THEME.DARK && isInitializedImageElement(element) && !isPendingImageElement(element, renderConfig) && renderConfig.imageCache.get(element.fileId)?.mimeType !== MIME_TYPES.svg;",
    after: "return appState.theme === THEME.DARK && isInitializedImageElement(element) && !isPendingImageElement(element, renderConfig);",
  },
  {
    directory: "prod",
    before: "A1=(e,t,n)=>n.theme===ke.DARK&&At(e)&&!O1(e,t)&&t.imageCache.get(e.fileId)?.mimeType!==H.svg,",
    after: "A1=(e,t,n)=>n.theme===ke.DARK&&At(e)&&!O1(e,t),",
  },
];

export async function patchExcalidraw(root = packageRoot) {
  const { version } = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  if (version !== "0.18.1") {
    throw new Error(`Review the SVG dark-mode patch before using Excalidraw ${version}`);
  }

  const changes = [];
  for (const patch of patches) {
    const directory = path.join(root, "dist", patch.directory);
    const matches = [];
    for (const filename of (await fs.readdir(directory)).filter((name) => name.endsWith(".js"))) {
      const filenamePath = path.join(directory, filename);
      const source = await fs.readFile(filenamePath, "utf8");
      // Padding retains bundle offsets for the existing source maps.
      const replacement = patch.after.padEnd(patch.before.length, " ");
      const count = source.split(patch.before).length - 1;
      const appliedCount = source.split(replacement).length - 1;
      if (count + appliedCount > 0) {
        if (count + appliedCount !== 1) throw new Error(`Ambiguous patch target: ${filenamePath}`);
        matches.push({ filenamePath, source: source.replace(patch.before, replacement), changed: count === 1 });
      }
    }
    if (matches.length !== 1) {
      throw new Error(`Expected one Excalidraw ${patch.directory} SVG filter predicate, found ${matches.length}`);
    }
    changes.push(...matches);
  }

  // Validate every target before writing, rather than leaving a partial patch.
  for (const change of changes) {
    if (change.changed) await fs.writeFile(change.filenamePath, change.source);
  }
  console.log("[patch-excalidraw] SVG dark-mode compensation enabled (0.18.1)");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchExcalidraw();
}
