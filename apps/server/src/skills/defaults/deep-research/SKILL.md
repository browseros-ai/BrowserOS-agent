---
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
   - Use `new_hidden_page` to open a search engine or known source
   - Use `navigate_page` to search or go to the source URL
   - Use `get_page_content` to extract relevant content
   - Close the tab with `close_page` when done

4. **Extract and organize findings.** From each source, pull out:
   - Key facts and data points
   - Expert opinions or recommendations
   - Consensus and disagreements across sources
   - Source credibility indicators

5. **Synthesize into a report.**

### Output Format

```
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
```

## Tips

- Use 4-6 sources for balanced coverage. More isn't always better.
- Prioritize recent sources — check publication dates.
- Note disagreements between sources rather than hiding them.
- If researching products, include pricing and availability.
- For technical topics, prefer official documentation and peer-reviewed sources.
