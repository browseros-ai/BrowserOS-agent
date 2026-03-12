---
name: find-alternatives
description: Find alternative products to something the user is looking at or considering. Searches across retailers and review sites, compares options, and delivers a ranked HTML report with ratings, pricing, and direct links. Use when the user asks for alternatives, similar products, or "something like this but..."
metadata:
  display-name: Find Alternatives
  enabled: "true"
  version: "1.0"
---

# Find Alternatives

Search for alternative products across retailers and review sites, save research data incrementally to disk, rank the top 5 alternatives on a 1–5 scale, and deliver a clean HTML comparison report with direct product links.

## When to Apply

Activate when the user:

- Asks for alternatives to a product they're viewing or considering
- Says "something like this but cheaper / better / different"
- Wants to explore options before buying
- Asks "what else is out there" for a product category

## Workflow

### Phase 1 — Understand the Product

1. **Identify the reference product.** Use `get_active_page` and `get_page_content` to understand what the user is currently looking at — product name, brand, price, key features, category.
2. **Confirm with the user:**
   - **Price range** — same range, cheaper, or open budget? If unclear, default to ±30% of the reference product's price.
   - **Key criteria** — what matters most? (e.g., price, quality, brand, specific features)
   - **Any exclusions** — brands or stores to skip
3. **Create output directory.** Use `evaluate_script` to create in your working directory:
   ```
   alternatives-<product-slug>/
   ├── raw/              ← per-source research data
   ├── findings.md       ← running notes and rankings
   └── report.html       ← final HTML report
   ```

### Phase 2 — Research Alternatives

| Step | Tool | Detail |
|------|------|--------|
| Open hidden window | `create_hidden_window` | Dedicated research workspace |
| Search in parallel | `new_hidden_page` | Open up to **10 tabs** concurrently across search targets |

**Search targets** (adapt to product category):

| Tab | Target | Query |
|-----|--------|-------|
| 1 | Google Shopping | `<product category> alternatives under $<budget>` |
| 2 | Google Search | `best <product category> alternatives <year> reddit` |
| 3 | Google Search | `<product category> vs comparison <year>` |
| 4 | Amazon | `<product category>` filtered to price range |
| 5 | Walmart | `<product category>` in price range |
| 6 | Best Buy / category retailer | `<product category>` |
| 7–10 | Review sites, Reddit threads, or niche retailers relevant to the category |

For **each tab**:

| Step | Tool | Detail |
|------|------|--------|
| Navigate | `navigate_page` | Go to the search URL |
| Read results | `get_page_content` | Extract search results as markdown |
| Visit promising results | `navigate_page` | Click through to individual product pages and review articles |
| Extract data | `get_page_content` | Pull product details — name, price, features, ratings, reviews |
| **Save immediately** | `evaluate_script` | Write to `raw/<n>-<source-slug>.json` (see format below) |
| Close tab | `close_page` | Free the tab after saving |

#### Raw Data Format (`raw/<n>-<source-slug>.json`)

```json
{
  "source": "Amazon",
  "source_url": "https://www.amazon.com/...",
  "products": [
    {
      "name": "Product Name",
      "brand": "Brand",
      "product_url": "https://...",
      "price": 149.99,
      "currency": "USD",
      "rating": "4.3/5",
      "review_count": 1250,
      "key_features": ["feature 1", "feature 2"],
      "availability": "In Stock",
      "image_url": "https://..."
    }
  ],
  "extracted_at": "2025-03-11T10:30:00Z"
}
```

### Phase 3 — Rank & Synthesize

After all sources are saved:

1. **Read each raw file** from `raw/` using `evaluate_script`.
2. **Deduplicate** — the same product may appear across multiple retailers. Group by product, keep the best price.
3. **Select the top 5 alternatives** based on:
   - Price relative to budget
   - User ratings and review volume
   - Feature match to the user's criteria
   - Availability
4. **Rate each alternative 1–5** on a composite scale:

| Rating | Meaning |
|--------|---------|
| ⭐⭐⭐⭐⭐ 5 | Excellent match — great price, high ratings, strong features |
| ⭐⭐⭐⭐ 4 | Very good — minor trade-offs |
| ⭐⭐⭐ 3 | Decent — good in some areas, weaker in others |
| ⭐⭐ 2 | Fair — notable compromises |
| ⭐ 1 | Marginal — only worth considering for a specific reason |

5. **Write `findings.md`** with the full ranking, reasoning, and source references:

```markdown
# Alternatives for: <Reference Product>

**Reference price:** $X
**Budget range:** $X – $Y
**Date:** <current date>

## Top 5 Alternatives

### 1. <Product Name> — ⭐⭐⭐⭐⭐ (5/5)
- **Price:** $X at <Retailer>
- **Why:** <1–2 sentence justification>
- **Link:** <product URL>
- _Source: raw/<n>-<slug>.json_

### 2. <Product Name> — ⭐⭐⭐⭐ (4/5)
...

## Comparison vs Reference

| Feature | Reference | Alt 1 | Alt 2 | Alt 3 | Alt 4 | Alt 5 |
|---------|-----------|-------|-------|-------|-------|-------|
| Price   | $X        | $X    | $X    | $X    | $X    | $X    |
| Rating  | 4.2/5     | 4.5/5 | 4.3/5 | 4.1/5 | 3.9/5 | 4.0/5 |
```

### Phase 4 — HTML Report

Generate a self-contained `report.html` in the output directory:

| Requirement | Detail |
|-------------|--------|
| **Theme** | Light background (`#ffffff`), clean sans-serif typography, generous whitespace |
| **Header** | "Alternatives for: <Product Name>", date, budget range |
| **Reference product card** | Show the original product with its price, rating, and link as the baseline |
| **Top 5 cards** | Each alternative as a card showing: rank, name, rating (star visualization), price, key features, and a clickable "View Product" link to the actual product page |
| **Comparison table** | Side-by-side table with the reference product and all 5 alternatives — price, rating, key features, pros/cons |
| **Rating explanation** | Brief note on how the 1–5 rating was determined |
| **Product links** | Every product name and "View Product" button must be a clickable `<a href>` to the actual product URL |
| **Source references** | Footer section listing all sources consulted with links |
| **Self-contained** | All styles in a `<style>` block — no external CSS or JS |
| **Responsive** | Readable on desktop and mobile |
| **Footer** | "Generated by BrowserOS Find Alternatives" with date |

Use `evaluate_script` to write the HTML file.

### Phase 5 — Open & Notify

| Step | Tool | Detail |
|------|------|--------|
| Close hidden window | `close_window` | Clean up the research workspace |
| Open report | `new_page` | Open `file://<path>/report.html` in the user's active window |
| Notify user | — | Summarize the top pick, mention the report path, and highlight any standout findings |

## Tool Reference

| Category | Tools Used |
|----------|-----------|
| Page info | `get_active_page` |
| Window management | `create_hidden_window`, `close_window` |
| Tab management | `new_hidden_page`, `close_page`, `new_page` |
| Navigation | `navigate_page` |
| Content extraction | `get_page_content` |
| Data & file I/O | `evaluate_script` |

## Tips

- **Save after every source.** Never accumulate all research data in memory.
- **10 tabs max** at a time. Batch if there are more sources.
- **Deduplicate across retailers** — the same product on Amazon and Walmart should appear once with the best price noted.
- If the reference product is niche, broaden the search to the general category rather than exact alternatives.
- Include at least one budget option and one premium option to give the user a range.
- If a product has very few reviews (<50), note the low confidence in the rating.
