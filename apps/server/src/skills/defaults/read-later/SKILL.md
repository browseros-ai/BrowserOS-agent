---
name: read-later
description: Bookmark the current page to a "📚 Read Later" folder and save a PDF copy for offline reading. Use when the user wants to save a page for later, bookmark it for reading, or keep an offline copy.
metadata:
  display-name: Read Later
  enabled: "true"
  version: "1.0"
---

# Read Later

Quick-save the current page: bookmark it into a dedicated "📚 Read Later" folder and download a PDF copy for offline reading.

## When to Apply

Activate when the user asks to save a page for later, read it later, bookmark something to come back to, or keep an offline copy of an article.

## Workflow

| Step | Tool | Detail |
|------|------|--------|
| Get current page | `get_active_page` | Identify the page URL and title |
| Check for folder | `get_bookmarks` | Look for an existing folder named "📚 Read Later" in the bookmark bar |
| Create folder (if needed) | `create_bookmark` | If the folder doesn't exist, create "📚 Read Later" in the bookmark bar |
| Add bookmark | `create_bookmark` | Save the current page URL and title into the "📚 Read Later" folder |
| Save PDF | `save_pdf` | Download the full page as a PDF to the working directory |
| Notify user | — | Tell the user the page has been saved with the bookmark location and PDF file path |

## Notification Format

```
Saved to 📚 Read Later
Title: <page title>
URL: <page url>
PDF: <download path>
```

## Tool Reference

| Category | Tools Used |
|----------|-----------|
| Page info | `get_active_page` |
| Bookmarks | `get_bookmarks`, `create_bookmark` |
| Export | `save_pdf` |

## Tips

- Always check if "📚 Read Later" already exists before creating it — avoid duplicate folders.
- If the page title is empty or generic, use the domain + path as the bookmark title.
- The PDF captures the page as-is, including the current scroll position and expanded sections.
