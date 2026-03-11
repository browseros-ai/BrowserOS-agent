---
name: manage-bookmarks
description: Organize bookmarks — find duplicates, categorize by topic, create a clean folder structure, and clean up unused bookmarks. Use when the user asks to organize, clean up, sort, or manage their bookmarks.
metadata:
  display-name: Manage Bookmarks
  enabled: "true"
  version: "1.0"
---

# Manage Bookmarks

Analyze the user's bookmark collection, propose a clean top-level folder structure (max 5 folders), execute with confirmation, and deliver a markdown summary of everything that changed.

## When to Apply

Activate when the user asks to organize bookmarks, find duplicates, create bookmark folders, clean up old bookmarks, or restructure their bookmark library.

## Workflow

### Phase 1 — Analyze

1. **Retrieve bookmarks** using `get_bookmarks` to get the full bookmark tree.
2. **Analyze the collection thoroughly:**
   - Total bookmarks and existing folders
   - Duplicates (same URL, possibly different titles)
   - Group every bookmark by domain and inferred topic
   - Identify dead or broken patterns (e.g., `localhost`, empty titles)

3. **Present the analysis to the user.** Use short one-word slug categories:

```
## Bookmark Analysis

**Total:** 342 bookmarks, 12 folders
**Duplicates:** 8

### Proposed Folders (top-level)
- dev — 94 bookmarks (GitHub, Stack Overflow, docs)
- work — 67 bookmarks (Notion, Slack, Jira, company domains)
- news — 45 bookmarks (HN, Reddit, RSS feeds)
- shop — 28 bookmarks (Amazon, product pages)
- misc — 108 bookmarks (everything else)

### Duplicates to Remove
- github.com/user/repo × 3 (keep: "User/Repo - GitHub")
- notion.so/page × 2 (keep: "Project Notes")
```

**Folder naming rules:**
- One-word lowercase slugs: `dev`, `work`, `news`, `shop`, `ref`, `social`, `misc`
- **Maximum 3–5 top-level folders.** Fewer is better. Do not over-categorize.
- Only suggest subfolders if the user explicitly asks for deeper organization

4. **Wait for confirmation.** Do not proceed until the user says to go ahead. If they want changes to the plan (rename folders, merge categories, split a group), adjust and re-present.

### Phase 2 — Organize

Once the user confirms:

| Step | Tool | Detail |
|------|------|--------|
| Create folders | `create_bookmark` | Create each top-level folder from the approved plan |
| Move bookmarks | `move_bookmark` | Move each bookmark into its assigned folder |
| Remove duplicates | `remove_bookmark` | Remove confirmed duplicates, keeping the one with the better title |

**Order matters:** Create all folders first, then move bookmarks, then remove duplicates.

### Phase 3 — Summary

After all operations complete, present a clean markdown summary:

```markdown
## Bookmark Cleanup Complete

**Before:** 342 bookmarks, 12 folders
**After:** 334 bookmarks, 5 folders

### Created Folders
- dev (94 bookmarks)
- work (67 bookmarks)
- news (45 bookmarks)
- shop (28 bookmarks)
- misc (108 bookmarks)

### Duplicates Removed (8)
- github.com/user/repo — removed 2 copies
- notion.so/page — removed 1 copy

### Moved
- 287 bookmarks reorganized into new folders
- 47 bookmarks already in correct location
```

## Tool Reference

| Category | Tools Used |
|----------|-----------|
| Read | `get_bookmarks` |
| Create | `create_bookmark` |
| Move | `move_bookmark` |
| Delete | `remove_bookmark` |

## Tips

- **Never delete without confirmation.** Always present the plan and wait for the user to say proceed.
- **Keep it flat.** 3–5 top-level folders covers most collections. Resist the urge to create deep hierarchies.
- When removing duplicates, keep the bookmark with the more descriptive title.
- For very large collections (500+), process in batches by category to avoid timeouts.
- Some users prefer a flat bookmark bar — ask about their preferred structure before reorganizing.
