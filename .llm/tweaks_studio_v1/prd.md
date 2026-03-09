# PRD: Tweaks Studio V1

## Level 1 - Executive Summary

### Requirements

- Add a new extension app under `apps/tweaks` that behaves like a simple BrowserOS-native Tweeks-style product.
- Let users create, edit, enable, disable, duplicate, delete, import, and export local tweaks.
- Support both CSS and JavaScript tweaks that apply automatically on matching sites.
- Provide starter examples inspired by common Tweeks library patterns.
- Provide a popup for quick current-site management.
- Integrate package scripts and repo docs so the extension can be built and run alongside the existing monorepo.

### Background

Public Tweeks materials consistently frame the product around small per-site modifications that run locally in the browser, can be installed from a library, remain editable, and persist across reloads. Example pages also expose a useful mental model: each tweak has a description, a site list, a code footprint, and a small capability surface.

This repository already has a strong BrowserOS extension foundation in `apps/agent`, but nothing focused on persistent per-site customization. Building a compact dedicated extension is the fastest way to validate the product category in this codebase without entangling it with BrowserOS chat, GraphQL, auth, or server-side generation.

### Design Overview

`apps/tweaks` will be a standalone WXT React extension with three execution surfaces:

- `app.html` Studio for full management
- popup for current-site actions
- content script runtime for automatic application

The extension stores tweak records in `chrome.storage.local`, seeds a small starter library, applies enabled matching tweaks locally, and provides import/export utilities for portability. A small set of shared UI primitives and utilities will be copied from `apps/agent` where that is faster than inventing a new pattern.

## Level 2 - Components

### Component 1: Tweak Storage Layer

This module owns persistence, seeding starter tweaks, CRUD actions, and derived selectors. It should expose:

- `getTweaks()`
- `saveTweak()`
- `deleteTweak()`
- `duplicateTweak()`
- `toggleTweak()`
- `seedStarterTweaksIfNeeded()`

Storage lives entirely in extension local storage.

### Component 2: Match Engine

This module determines whether a tweak should run on the current page. V1 will match by hostname against a list of domains or wildcard subdomains. It should also normalize domains during import and editing.

### Component 3: Runtime Executor

This module runs inside the content script and manages active tweaks for the current page.

Responsibilities:

- find matching enabled tweaks
- inject CSS styles
- run JavaScript tweaks
- track cleanup functions
- react to storage changes
- re-apply on URL changes in SPA-like pages

### Component 4: Starter Library

This module defines a small set of built-in tweaks with polished code and metadata. These entries must be safe, idempotent, and useful enough to demonstrate the product immediately after install.

Starter tweaks:

- YouTube Focus Mode
- Google Search Cleanup
- Hacker News Reading Mode

### Component 5: Import / Export

This module handles:

- exporting one tweak to JSON
- importing JSON
- importing userscript text with best-effort metadata parsing

If a userscript lacks metadata, the user can still import the code and then edit domains manually.

### Component 6: Studio UI

The Studio is the main management surface. It should support:

- library list with search/filter
- current tweak editor
- starter tweak install/clone actions
- metadata editing
- code editing
- import/export actions
- capability tags and runtime hints

### Component 7: Popup UI

The popup is optimized for the active tab. It should show:

- active hostname
- matching tweak list
- toggles for enabled state
- shortcut to create a new tweak scoped to the current host
- button to open the Studio

### Component 8: Background Service Worker

The background script should:

- seed storage on install
- open the Studio on first install
- support popup actions like opening the full app page

## Level 3 - Implementation Details

### 3.1 New Package Setup

Create a new workspace package:

- `apps/tweaks/package.json`
- `apps/tweaks/wxt.config.ts`
- `apps/tweaks/tsconfig.json`
- `apps/tweaks/components.json`
- `apps/tweaks/README.md`

Dependencies should stay intentionally small:

- React
- WXT
- Tailwind
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- `lucide-react`
- Radix slot and switch if needed

Avoid GraphQL, auth, analytics, or server-specific dependencies.

### 3.2 App Entrypoints

Add the following:

- `entrypoints/app/*`
- `entrypoints/popup/*`
- `entrypoints/background/index.ts`
- `entrypoints/content/index.ts`

Manifest should include:

- `storage`
- `tabs`
- `<all_urls>` host permission
- popup action
- options page pointing to the Studio

### 3.3 Data Types

Define:

```ts
export type TweakKind = 'css' | 'javascript'

export type TweakSource = 'starter' | 'custom' | 'imported'

export type TweakRecord = {
  id: string
  name: string
  description: string
  enabled: boolean
  source: TweakSource
  domains: string[]
  kind: TweakKind
  code: string
  createdAt: string
  updatedAt: string
  starterId?: string
}
```

### 3.4 Starter Seeds

Define starter tweaks in code, not bundled JSON, so they can include helper comments and stay type-safe.

Each starter entry should include:

- distinct name
- short description
- domain list
- kind
- code

### 3.5 Runtime Contract

For JavaScript tweaks, support this convention:

- code may return a cleanup function
- if no cleanup function is returned, the tweak is treated as fire-and-forget

Example execution model:

```ts
const fn = new Function('context', code)
const cleanup = fn(context)
```

The runtime stores cleanup functions by tweak ID and calls them before replacing or disabling an active tweak.

### 3.6 Capability Tags

Add a small code-inspection helper that returns tags like:

- `Network`
- `Clipboard`
- `Notifications`
- `Storage`

These tags are informational only and should be derived from code content or starter metadata.

### 3.7 Popup Actions

The popup should be able to:

- resolve the active tab URL
- show matching tweaks
- toggle them
- create a draft tweak using the current hostname

Draft creation can be implemented by saving a blank custom tweak and opening the Studio.

### 3.8 Root Integration

Update root `package.json` with:

- `start:tweaks`
- `build:tweaks`

Update the repo `README.md` to mention the new package and how to run it.

### 3.9 Validation

Validation requirements:

- name must be non-empty
- at least one domain must be present
- code must be non-empty
- imported userscripts without parsed matches should remain editable but should not silently auto-enable

### 3.10 Files Expected To Change

- `.llm/tweaks_studio_v1/design.md`
- `.llm/tweaks_studio_v1/prd.md`
- `README.md`
- `package.json`
- new `apps/tweaks/**` package files

## Acceptance Criteria

- A developer can run `bun run start:tweaks` and open the unpacked extension in BrowserOS or Chrome.
- The Studio renders and shows starter tweaks on first load.
- Creating a CSS tweak for a host and enabling it changes the page on reload.
- Creating a JS tweak for a host and enabling it changes the page on reload.
- The popup shows the current host and matching tweaks.
- Exporting and re-importing a tweak preserves its metadata and code.
- Importing a simple userscript with `@name` and `@match` creates a valid tweak record.

## Resolved Decisions

- [RESOLVED] Persistence uses extension local storage.
- [RESOLVED] Matching is domain-based, not full path-based, for v1 simplicity.
- [RESOLVED] Both CSS and JavaScript are supported in v1.
- [RESOLVED] AI generation is deferred.
- [RESOLVED] Starter library is bundled locally, not fetched remotely.
