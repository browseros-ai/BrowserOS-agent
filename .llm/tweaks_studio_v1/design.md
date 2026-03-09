# Design: Tweaks Studio V1

## Chosen Option: Local-First BrowserOS Extension

### Overview

Build a new WXT extension app under `apps/tweaks` that brings the core Tweeks interaction model into the BrowserOS repo without recreating Tweeks' full backend stack. The extension will let users install starter tweaks, create their own per-site CSS or JavaScript tweaks, enable and disable them locally, and apply them automatically on matching sites through a content-script runtime.

The extension will ship three surfaces:

1. A full-page Studio (`app.html`) for browsing, editing, importing, exporting, and cloning tweaks.
2. A lightweight popup for the current site with quick toggles and a link into the Studio.
3. A content-script runtime that applies matching tweaks on every page and re-applies them when storage changes.

### Why This Option

Research on Tweeks shows the core product loop is:

1. Pick a site.
2. Describe or select a modification.
3. Install it.
4. Keep it applied across reloads.

The pieces that consistently show up across the public site, Chrome Web Store listing, and example pages are:

- per-site modifications
- local execution in the browser
- installable library entries
- code visibility and editability
- small, explicit capability surfaces like clipboard, notifications, and network access

This design captures those product truths with the smallest credible implementation in this repo. It avoids prematurely adding AI code generation, auth, user profiles, public sharing, or remote sync, all of which would materially expand scope and introduce backend coupling.

## Alternatives Considered

### Option A: Full Tweeks-Style AI Generation Backed by BrowserOS Server

Use BrowserOS server-side LLM infrastructure to turn natural-language instructions into DOM-modification code, then install that code into the extension.

Pros:
- Closest to Tweeks' headline experience.
- Reuses the existing BrowserOS AI story.

Cons:
- Requires provider configuration, secure code-generation prompts, review flows, and likely new server APIs.
- Pushes v1 into auth, rate limiting, validation, and runtime safety work.
- Hard to ship thoroughly in one pass without making poor architectural shortcuts.

Decision:
- Rejected for v1. This is the correct v2 direction once the local runtime exists.

### Option B: Server-Managed Tweak Registry With Thin UI

Store tweaks in the BrowserOS server or a local DB and make the extension mostly a remote client.

Pros:
- Centralizes persistence.
- Easier future sync and sharing.

Cons:
- Unnecessary dependency on the server for a fundamentally client-local feature.
- Makes offline behavior worse.
- Adds routing, API, and migration work before the runtime is proven.

Decision:
- Rejected. Local extension storage is the right first persistence layer.

### Option C: CSS-Only Minimal Extension

Support only CSS snippets, no JavaScript tweaks.

Pros:
- Safer runtime.
- Very fast to build.

Cons:
- Misses the most compelling examples from Tweeks, like added controls, timers, and page instrumentation.
- Makes import of existing userscripts largely useless.

Decision:
- Rejected. V1 should support both CSS and JS, while keeping runtime conventions simple.

## Product Shape

### Core User Stories

- As a user, I can install built-in example tweaks for common sites.
- As a user, I can create a new tweak with a name, description, target domains, type, and code.
- As a user, I can toggle a tweak on or off and see it persist across reloads.
- As a user, I can quickly inspect which tweaks affect my current site.
- As a user, I can import a userscript or JSON export and turn it into a local tweak.
- As a user, I can export a tweak to JSON for backup or sharing.

### Explicit Non-Goals

- Natural-language generation of tweaks
- Accounts, auth, or cloud sync
- Public publishing or community profiles
- Fine-grained permission prompts per tweak
- Multi-user collaboration
- Server-side storage

## Architecture

### 1. Extension Package

Create `apps/tweaks` as a standalone WXT React app similar to `apps/agent`, but much smaller.

Package responsibilities:

- render the Studio and popup UIs
- own tweak storage and library state
- run the tweak runtime in content scripts
- stay independent from GraphQL, auth, and BrowserOS server state

### 2. Data Model

Each tweak record will store:

- `id`
- `name`
- `description`
- `enabled`
- `source`
  - `starter`
  - `custom`
  - `imported`
- `domains`
- `kind`
  - `css`
  - `javascript`
- `code`
- `createdAt`
- `updatedAt`
- `starterId?`

This is intentionally smaller than a full userscript manifest. Domain-level targeting is enough for v1 and aligns with the public Tweeks detail pages showing a short list of sites per tweak.

### 3. Starter Library

Seed local storage with a small built-in library that demonstrates the product:

- YouTube Focus Mode
- Google Search Cleanup
- Hacker News Reading Mode

Each starter entry is cloneable into the editable tweak collection. This mirrors Tweeks' featured-library flow without requiring a hosted catalog.

### 4. Runtime Model

The content script runs on `<all_urls>` and evaluates the current hostname against stored tweak domains.

For matching enabled tweaks:

- CSS tweaks inject a dedicated `<style>` tag keyed by tweak ID.
- JavaScript tweaks execute inside the content-script context with `document`, `window`, and DOM access.
- If a JS tweak returns a cleanup function, the runtime stores and calls it before re-running or disabling the tweak.

The runtime listens for `chrome.storage.onChanged` so tweaks can update without a browser restart.

### 5. Import / Export

Support two import paths:

- JSON export produced by this extension
- Basic userscript text import by parsing `@match`, `@name`, and `@description` metadata when present

Export format stays local and explicit:

- a single tweak as formatted JSON

This is enough for portability and maps to Tweeks' "see and edit the full script code" plus "import existing userscripts" positioning.

### 6. Capability Tags

Show capability tags in the UI by heuristically inspecting code for patterns such as:

- `fetch` / `XMLHttpRequest` => `Network`
- `navigator.clipboard` => `Clipboard`
- `Notification` => `Notifications`
- `localStorage` / `sessionStorage` / `indexedDB` => `Storage`

These are not enforcement boundaries. They are user-facing code signals inspired by Tweeks' detail pages, which disclose the kinds of access a tweek may require.

## UI Design

### Studio

The Studio should feel more editorial and tool-like than `apps/agent`.

Visual direction:

- warm paper background
- copper / rust accent color
- serif display headings with clean utility body text
- visible code/editor panels with monospaced treatment

Layout:

- top hero with current-site context and creation CTA
- left library/list pane
- main editor pane
- right metadata pane for domains, status, type, and capability tags

### Popup

The popup focuses on the current hostname:

- current site label
- matching tweak count
- quick toggles
- create-from-current-site CTA
- open Studio CTA

## File / Module Plan

### New package

- `apps/tweaks/package.json`
- `apps/tweaks/wxt.config.ts`
- `apps/tweaks/tsconfig.json`
- `apps/tweaks/components.json`

### Entrypoints

- `apps/tweaks/entrypoints/app/index.html`
- `apps/tweaks/entrypoints/app/main.tsx`
- `apps/tweaks/entrypoints/app/App.tsx`
- `apps/tweaks/entrypoints/popup/index.html`
- `apps/tweaks/entrypoints/popup/main.tsx`
- `apps/tweaks/entrypoints/popup/App.tsx`
- `apps/tweaks/entrypoints/background/index.ts`
- `apps/tweaks/entrypoints/content/index.ts`

### Shared app code

- `apps/tweaks/styles/global.css`
- `apps/tweaks/lib/types.ts`
- `apps/tweaks/lib/utils.ts`
- `apps/tweaks/lib/tweaks/starter-tweaks.ts`
- `apps/tweaks/lib/tweaks/storage.ts`
- `apps/tweaks/lib/tweaks/match.ts`
- `apps/tweaks/lib/tweaks/capabilities.ts`
- `apps/tweaks/lib/tweaks/import-export.ts`
- `apps/tweaks/lib/tweaks/runtime.ts`

### UI

- `apps/tweaks/components/ui/*` small copied primitives
- `apps/tweaks/components/tweaks/*` feature components

## Key Decisions

- Use local extension storage, not the BrowserOS server, for persistence.
- Use domain matching instead of full match-pattern authoring for v1 UX.
- Support both CSS and JavaScript tweaks.
- Keep imports simple and permissive; validation will reject empty name/code/domain sets.
- Seed starter tweaks on install and first load.
- Add root scripts so the new extension is easy to run and build from the monorepo.

## Risks And Mitigations

### Risk: JS tweaks can be non-idempotent

Mitigation:
- Encourage cleanup-return pattern in starter examples.
- Re-run cleanup before reapplying when available.
- Make built-in examples idempotent.

### Risk: `<all_urls>` content script is broad

Mitigation:
- Apply no code unless the current hostname matches an enabled tweak.
- Keep the runtime minimal and synchronous where possible.

### Risk: Importing arbitrary userscripts is messy

Mitigation:
- Support only a basic parser for common metadata.
- Fall back to manual domain entry if no `@match` lines are present.

