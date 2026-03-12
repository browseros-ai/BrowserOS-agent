---
name: organize-tabs
description: Analyze open tabs, group related ones by topic, close duplicates, and clean up tab clutter. Use when the user asks to organize, clean up, sort, or manage their tabs.
metadata:
  display-name: Organize Tabs
  enabled: "true"
  version: "1.0"
---

# Organize Tabs

## When to Use

Activate when the user asks to organize tabs, clean up tab clutter, group related tabs, close duplicates, or manage their open browser tabs.

## Steps

1. **List all open tabs** using `list_pages` to get the full inventory of open pages with their titles and URLs.

2. **Analyze and categorize.** Group tabs by:
   - **Domain** — Same website tabs together
   - **Topic** — Related content across domains (e.g., all "travel planning" tabs)
   - **Activity** — Shopping, research, social media, work, entertainment

3. **Identify issues:**
   - **Duplicates** — Same URL open in multiple tabs
   - **Dead tabs** — Error pages, "page not found", crashed tabs
   - **Stale tabs** — Tabs that are likely no longer needed

4. **Present a plan to the user:**

```
## Tab Analysis

**Total tabs:** [N]

### Groups Found
- Work: [list of tabs]
- Research: [list of tabs]
- Shopping: [list of tabs]
- Uncategorized: [list of tabs]

### Issues
- Duplicates: [N] tabs (will close extras)
- Dead/Error pages: [N] tabs (will close)

### Proposed Actions
1. Group [N] tabs into [M] tab groups
2. Close [N] duplicate tabs
3. Close [N] dead tabs
```

5. **Execute with user confirmation:**
   - Use `group_tabs` to create named tab groups for each category
   - Use `close_page` to close duplicates (keep the first instance)
   - Use `close_page` to close dead/error tabs

6. **Offer to bookmark** stale tabs before closing using `create_bookmark`.

## Tips

- Always ask before closing tabs — users may have unsaved work.
- Keep at least one tab open at all times.
- For duplicate detection, compare URLs after removing query parameters and fragments.
- If the user has 50+ tabs, prioritize grouping over individual analysis.
