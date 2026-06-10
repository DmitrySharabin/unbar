# Unbar — notes for Claude

Chrome MV3 extension. `src/` is the unpacked extension; everything else is tooling, sources, or store deliverables.

## Asset pipeline

PNGs in `src/icons/` and `store/tile-440x280.png` are build artifacts — don't edit them. Sources are `assets/icon.svg` and `assets/tile.svg`. Regenerate with `npm run assets` (sharp + Lanczos downscale).

## Screenshot pipeline

Sources: `assets/screenshots/*.html`. Deliverables: `store/screenshot-*.png`.

Render with Playwright at `deviceScaleFactor: 3` for crisp output. In README, set `<img width>` to `(image px) / 3` for 1x display.

### screenshot-mock.html

Standalone repro of the popup with hardcoded data — no `chrome.*` APIs. Stylesheet at `../../src/popup.css`.

Three states:

- Default: `screenshot-mock.html`
- Hover: hover row 1, but force the pencil visible via JS — Playwright's `hover` doesn't persist through the screenshot.
- Editor: `screenshot-mock.html?state=editor`

## Chrome extension popup quirks

- `body { inline-size: ... }` works for popup width. Don't fall back to `width` without evidence.
- Inline SVG sprite sheets need `style="display: none"` — the `hidden` attribute doesn't suppress their default 300×150 box, which bleeds into popup layout.
