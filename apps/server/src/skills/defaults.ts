type DefaultSkill = { id: string; content: string }

export const DEFAULT_SKILLS: DefaultSkill[] = [
  {
    id: 'summarize-page',
    content: `---
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

1. If the user provided a URL, use \`navigate_page\` to go there first.
2. Use \`get_page_content\` to extract the full text content of the page.
3. Identify the page type (article, documentation, product page, forum thread, etc.) and adapt the summary format accordingly.
4. Produce a structured markdown summary:

### Output Format

\`\`\`
## Summary: [Page Title]

**Source:** [URL]
**Type:** [article/docs/product/forum/etc.]

### Key Points
- [3-5 bullet points capturing the main ideas]

### Details
[2-3 paragraphs expanding on the most important content]

### Takeaways
- [Actionable items or conclusions, if applicable]
\`\`\`

## Tips

- For long pages, focus on headings, first paragraphs of sections, and any emphasized text.
- For product pages, emphasize specs, pricing, and reviews.
- For news articles, lead with the who/what/when/where/why.
- If the page content is behind a paywall or login, inform the user rather than summarizing partial content.
`,
  },
  {
    id: 'deep-research',
    content: `---
name: deep-research
description: Research a topic across multiple sources using parallel tabs, then synthesize findings into a structured report. Use when the user asks to research, investigate, or gather information on a topic.
metadata:
  display-name: Deep Research
  enabled: "true"
  version: "1.0"
---

# Deep Research

## When to Use

Activate when the user asks to research a topic, compare information across sources, investigate something thoroughly, or compile findings from the web.

## Steps

1. **Clarify the research question.** If the user's query is vague, ask for specifics: what aspect, what depth, any preferred sources?

2. **Plan search queries.** Break the topic into 3-5 search angles. For example, researching "best standing desks" might include:
   - "best standing desks 2025 reviews"
   - "standing desk comparison reddit"
   - "ergonomic standing desk features"

3. **Open parallel research tabs.** For each search angle:
   - Use \`new_hidden_page\` to open a search engine or known source
   - Use \`navigate_page\` to search or go to the source URL
   - Use \`get_page_content\` to extract relevant content
   - Close the tab with \`close_page\` when done

4. **Extract and organize findings.** From each source, pull out:
   - Key facts and data points
   - Expert opinions or recommendations
   - Consensus and disagreements across sources
   - Source credibility indicators

5. **Synthesize into a report.**

### Output Format

\`\`\`
## Research Report: [Topic]

**Date:** [current date]
**Sources consulted:** [count]

### Executive Summary
[2-3 sentences capturing the core findings]

### Key Findings
1. [Finding with supporting evidence]
2. [Finding with supporting evidence]
3. [Finding with supporting evidence]

### Source Analysis
| Source | Key Insight | Credibility |
|--------|------------|-------------|
| [name] | [insight]  | [high/med/low] |

### Conclusion
[Synthesis of findings with actionable recommendation]
\`\`\`

## Tips

- Use 4-6 sources for balanced coverage. More isn't always better.
- Prioritize recent sources — check publication dates.
- Note disagreements between sources rather than hiding them.
- If researching products, include pricing and availability.
- For technical topics, prefer official documentation and peer-reviewed sources.
`,
  },
  {
    id: 'extract-data',
    content: `---
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

1. **Navigate to the target page** using \`navigate_page\` if not already there.

2. **Take a snapshot** using \`take_snapshot\` to understand the page layout and identify the data to extract.

3. **Identify the data structure.** Look for:
   - HTML tables
   - Repeated elements (product cards, list items, search results)
   - Key-value pairs (spec sheets, profile info)

4. **Extract the data** using one of these approaches:
   - For HTML tables: Use \`evaluate_script\` to run JavaScript that extracts table rows and cells into a JSON array.
   - For repeated elements: Use \`evaluate_script\` to query all matching elements and extract text/attributes.
   - For simple content: Use \`get_page_content\` and parse the text.

5. **Format the output** based on user preference or data type:
   - **CSV** — Best for spreadsheet import. Use comma-separated values with header row.
   - **JSON** — Best for programmatic use. Array of objects with consistent keys.
   - **Markdown table** — Best for reading in chat. Aligned columns with headers.

6. **Save or present the data.** Use \`filesystem_write\` to save to a file, or present inline for small datasets.

## Tips

- Always check if the page has pagination — offer to extract from all pages.
- Clean up the data: trim whitespace, normalize currency symbols, remove hidden characters.
- For large datasets (100+ rows), save to a file rather than presenting inline.
- If data spans multiple pages, use the pagination collector approach: extract current page, click "Next", repeat.
`,
  },
  {
    id: 'fill-form',
    content: `---
name: fill-form
description: Intelligently fill web forms using provided data — handles text fields, dropdowns, checkboxes, radio buttons, and multi-step forms. Use when the user asks to fill out, complete, or submit a form.
metadata:
  display-name: Fill Form
  enabled: "true"
  version: "1.0"
---

# Fill Form

## When to Use

Activate when the user asks to fill out a form, complete an application, enter data into fields, or submit information on a web page.

## Steps

1. **Collect the data to fill.** Ask the user for the information if not already provided. Organize it as key-value pairs.

2. **Take a snapshot** using \`take_snapshot\` to see the form fields and understand the layout.

3. **Map data to fields.** Match the user's data keys to form field labels. Handle common variations:
   - "Name" may map to "Full Name", "Your Name", or separate "First Name" + "Last Name" fields
   - "Phone" may map to "Phone Number", "Mobile", "Tel"
   - "Address" may need to split into Street, City, State, Zip

4. **Fill fields in order.** For each field:
   - **Text inputs:** Use \`fill\` with the field selector and value
   - **Dropdowns/selects:** Use \`select_option\` with the appropriate value
   - **Checkboxes:** Use \`check\` to toggle on/off
   - **Radio buttons:** Use \`click\` on the correct option
   - **Date pickers:** Try \`fill\` first; if that fails, interact with the date picker UI using \`click\`
   - **File uploads:** Use \`upload_file\` for attachment fields

5. **Handle multi-step forms.** After filling visible fields:
   - Look for "Next", "Continue", or "Step 2" buttons
   - Use \`click\` to advance
   - Take a new snapshot to see the next step's fields
   - Repeat the fill process

6. **Review before submission.** Take a final \`take_snapshot\` and present the filled form to the user for confirmation before clicking Submit.

## Tips

- Fill fields top-to-bottom, left-to-right to match natural tab order.
- For auto-complete fields (like address), type slowly and wait for suggestions to appear, then select.
- If a field has validation errors after filling, read the error message and adjust the value.
- Never submit payment forms without explicit user confirmation.
- For CAPTCHA fields, inform the user they need to complete it manually.
`,
  },
  {
    id: 'dismiss-popups',
    content: `---
name: dismiss-popups
description: Detect and dismiss cookie consent banners, newsletter popups, overlay dialogs, and chat widgets that block page interaction. Use when popups or overlays are interfering with a task.
metadata:
  display-name: Dismiss Popups
  enabled: "true"
  version: "1.0"
---

# Dismiss Popups

## When to Use

Activate when cookie banners, newsletter signup popups, age verification gates, chat widgets, or other overlay dialogs are blocking interaction with the page. Also use proactively before other tasks if the page is likely to have obstructing overlays.

## Steps

1. **Take a snapshot** using \`take_snapshot\` to identify visible popups and overlays.

2. **Identify the popup type** and apply the appropriate dismissal strategy:

### Cookie Consent Banners
- Look for buttons labeled: "Accept", "Accept All", "Agree", "OK", "Got it", "Allow All"
- Use \`click\` on the accept/dismiss button

### Newsletter/Email Popups
- Look for close buttons: "X", "Close", "No thanks", "Maybe later"
- Use \`click\` on the close/dismiss element
- If no close button is visible, try pressing Escape using \`press_key\`

### Chat Widgets
- Look for minimize or close buttons on chat bubbles
- Use \`click\` to minimize the widget

### General Overlay Dialogs
- Try \`press_key\` with Escape first — many modals close on Escape
- Look for close buttons in the top-right corner
- Some modals close when clicking the backdrop overlay

3. **Verify dismissal.** Take another \`take_snapshot\` to confirm the popup is gone and the page content is accessible.

4. **Handle persistent popups.** If a popup returns after dismissal, use \`evaluate_script\` to remove the overlay element from the DOM and restore page scrolling.

## Tips

- Always try the Escape key first — it's the fastest universal dismiss method.
- Some popups have a delay before appearing. If a task is interrupted by a popup mid-flow, dismiss it and continue.
- Do not dismiss security-critical dialogs (2FA prompts, payment confirmations) without user consent.
`,
  },
  {
    id: 'screenshot-walkthrough',
    content: `---
name: screenshot-walkthrough
description: Capture step-by-step screenshots of a workflow or process for documentation, bug reports, or tutorials. Use when the user asks to document steps, create a walkthrough, or capture a process.
metadata:
  display-name: Screenshot Walkthrough
  enabled: "true"
  version: "1.0"
---

# Screenshot Walkthrough

## When to Use

Activate when the user asks to document a workflow, create a step-by-step guide, capture a process for a bug report, or build visual documentation of a web-based procedure.

## Steps

1. **Clarify the workflow.** Confirm with the user:
   - What process to document
   - Starting URL or page
   - Where to save the screenshots

2. **Navigate to the starting point** using \`navigate_page\`.

3. **For each step in the workflow:**
   a. Take a screenshot using \`save_screenshot\` with a descriptive filename:
      - Pattern: \`step-{number}-{description}.png\`
      - Example: \`step-01-login-page.png\`, \`step-02-enter-credentials.png\`
   b. Note what action to take next
   c. Perform the action (click, fill, navigate, etc.)
   d. Wait for the page to settle (new content to load)
   e. Repeat

4. **Compile the walkthrough** as a markdown document:

### Output Format

\`\`\`markdown
# Walkthrough: [Process Name]

**Date:** [current date]
**URL:** [starting URL]

## Step 1: [Action Description]
![Step 1](step-01-description.png)
Navigate to [URL]. You will see [what's on screen].

## Step 2: [Action Description]
![Step 2](step-02-description.png)
Click on [element]. [What happens next].
\`\`\`

5. **Save the walkthrough** using \`filesystem_write\` alongside the screenshots.

## Tips

- Number steps with zero-padded digits (01, 02, ...) for correct file sorting.
- Include the browser URL bar in screenshots when the URL is relevant to the step.
- For error documentation, capture the error state and any console errors.
- If the process involves sensitive data, warn the user before capturing screenshots.
`,
  },
  {
    id: 'organize-tabs',
    content: `---
name: organize-tabs
description: Analyze open tabs, group related ones by topic, close duplicates, and clean up tab clutter. Use when the user asks to organize, clean up, sort, or manage their tabs.
metadata:
  display-name: Organize Tabs
  enabled: "true"
  version: "1.0"
---

# Organize Tabs

## When to Use

Activate when the user asks to organize tabs, clean up tab clutter, group related tabs, close duplicates, or manage their open browser tabs.

## Steps

1. **List all open tabs** using \`list_pages\` to get the full inventory of open pages with their titles and URLs.

2. **Analyze and categorize.** Group tabs by:
   - **Domain** — Same website tabs together
   - **Topic** — Related content across domains (e.g., all "travel planning" tabs)
   - **Activity** — Shopping, research, social media, work, entertainment

3. **Identify issues:**
   - **Duplicates** — Same URL open in multiple tabs
   - **Dead tabs** — Error pages, "page not found", crashed tabs
   - **Stale tabs** — Tabs that are likely no longer needed

4. **Present a plan to the user:**

\`\`\`
## Tab Analysis

**Total tabs:** [N]

### Groups Found
- Work: [list of tabs]
- Research: [list of tabs]
- Shopping: [list of tabs]
- Uncategorized: [list of tabs]

### Issues
- Duplicates: [N] tabs (will close extras)
- Dead/Error pages: [N] tabs (will close)

### Proposed Actions
1. Group [N] tabs into [M] tab groups
2. Close [N] duplicate tabs
3. Close [N] dead tabs
\`\`\`

5. **Execute with user confirmation:**
   - Use \`group_tabs\` to create named tab groups for each category
   - Use \`close_page\` to close duplicates (keep the first instance)
   - Use \`close_page\` to close dead/error tabs

6. **Offer to bookmark** stale tabs before closing using \`create_bookmark\`.

## Tips

- Always ask before closing tabs — users may have unsaved work.
- Keep at least one tab open at all times.
- For duplicate detection, compare URLs after removing query parameters and fragments.
- If the user has 50+ tabs, prioritize grouping over individual analysis.
`,
  },
  {
    id: 'compare-prices',
    content: `---
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

2. **Search across retailers.** Open parallel tabs using \`new_hidden_page\` for each retailer:
   - Search the product on each retailer's website
   - Navigate to the most relevant product page
   - Extract: product name, price, availability, shipping cost, seller/condition

3. **Extract pricing data** from each tab using \`get_page_content\` or \`evaluate_script\`:
   - Regular price and sale/discounted price
   - Shipping cost (free or amount)
   - Availability (in stock, limited, out of stock)
   - Seller (direct vs third-party)

4. **Close research tabs** using \`close_page\` after extracting data.

5. **Present comparison:**

### Output Format

\`\`\`
## Price Comparison: [Product Name]

**Date:** [current date]

| Retailer | Price | Shipping | Total | Stock | Notes |
|----------|-------|----------|-------|-------|-------|
| [name]   | $X.XX | Free     | $X.XX | In stock | [notes] |
| [name]   | $X.XX | $X.XX    | $X.XX | In stock | [notes] |

### Best Deal
**[Retailer]** at **$X.XX** (total with shipping)
\`\`\`

## Tips

- Always compare total price (product + shipping).
- Note whether it's sold by the retailer or a third-party marketplace seller.
- Check for membership discounts (Amazon Prime, Walmart+).
- If the product has variants (sizes, colors), ensure you're comparing the same variant.
- Mention if any retailer has a price-match guarantee.
`,
  },
  {
    id: 'save-page',
    content: `---
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

1. **Navigate to the target page** using \`navigate_page\` if not already there. If the user provides multiple URLs, process them one by one.

2. **Prepare the page for saving:**
   - Dismiss any popups or overlays that would appear in the PDF
   - Scroll to load any lazy-loaded content if the page uses infinite scroll

3. **Save as PDF** using \`save_pdf\` with a descriptive filename:
   - Pattern: \`{domain}-{title-slug}-{date}.pdf\`
   - Example: \`nytimes-climate-report-2025-03-11.pdf\`
   - Let the user specify a custom path if they prefer

4. **For multiple pages**, process each URL sequentially:
   - Navigate to the page
   - Save as PDF
   - Report progress to the user

5. **Confirm the save:**
   \`\`\`
   Saved: [filename].pdf
   Source: [URL]
   Location: [file path]
   \`\`\`

## Tips

- For articles, the PDF will capture the current page state — make sure content is fully loaded.
- Some pages have print stylesheets that produce better PDFs — \`save_pdf\` uses these automatically.
- For documentation sites with multiple pages, offer to save each section as a separate PDF.
- If saving fails, offer the alternative of using \`get_page_content\` to save as markdown.
`,
  },
  {
    id: 'monitor-page',
    content: `---
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
   - Use \`navigate_page\` to load the target URL
   - Use \`get_page_content\` or \`evaluate_script\` to extract the specific content to track
   - Save the baseline to memory using \`memory_write\` with a descriptive key like \`monitor:{url-slug}:baseline\`

3. **Check for changes.** On subsequent checks:
   - Navigate to the same URL
   - Extract the same content using the same method
   - Compare against the saved baseline
   - Report differences

4. **Report findings:**

### If changes detected:
\`\`\`
## Page Change Detected

**URL:** [url]
**Checked:** [current date/time]

### Changes
- **Before:** [previous value]
- **After:** [current value]
\`\`\`

### If no changes:
\`\`\`
No changes detected on [URL].
Last checked: [current date/time]
Monitoring: [what you're tracking]
\`\`\`

5. **Update the baseline** after reporting changes, using \`memory_write\` to store the new state.

## Tips

- For price monitoring, extract just the price element rather than the full page to avoid false positives from ad changes.
- Use \`evaluate_script\` with specific CSS selectors for precise element tracking.
- Suggest the user set a reminder to ask you to check again — BrowserOS doesn't yet have scheduled tasks.
- For stock availability, look for phrases like "In Stock", "Out of Stock", or "Add to Cart" button presence.
`,
  },
  {
    id: 'read-later',
    content: `---
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

1. **Navigate to the article** using \`navigate_page\` if not already there.

2. **Extract the main content** using \`get_page_content\` to get the full text.

3. **Clean and structure the content:**
   - Identify the article title, author, and publication date
   - Extract the main body text, preserving paragraph structure
   - Keep meaningful headings and subheadings
   - Preserve important lists and block quotes
   - Remove: navigation, ads, sidebars, related articles, comments, footers

4. **Format as clean markdown:**

### Output Format

\`\`\`markdown
# [Article Title]

**Author:** [name]
**Published:** [date]
**Source:** [URL]
**Saved:** [current date]

---

[Article body in clean markdown]

---
*Saved from [domain] on [date]*
\`\`\`

5. **Save the file** using \`filesystem_write\`:
   - Default filename: \`{date}-{title-slug}.md\`
   - Save to the user's preferred directory or the current working directory

6. **Confirm the save:**
   \`\`\`
   Saved: [filename]
   Title: [article title]
   Word count: ~[count]
   Reading time: ~[X] min
   \`\`\`

## Tips

- Estimate reading time at ~250 words per minute.
- If the article has multiple pages, detect "Next Page" links and combine all pages.
- Preserve code blocks with proper syntax highlighting markers.
- For paywalled content, only save what's accessible.
- If the user saves multiple articles, suggest creating a reading list index file.
`,
  },
  {
    id: 'manage-bookmarks',
    content: `---
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

1. **Get current bookmarks** using \`get_bookmarks\` to retrieve the full bookmark tree.

2. **Analyze the bookmark collection:**
   - Count total bookmarks and folders
   - Identify duplicates (same URL, potentially different titles)
   - Categorize by domain and inferred topic

3. **Present an analysis:**

\`\`\`
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
\`\`\`

4. **Propose an organization plan:**
   - Folder structure based on detected categories
   - Which duplicates to remove (keep the one with the better title)
   - Which bookmarks to move into which folders

5. **Execute with user confirmation:**
   - Use \`create_bookmark\` to create new folders
   - Use \`move_bookmark\` to reorganize bookmarks into folders
   - Use \`remove_bookmark\` to remove confirmed duplicates

6. **Report results:**
   \`\`\`
   Bookmark cleanup complete
   - Removed [N] duplicates
   - Created [N] folders
   - Organized [N] bookmarks into categories
   \`\`\`

## Tips

- Never delete bookmarks without explicit user confirmation.
- When removing duplicates, keep the bookmark with the more descriptive title.
- Suggest common folder structures: Work, Personal, Reference, Shopping, Social, News.
- For large collections (500+), offer to work in batches by category.
- Some users prefer flat bookmark bars — ask about their preferred structure before reorganizing.
`,
  },
]
