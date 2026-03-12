---
name: monitor-page
description: Track changes on a web page by comparing content snapshots over time. Use when the user wants to watch for updates, price drops, stock availability, or content changes.
metadata:
  display-name: Monitor Page
  enabled: "true"
  version: "1.0"
---

# Monitor Page

## When to Use

Activate when the user asks to monitor a page for changes, watch for price drops, track stock availability, detect new content, or be alerted when something changes on a website.

## Steps

1. **Clarify what to monitor.** Ask the user:
   - What URL to watch
   - What specific content to track (price, stock status, text, any change)
   - How to identify the target content (a specific section, element, or keyword)

2. **Capture the baseline.** Navigate to the page and extract the current state:
   - Use `navigate_page` to load the target URL
   - Use `get_page_content` or `evaluate_script` to extract the specific content to track
   - Save the baseline to memory using `memory_write` with a descriptive key like `monitor:{url-slug}:baseline`

3. **Check for changes.** On subsequent checks:
   - Navigate to the same URL
   - Extract the same content using the same method
   - Compare against the saved baseline
   - Report differences

4. **Report findings:**

### If changes detected:
```
## Page Change Detected

**URL:** [url]
**Checked:** [current date/time]

### Changes
- **Before:** [previous value]
- **After:** [current value]
```

### If no changes:
```
No changes detected on [URL].
Last checked: [current date/time]
Monitoring: [what you're tracking]
```

5. **Update the baseline** after reporting changes, using `memory_write` to store the new state.

## Tips

- For price monitoring, extract just the price element rather than the full page to avoid false positives from ad changes.
- Use `evaluate_script` with specific CSS selectors for precise element tracking.
- Suggest the user set a reminder to ask you to check again — BrowserOS doesn't yet have scheduled tasks.
- For stock availability, look for phrases like "In Stock", "Out of Stock", or "Add to Cart" button presence.
