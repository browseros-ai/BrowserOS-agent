---
name: compare-prices
description: Search for a product across multiple retailers and compare prices, availability, and shipping. Use when the user asks to compare prices, find the best deal, or check prices across stores.
metadata:
  display-name: Compare Prices
  enabled: "true"
  version: "1.0"
---

# Compare Prices

## When to Use

Activate when the user asks to compare prices for a product, find the cheapest option, check if a price is good, or shop across multiple stores.

## Steps

1. **Clarify the product.** Get from the user:
   - Product name or description
   - Specific model/variant if applicable
   - Any retailer preferences or exclusions

2. **Search across retailers.** Open parallel tabs using `new_hidden_page` for each retailer:
   - Search the product on each retailer's website
   - Navigate to the most relevant product page
   - Extract: product name, price, availability, shipping cost, seller/condition

3. **Extract pricing data** from each tab using `get_page_content` or `evaluate_script`:
   - Regular price and sale/discounted price
   - Shipping cost (free or amount)
   - Availability (in stock, limited, out of stock)
   - Seller (direct vs third-party)

4. **Close research tabs** using `close_page` after extracting data.

5. **Present comparison:**

### Output Format

```
## Price Comparison: [Product Name]

**Date:** [current date]

| Retailer | Price | Shipping | Total | Stock | Notes |
|----------|-------|----------|-------|-------|-------|
| [name]   | $X.XX | Free     | $X.XX | In stock | [notes] |
| [name]   | $X.XX | $X.XX    | $X.XX | In stock | [notes] |

### Best Deal
**[Retailer]** at **$X.XX** (total with shipping)
```

## Tips

- Always compare total price (product + shipping).
- Note whether it's sold by the retailer or a third-party marketplace seller.
- Check for membership discounts (Amazon Prime, Walmart+).
- If the product has variants (sizes, colors), ensure you're comparing the same variant.
- Mention if any retailer has a price-match guarantee.
