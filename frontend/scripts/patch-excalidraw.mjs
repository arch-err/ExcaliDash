import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("../", import.meta.url));
const packageRoot = path.join(frontendRoot, "node_modules/@excalidraw/excalidraw");

// Theme vector caches once; the live scene only copies unfiltered pixels.
// Exports retain upstream's one-shot theme filter.
const helpers = `
var forkThemeColorCache = new Map();
var forkThemeColor = (color, dark) => {
  if (!dark) return color;
  if (forkThemeColorCache.has(color)) return forkThemeColorCache.get(color);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.filter = FORK_THEME_FILTER; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
  const [r,g,b,a] = ctx.getImageData(0,0,1,1).data;
  const value = \`rgba(\${r},\${g},\${b},\${a/255})\`;
  forkThemeColorCache.set(color, value); return value;
};
var forkThemeCanvas = (canvas, dark) => {
  if (!dark) return;
  const ctx = canvas.getContext("2d");
  ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.globalCompositeOperation = "copy"; ctx.filter = FORK_THEME_FILTER;
  ctx.drawImage(canvas,0,0); ctx.restore();
};
`;
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
  {"directory": "dev", "before": "var IMAGE_INVERT_FILTER = \"invert(100%) hue-rotate(180deg) saturate(1.25)\";", "after": helpers.replaceAll("FORK_THEME_FILTER", "THEME_FILTER") + "var IMAGE_INVERT_FILTER = \"invert(100%) hue-rotate(180deg) saturate(1.25)\";"},
  {"directory": "prod", "before": "var Ia=\"invert(100%) hue-rotate(180deg) saturate(1.25)\",", "after": helpers.replaceAll("FORK_THEME_FILTER", "Io") + "var Ia=\"invert(100%) hue-rotate(180deg) saturate(1.25)\","},
  {
    "directory": "dev",
    "before": "if (shouldResetImageFilter(element, renderConfig, appState)) {\n    context.filter = IMAGE_INVERT_FILTER;\n  }\n  drawElementOnCanvas(element, rc, context, renderConfig, appState);\n  context.restore();",
    "after": "drawElementOnCanvas(element, rc, context, renderConfig, appState);\n  context.restore();\n  forkThemeCanvas(canvas, appState.theme === THEME.DARK && !isImageElement(element));"
  },
  {
    "directory": "prod",
    "before": "A1(e,r,o)&&(a.filter=Ia),ni(e,m,a,r,o),a.restore();",
    "after": "ni(e,m,a,r,o),a.restore(),forkThemeCanvas(i,o.theme===ke.DARK&&!Ye(e));"
  },
  {
    "directory": "dev",
    "before": "if (isExporting && theme === THEME.DARK) {\n    context.filter = THEME_FILTER;\n  }",
    "after": "context.filter = isExporting && theme === THEME.DARK ? THEME_FILTER : \"none\";\n  context.forkDark = !isExporting && theme === THEME.DARK;"
  },
  {
    "directory": "prod",
    "before": "i&&o===ke.DARK&&(s.filter=Io),typeof a==\"string\"?",
    "after": "s.filter=i&&o===ke.DARK?Io:\"none\",s.forkDark=!i&&o===ke.DARK,typeof a==\"string\"?"
  },
  {
    "directory": "dev",
    "before": "context.fillStyle = viewBackgroundColor;",
    "after": "context.fillStyle = forkThemeColor(viewBackgroundColor, context.forkDark);"
  },
  {
    "directory": "prod",
    "before": "s.fillStyle=a,s.fillRect(0,0,n,r)",
    "after": "s.fillStyle=forkThemeColor(a,s.forkDark),s.fillRect(0,0,n,r)"
  },
  {
    "directory": "dev",
    "before": "context.strokeStyle = isBold ? GridLineColor.Bold : GridLineColor.Regular;",
    "after": "context.strokeStyle = forkThemeColor(isBold ? GridLineColor.Bold : GridLineColor.Regular, context.forkDark);",
    "count": 2
  },
  {
    "directory": "prod",
    "before": "e.strokeStyle=m?Ti.Bold:Ti.Regular,",
    "after": "e.strokeStyle=forkThemeColor(m?Ti.Bold:Ti.Regular,e.forkDark),",
    "count": 2
  },
  {
    "directory": "dev",
    "before": "context.fillStyle = \"rgba(0, 0, 200, 0.04)\";\n        context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;\n        context.strokeStyle = FRAME_STYLE.strokeColor;",
    "after": "context.fillStyle = forkThemeColor(\"rgba(0, 0, 200, 0.04)\", context.forkDark);\n        context.lineWidth = FRAME_STYLE.strokeWidth / appState.zoom.value;\n        context.strokeStyle = forkThemeColor(FRAME_STYLE.strokeColor, context.forkDark);"
  },
  {
    "directory": "prod",
    "before": "o.fillStyle=\"rgba(0, 0, 200, 0.04)\",o.lineWidth=Pe.strokeWidth/a.zoom.value,o.strokeStyle=Pe.strokeColor,",
    "after": "o.fillStyle=forkThemeColor(\"rgba(0, 0, 200, 0.04)\",o.forkDark),o.lineWidth=Pe.strokeWidth/a.zoom.value,o.strokeStyle=forkThemeColor(Pe.strokeColor,o.forkDark),"
  },
  {
    "directory": "dev",
    "before": "context.strokeStyle = appState.theme === THEME.LIGHT ? \"#7affd7\" : \"#1d8264\";",
    "after": "context.strokeStyle = forkThemeColor(appState.theme === THEME.LIGHT ? \"#7affd7\" : \"#1d8264\", context.forkDark);"
  },
  {
    "directory": "prod",
    "before": "o.strokeStyle=a.theme===ke.LIGHT?\"#7affd7\":\"#1d8264\"",
    "after": "o.strokeStyle=forkThemeColor(a.theme===ke.LIGHT?\"#7affd7\":\"#1d8264\",o.forkDark)"
  },
  {
    "directory": "dev",
    "before": "if (!linkCanvas || linkCanvas.zoom !== appState.zoom.value) {",
    "after": "if (!linkCanvas || linkCanvas.zoom !== appState.zoom.value || linkCanvas.forkDark !== context.forkDark) {"
  },
  {
    "directory": "prod",
    "before": "if(!E||E.zoom!==n.zoom.value){",
    "after": "if(!E||E.zoom!==n.zoom.value||E.forkDark!==t.forkDark){"
  },
  {
    "directory": "dev",
    "before": "linkCanvasCacheContext.restore();\n    }\n    context.drawImage(linkCanvas,",
    "after": "linkCanvasCacheContext.restore();\n      forkThemeCanvas(linkCanvas, context.forkDark);\n      linkCanvas.forkDark = context.forkDark;\n    }\n    context.drawImage(linkCanvas,"
  },
  {
    "directory": "prod",
    "before": "g.restore()}t.drawImage(E,d-p,c-m,l,U)",
    "after": "g.restore(),forkThemeCanvas(E,t.forkDark),E.forkDark=t.forkDark}t.drawImage(E,d-p,c-m,l,U)"
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
    const replacement = patch.after;
    for (const [filenamePath, bundle] of bundles) {
      if (bundle.directoryName !== patch.directory) continue;
      const appliedCount = bundle.source.split(replacement).length - 1;
      const count = bundle.source.replaceAll(replacement, "").split(patch.before).length - 1;
      if (count + appliedCount) {
        if ((count && appliedCount) || count + appliedCount !== (patch.count || 1)) throw new Error(`Ambiguous patch target: ${filenamePath}`);
        matches.push(bundle);
      }
    }
    if (matches.length !== 1) throw new Error(`Expected one Excalidraw ${patch.directory} patch target, found ${matches.length}`);
    if (!matches[0].source.includes(replacement)) matches[0].source = matches[0].source.replaceAll(patch.before, replacement);
  }
  // Validate all targets before writing either bundle.
  for (const [filenamePath, bundle] of bundles) {
    if (bundle.source !== bundle.original) await fs.writeFile(filenamePath, bundle.source);
  }
  console.log("[patch-excalidraw] Cached dark theme enabled (0.18.1)");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await patchExcalidraw();
}
