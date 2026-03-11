---
name: manage-bookmarks
description: Organize bookmarks — find duplicates, categorize by topic, create folder structure, and clean up unused bookmarks. Use when the user asks to organize, clean up, sort, or manage their bookmarks.
metadata:
  display-name: Manage Bookmarks
  enabled: "true"
  version: "1.0"
---

# Manage Bookmarks

## When to Use

Activate when the user asks to organize bookmarks, find duplicates, create bookmark folders, clean up old bookmarks, or restructure their bookmark library.

## Steps

1. **Get current bookmarks** using `get_bookmarks` to retrieve the full bookmark tree.

2. **Analyze the bookmark collection:**
   - Count total bookmarks and folders
   - Identify duplicates (same URL, potentially different titles)
   - Categorize by domain and inferred topic

3. **Present an analysis:**

```
## Bookmark Analysis

**Total bookmarks:** [N]
**Total folders:** [N]

### Duplicates Found
- [URL] appears [N] times

### Suggested Categories
- News & Media: [N] bookmarks
- Development: [N] bookmarks
- Shopping: [N] bookmarks
- Reference: [N] bookmarks
- Entertainment: [N] bookmarks
- Uncategorized: [N] bookmarks
```

4. **Propose an organization plan:**
   - Folder structure based on detected categories
   - Which duplicates to remove (keep the one with the better title)
   - Which bookmarks to move into which folders

5. **Execute with user confirmation:**
   - Use `create_bookmark` to create new folders
   - Use `move_bookmark` to reorganize bookmarks into folders
   - Use `remove_bookmark` to remove confirmed duplicates

6. **Report results:**
   ```
   Bookmark cleanup complete
   - Removed [N] duplicates
   - Created [N] folders
   - Organized [N] bookmarks into categories
   ```

## Tips

- Never delete bookmarks without explicit user confirmation.
- When removing duplicates, keep the bookmark with the more descriptive title.
- Suggest common folder structures: Work, Personal, Reference, Shopping, Social, News.
- For large collections (500+), offer to work in batches by category.
- Some users prefer flat bookmark bars — ask about their preferred structure before reorganizing.
