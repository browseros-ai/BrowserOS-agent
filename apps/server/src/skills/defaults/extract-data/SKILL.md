---
name: extract-data
description: Extract structured data from web pages — tables, lists, product info, pricing — into clean CSV, JSON, or markdown tables. Parallelizes across hidden tabs for multi-source extraction and saves results to disk incrementally. Use when the user asks to scrape, extract, or pull data from a page.
metadata:
  display-name: Extract Data
  enabled: "true"
  version: "1.0"
---

# Extract Data

End-to-end data extraction workflow that pulls structured content from one or many web pages, saves results to disk incrementally (never accumulating everything in memory), and delivers clean output in the user's preferred format.

## When to Apply

Activate when the user asks to extract, scrape, pull, or collect structured data from web pages — tables, product listings, pricing, contact info, search results, leaderboards, or any repeating data pattern.

## Workflow

### Phase 1 — Clarify & Plan

1. **Clarify the request.** Before extracting, confirm with the user:
   - **Source(s):** Single page, list of URLs, or search-then-extract?
   - **Output format:** CSV, JSON, or Markdown table? Default to CSV if not specified.
   - **Output location:** Where to save files. Default: `~/Downloads/extract-<topic-slug>/`.
   - **What data to extract:** Column names, specific fields, or "everything in the table."
2. **Create the output directory.** Use `evaluate_script` to create the target folder:
   ```
   extract-<topic-slug>/
   ├── raw/              ← per-page extracted content
   ├── merged.<format>   ← final combined output (csv / json)
   └── extraction.log    ← progress log with source URLs
   ```

### Phase 2 — Single-Page Extraction

For a **single page** (or each individual page in a batch):

| Step | Tool | Detail |
|------|------|--------|
| Navigate | `navigate_page` | Go to the target URL (skip if already on the page) |
| Read content | `get_page_content` | Extract the page as markdown — this captures tables, lists, and text in a structured format |
| Identify structure | — | Determine the data pattern: HTML table, repeated cards, key-value pairs, etc. |
| Extract data | `evaluate_script` | For complex structures (e.g., product grids, nested cards), run JavaScript to query elements and return a JSON array. For clean markdown tables from `get_page_content`, parse directly. |
| **Save immediately** | `evaluate_script` | Write the extracted data to `raw/<n>-<slug>.<format>` with a header comment containing the source URL and timestamp |
| Log progress | `evaluate_script` | Append the source URL, row count, and status to `extraction.log` |

#### Handling Pagination

If the page has pagination (next buttons, page numbers, infinite scroll):

1. Extract the current page's data and save to `raw/<n>-page-<p>.<format>`
2. Use `click` or `navigate_page` to go to the next page
3. Repeat until all pages are processed or a user-specified limit is reached
4. Each page's data is saved to its own file immediately — never accumulate across pages in memory

### Phase 3 — Multi-Source Parallel Extraction

When extracting from **multiple URLs or sources**, parallelize using a hidden window:

| Step | Tool | Detail |
|------|------|--------|
| Create workspace | `create_hidden_window` | Open a dedicated hidden window for extraction work — keeps the user's browsing undisturbed |
| Open batch of tabs | `new_hidden_page` | Open up to **10 tabs concurrently** within the hidden window, one per source URL |
| Extract per tab | `navigate_page` → `get_page_content` → `evaluate_script` | For each tab: navigate, extract content, parse structured data |
| Save per tab | `evaluate_script` | Write each tab's results to `raw/<n>-<slug>.<format>` immediately after extraction |
| Close tab | `close_page` | Free the tab after its data is saved |
| Next batch | — | Once a batch of 10 completes, open the next batch. Continue until all sources are processed. |
| Close workspace | `close_window` | Close the hidden window after all extraction is done |

**Concurrency rule:** Never exceed 10 open tabs at a time. Process in batches of 10, saving and closing before opening the next batch.

### Phase 4 — Merge & Format

After all raw files are saved:

1. **Read each raw file** from `raw/` using `evaluate_script`.
2. **Merge into a single output file** (`merged.csv`, `merged.json`, or `merged.md`) with:
   - Consistent column headers / keys across all sources
   - A `source_url` column so every row is traceable to its origin
   - Deduplication if the same record appears in multiple sources
3. **Write the merged file** to the output directory.
4. For large datasets, provide a summary: total rows, sources processed, any errors.

#### Output Formats

| Format | File | Notes |
|--------|------|-------|
| **CSV** | `merged.csv` | Header row, comma-separated, properly escaped. Include `source_url` as the last column. |
| **JSON** | `merged.json` | Array of objects with consistent keys. Each object includes a `source_url` field. |
| **Markdown** | `merged.md` | Aligned table with headers. Source URL in the last column. |

### Phase 5 — HTML Report

Generate a self-contained `report.html` in the output directory that serves as an index for the entire extraction.

| Requirement | Detail |
|-------------|--------|
| **Theme** | Light background (`#ffffff`), clean sans-serif typography, generous whitespace |
| **Header** | Title, date, total rows extracted, number of sources processed |
| **What was done** | Brief description of the extraction: source URLs, data fields extracted, format used |
| **File index** | Table listing every file in the output directory (`raw/*`, `merged.*`, `extraction.log`) with file paths as clickable `file://` links so the user can open them directly |
| **Data preview** | First 20 rows of the merged dataset rendered as an HTML table |
| **Source list** | All source URLs as clickable hyperlinks with the row count extracted from each |
| **Self-contained** | All styles inline or in a `<style>` block — no external dependencies |
| **Footer** | "Generated by BrowserOS Extract Data" with the current date |

Use `evaluate_script` to write the HTML file to the output directory.

### Phase 6 — Open & Notify

| Step | Tool | Detail |
|------|------|--------|
| Open report | `new_page` | Open `file://<path>/report.html` so the user sees the extraction summary |
| Notify user | — | Tell the user: extraction is complete, total rows, source count, and paths to `report.html` and `merged.<format>` |

## Tool Reference

| Category | Tools Used |
|----------|-----------|
| Window management | `create_hidden_window`, `close_window` |
| Tab management | `new_hidden_page`, `close_page`, `new_page` |
| Navigation | `navigate_page` |
| Content extraction | `get_page_content` |
| Data parsing & file I/O | `evaluate_script` |
| Interaction | `click` (for pagination) |

## Tips

- **Always ask the format first.** CSV, JSON, and Markdown have different strengths — let the user decide.
- **Save after every page.** Never hold more than one page's worth of data in memory at a time.
- **10 tabs max.** More tabs degrades performance and risks timeouts. Batch in groups of 10.
- **Record the source URL** on every row and in every raw file so data is fully traceable.
- Clean up extracted data: trim whitespace, normalize currency symbols, remove hidden characters.
- For paginated sites, check for a total count or "showing X of Y" to estimate progress.
- If a page requires login or blocks extraction, report it to the user rather than retrying silently.
