---
name: read-later
description: Extract article content from a web page into clean, readable markdown for offline reading. Use when the user wants to save an article as text, strip ads and clutter, or create a reading copy.
metadata:
  display-name: Read Later
  enabled: "true"
  version: "1.0"
---

# Read Later

## When to Use

Activate when the user asks to save an article for later, create a clean reading copy, strip away ads and navigation, or extract the main content from a cluttered page.

## Steps

1. **Navigate to the article** using `navigate_page` if not already there.

2. **Extract the main content** using `get_page_content` to get the full text.

3. **Clean and structure the content:**
   - Identify the article title, author, and publication date
   - Extract the main body text, preserving paragraph structure
   - Keep meaningful headings and subheadings
   - Preserve important lists and block quotes
   - Remove: navigation, ads, sidebars, related articles, comments, footers

4. **Format as clean markdown:**

### Output Format

```markdown
# [Article Title]

**Author:** [name]
**Published:** [date]
**Source:** [URL]
**Saved:** [current date]

---

[Article body in clean markdown]

---
*Saved from [domain] on [date]*
```

5. **Save the file** using `filesystem_write`:
   - Default filename: `{date}-{title-slug}.md`
   - Save to the user's preferred directory or the current working directory

6. **Confirm the save:**
   ```
   Saved: [filename]
   Title: [article title]
   Word count: ~[count]
   Reading time: ~[X] min
   ```

## Tips

- Estimate reading time at ~250 words per minute.
- If the article has multiple pages, detect "Next Page" links and combine all pages.
- Preserve code blocks with proper syntax highlighting markers.
- For paywalled content, only save what's accessible.
- If the user saves multiple articles, suggest creating a reading list index file.
