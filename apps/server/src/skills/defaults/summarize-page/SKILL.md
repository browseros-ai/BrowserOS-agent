---
name: summarize-page
description: Extract and summarize the main content of the current web page into structured markdown. Use when the user asks to summarize, digest, or get the gist of a page.
metadata:
  display-name: Summarize Page
  enabled: "true"
  version: "1.0"
---

# Summarize Page

## When to Use

Activate when the user asks to summarize, digest, condense, or get the key points from the current page or a specific URL.

## Steps

1. If the user provided a URL, use `navigate_page` to go there first.
2. Use `get_page_content` to extract the full text content of the page.
3. Identify the page type (article, documentation, product page, forum thread, etc.) and adapt the summary format accordingly.
4. Produce a structured markdown summary:

### Output Format

```
## Summary: [Page Title]

**Source:** [URL]
**Type:** [article/docs/product/forum/etc.]

### Key Points
- [3-5 bullet points capturing the main ideas]

### Details
[2-3 paragraphs expanding on the most important content]

### Takeaways
- [Actionable items or conclusions, if applicable]
```

## Tips

- For long pages, focus on headings, first paragraphs of sections, and any emphasized text.
- For product pages, emphasize specs, pricing, and reviews.
- For news articles, lead with the who/what/when/where/why.
- If the page content is behind a paywall or login, inform the user rather than summarizing partial content.
