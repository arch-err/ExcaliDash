# arch-err fork

This fork tracks ZimengXiong/ExcaliDash and publishes its own backend/frontend images to GHCR. Both automatic and manually dispatched builds check out this fork; the `git_ref` input selects a branch, tag, or commit here.

## SVG colors in dark mode

Excalidraw 0.18.1 applies a dark-mode filter to its canvas but excludes SVG images from the counter-filter used for PNG/JPEG images. This fork removes that exclusion so loaded SVG images receive the same compensation as raster images. Drawing shapes still follow the normal theme, and the SVG file data is unchanged. The existing filter pipeline can still shift colors slightly; this patch does not promise exact color fidelity between themes.

`frontend/scripts/patch-excalidraw.mjs` patches the installed development and production bundles before `npm run dev`, `npm run build`, and `npm test`. Docker builds use the same build hook. The dependency is pinned to 0.18.1, and the script rejects an unexpected version or bundle layout instead of silently losing the fix. No additional dependency is needed.

When updating Excalidraw, review its image-rendering predicate and update both bundle patches and regression tests. `npm test` checks the patch guards and both installed renderer predicates as well as the frontend unit suite. Rendering verification should compare the same SVG and PNG in light/dark mode, including transparent regions; their pixels should match within each theme.
