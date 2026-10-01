# arch-err fork

This fork tracks ZimengXiong/ExcaliDash and publishes its own backend/frontend images to GHCR. Both automatic and manually dispatched builds check out this fork; the `git_ref` input selects a branch, tag, or commit here.

## Original image colors in dark mode

Excalidraw 0.18.1 normally applies a CSS dark-mode filter to the entire live canvas. Its image counter-filter changes saturation and clips colors, so applying it to SVGs prevents full inversion but still washes out images.

This fork applies the theme in the static renderer to the background and drawing elements instead. Loaded SVG and raster images are cached in their original colors and drawn with the context filter disabled. The static canvas CSS filter is disabled; the interactive overlay retains its usual theme styling. Transparent image regions composite over the themed canvas background. SVG file data is unchanged. The existing PNG export path also bypasses the theme filter for SVG and raster images.

`frontend/scripts/patch-excalidraw.mjs` patches the installed development and production bundles before `npm run dev`, `npm run build`, and `npm test`. Docker builds use the same build hook. The dependency is pinned to 0.18.1, and the script rejects an unexpected version or bundle layout instead of silently losing the fix. No additional dependency is needed.

When updating Excalidraw, review the background initialization, cached-image generation, cached-canvas drawing, and image-filter predicate. Update both bundle patches and regression tests. `npm test` checks patch guards and installed renderer predicates as well as the frontend unit suite. The E2E image-color test compares SVG/PNG pixels against original source colors, checks transparency and drawing contrast, and exercises light/dark transitions, zoom, and PNG export. Its isolated frontend fixture is served by Vite during development and is not included in the application build.
