# arch-err fork

This fork tracks ZimengXiong/ExcaliDash and publishes its own backend/frontend images to GHCR. Both automatic and manually dispatched builds check out this fork; the `git_ref` input selects a branch, tag, or commit here.

## SVG colors in dark mode

Excalidraw 0.18.1 normally applies `invert(93%) hue-rotate(180deg)` to the entire live canvas. Images receive an approximate counter-filter; upstream excludes SVGs. These filters do not cancel, so enabling the SVG counter-filter still washes out source colors.

This fork leaves loaded image caches unchanged and themes vector canvases once when their caches are generated. Live scene composition uses no Canvas2D filter or static-canvas CSS filter. Cache invalidation already covers theme changes, zoom and element edits. Background, grid and frame colors are converted once per distinct color; link icons are cached per theme and zoom. Interactive selection overlays retain upstream theming. PNG exports retain the upstream one-shot export path, with SVG images also bypassing its theme filter. SVG exports retain upstream's SVG filter pipeline.

Do not theme the live scene using the export filter: that filters every cached shape copy on every redraw and caused a severe performance regression. The browser test checks that a 1,000-shape scene generates themed caches once, reuses them while panning, and never filters copies into the live scene. Pixel tests compare SVG/PNG colors, transparency, shapes, theme transitions, zoom and PNG exports against source colors.

`frontend/scripts/patch-excalidraw.mjs` patches installed development and production bundles before dev/build/test, including Docker builds. Excalidraw is pinned to 0.18.1. Every patch validates its expected occurrence count before either bundle is written, and repeated runs are idempotent. Bundle changes require review; modified source-map offsets are not preserved.

Run `npm test` and `npm run build` in `frontend`; run `image-colors.spec.ts` in the existing E2E suite. Before deploying renderer changes, compare large-scene pan/zoom/edit behavior against the previous production renderer, including large image bounds and dense vector scenes. The isolated fixture lives at `/e2e/image-colors.html` under Vite and does not access application data or authentication.
