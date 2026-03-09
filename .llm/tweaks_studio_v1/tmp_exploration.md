# Exploration Notes

## Tweeks Research Summary

Primary sources reviewed:

- https://www.tweeks.io/
- https://chromewebstore.google.com/detail/tweeks-customize-any-webs/fmkancpjcacjodknfjcpmgkccbhedkhc
- https://www.tweeks.io/onboarding
- https://www.tweeks.io/t/ab46eaf4412c4575a692d791
- https://www.tweeks.io/t/4f8052ffbec6428eb0b28be6
- https://www.tweeks.io/t/619f4b7f8989448c88c7b32c
- https://www.tweeks.io/blog/auth-mv3-architecture
- https://www.tweeks.io/privacy

Core product observations:

- Tweeks is a hosted library plus a local MV3 extension for per-site web modifications.
- The repeated user loop is discover or create, install, then keep the tweak applied across reloads.
- Public tweak pages consistently expose description, site list, code size, and capability-style metadata.
- Power-user affordances include full code visibility, editability, and userscript import.

Architecture observations:

- Tweeks clearly spans popup, service worker, offscreen, and bridge-like contexts.
- Public details and privacy copy strongly suggest a userscript-style runtime with GM-style capability bridges.
- Their production architecture is larger than what makes sense for a first BrowserOS version.

Repo observations:

- `apps/agent` is the closest extension packaging model in this repo.
- A full Tweeks clone would require auth, server APIs, and generation flows not present in a reusable form for a one-pass v1.
- A standalone extension package under `apps/` fits the repo cleanly and avoids coupling to BrowserOS chat, GraphQL, or the MCP server.

Chosen direction:

- Build a local-first BrowserOS extension that manages per-site CSS and JavaScript tweaks.
- Include starter examples, import/export, and current-site controls.
- Defer AI generation, public sharing, and remote sync.
