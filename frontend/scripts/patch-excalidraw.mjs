import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.join(frontendRoot, "node_modules/@excalidraw/excalidraw");

// Apply the theme while drawing background/shapes, rather than filtering the
// composited canvas. Images bypass the theme filter and keep their source colors.
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

  {
    directory: "dev",
    before: 'if (shouldResetImageFilter(element, renderConfig, appState)) {\n    context.filter = IMAGE_INVERT_FILTER;\n  }',
    after: '/* Keep cached images in their original colors. */',
  },
  {
    directory: "prod",
    before: 'let m=_1.canvas(i);A1(e,r,o)&&(a.filter=Ia),ni(e,m,a,r,o),a.restore();',
    after: 'let m=_1.canvas(i);ni(e,m,a,r,o),a.restore();',
  },
  {
    directory: "dev",
    before: 'if (isExporting && theme === THEME.DARK) {\n    context.filter = THEME_FILTER;\n  }',
    after: 'context.filter = isExporting && theme === THEME.DARK ? THEME_FILTER : "none";',
  },
  {
    directory: "prod",
    before: 'i&&o===ke.DARK&&(s.filter=Io),typeof a=="string"?',
    after: 's.filter=i&&o===ke.DARK?Io:"none",typeof a=="string"?',
  },
  {
    directory: "dev",
    before: 'theme: appState.theme,\n    isExporting,\n    viewBackgroundColor:',
    after: 'theme:appState.theme,isExporting:true,viewBackgroundColor:',
  },
  {
    directory: "prod",
    before: 'theme:a.theme,isExporting:c,viewBackgroundColor:a.viewBackgroundColor',
    after: 'theme:a.theme,isExporting:1,viewBackgroundColor:a.viewBackgroundColor',
  },
  {
    directory: "dev",
    before: 'context.save();\n  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);\n  const boundTextElement = getBoundTextElement(element, allElementsMap);',
    after: 'context.save();\n  if (shouldResetImageFilter(element, renderConfig, appState)) context.filter = "none";\n  context.scale(1 / window.devicePixelRatio, 1 / window.devicePixelRatio);\n  const boundTextElement = getBoundTextElement(element, allElementsMap);',
  },
  {
    directory: "prod",
    before: 't.save(),t.scale(1/window.devicePixelRatio,1/window.devicePixelRatio);let b=oe(i,o);',
    after: 't.save(),A1(i,n,r)&&(t.filter="none"),t.scale(1/window.devicePixelRatio,1/window.devicePixelRatio);let b=oe(i,o);',
  },
];

export async function patchExcalidraw(root = packageRoot) {
  const { version } = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
  if (version !== "0.18.1") {
    throw new Error(`Review the SVG dark-mode patch before using Excalidraw ${version}`);
  }

  const bundles = new Map();
  for (const directoryName of ["dev", "prod"]) {
    const directory = path.join(root, "dist", directoryName);
    for (const filename of (await fs.readdir(directory)).filter((name) => name.endsWith(".js"))) {
      const filenamePath = path.join(directory, filename);
      const source = await fs.readFile(filenamePath, "utf8");
      bundles.set(filenamePath, { directoryName, source, original: source });
    }
  }

  for (const patch of patches) {
    const matches = [];
    const replacement = patch.after.padEnd(patch.before.length, " ");
    for (const [filenamePath, bundle] of bundles) {
      if (bundle.directoryName !== patch.directory) continue;
      const count = bundle.source.split(patch.before).length - 1;
      const appliedCount = bundle.source.split(replacement).length - 1;
      if (count + appliedCount > 0) {
        if (count + appliedCount !== 1) throw new Error(`Ambiguous patch target: ${filenamePath}`);
        matches.push(bundle);
      }
    }
    if (matches.length !== 1) {
      throw new Error(`Expected one Excalidraw ${patch.directory} patch target, found ${matches.length}`);
    }
    matches[0].source = matches[0].source.replace(patch.before, replacement);
  }

  // Validate every target before writing, rather than leaving a partial patch.
  for (const [filenamePath, bundle] of bundles) {
    if (bundle.source !== bundle.original) await fs.writeFile(filenamePath, bundle.source);
  }
  console.log("[patch-excalidraw] Original image colors enabled (0.18.1)");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchExcalidraw();
}
