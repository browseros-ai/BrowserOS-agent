# BrowserOS Tweaks Studio

Tweaks Studio is a lightweight BrowserOS extension for persistent per-site web modifications. It ships a local starter library, supports custom CSS and JavaScript tweaks, and applies enabled tweaks automatically on matching sites.

## Features

- Create and edit local tweaks for one or more domains
- Support CSS and JavaScript tweaks
- Quick current-site popup controls
- Starter library inspired by common Tweeks-style patterns
- JSON export and userscript import
- Local-only storage with no server dependency

## Development

```bash
bun run --filter @browseros/tweaks dev
```

Load the generated `dist/chrome-mv3` directory as an unpacked extension in Chrome or BrowserOS.

## Build

```bash
bun run --filter @browseros/tweaks build
```
