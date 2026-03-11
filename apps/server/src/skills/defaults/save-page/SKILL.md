---
name: save-page
description: Save web pages as PDF files for offline reading, archiving, or sharing. Use when the user asks to save, download, export, or archive a page as PDF.
metadata:
  display-name: Save Page
  enabled: "true"
  version: "1.0"
---

# Save Page

## When to Use

Activate when the user asks to save a page as PDF, download a page for offline reading, archive a webpage, or export page content to a file.

## Steps

1. **Navigate to the target page** using `navigate_page` if not already there. If the user provides multiple URLs, process them one by one.

2. **Prepare the page for saving:**
   - Dismiss any popups or overlays that would appear in the PDF
   - Scroll to load any lazy-loaded content if the page uses infinite scroll

3. **Save as PDF** using `save_pdf` with a descriptive filename:
   - Pattern: `{domain}-{title-slug}-{date}.pdf`
   - Example: `nytimes-climate-report-2025-03-11.pdf`
   - Let the user specify a custom path if they prefer

4. **For multiple pages**, process each URL sequentially:
   - Navigate to the page
   - Save as PDF
   - Report progress to the user

5. **Confirm the save:**
   ```
   Saved: [filename].pdf
   Source: [URL]
   Location: [file path]
   ```

## Tips

- For articles, the PDF will capture the current page state — make sure content is fully loaded.
- Some pages have print stylesheets that produce better PDFs — `save_pdf` uses these automatically.
- For documentation sites with multiple pages, offer to save each section as a separate PDF.
- If saving fails, offer the alternative of using `get_page_content` to save as markdown.
