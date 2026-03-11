---
name: extract-data
description: Extract structured data from web pages — tables, lists, product info, pricing — into clean CSV, JSON, or markdown tables. Use when the user asks to scrape, extract, or pull data from a page.
metadata:
  display-name: Extract Data
  enabled: "true"
  version: "1.0"
---

# Extract Data

## When to Use

Activate when the user asks to extract, scrape, pull, or collect structured data from a web page — tables, product listings, pricing, contact info, search results, leaderboards, or any repeating data pattern.

## Steps

1. **Navigate to the target page** using `navigate_page` if not already there.

2. **Take a snapshot** using `take_snapshot` to understand the page layout and identify the data to extract.

3. **Identify the data structure.** Look for:
   - HTML tables
   - Repeated elements (product cards, list items, search results)
   - Key-value pairs (spec sheets, profile info)

4. **Extract the data** using one of these approaches:
   - For HTML tables: Use `evaluate_script` to run JavaScript that extracts table rows and cells into a JSON array.
   - For repeated elements: Use `evaluate_script` to query all matching elements and extract text/attributes.
   - For simple content: Use `get_page_content` and parse the text.

5. **Format the output** based on user preference or data type:
   - **CSV** — Best for spreadsheet import. Use comma-separated values with header row.
   - **JSON** — Best for programmatic use. Array of objects with consistent keys.
   - **Markdown table** — Best for reading in chat. Aligned columns with headers.

6. **Save or present the data.** Use `filesystem_write` to save to a file, or present inline for small datasets.

## Tips

- Always check if the page has pagination — offer to extract from all pages.
- Clean up the data: trim whitespace, normalize currency symbols, remove hidden characters.
- For large datasets (100+ rows), save to a file rather than presenting inline.
- If data spans multiple pages, use the pagination collector approach: extract current page, click "Next", repeat.
