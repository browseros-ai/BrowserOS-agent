---
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

2. **Navigate to the starting point** using `navigate_page`.

3. **For each step in the workflow:**
   a. Take a screenshot using `save_screenshot` with a descriptive filename:
      - Pattern: `step-{number}-{description}.png`
      - Example: `step-01-login-page.png`, `step-02-enter-credentials.png`
   b. Note what action to take next
   c. Perform the action (click, fill, navigate, etc.)
   d. Wait for the page to settle (new content to load)
   e. Repeat

4. **Compile the walkthrough** as a markdown document:

### Output Format

```markdown
# Walkthrough: [Process Name]

**Date:** [current date]
**URL:** [starting URL]

## Step 1: [Action Description]
![Step 1](step-01-description.png)
Navigate to [URL]. You will see [what's on screen].

## Step 2: [Action Description]
![Step 2](step-02-description.png)
Click on [element]. [What happens next].
```

5. **Save the walkthrough** using `filesystem_write` alongside the screenshots.

## Tips

- Number steps with zero-padded digits (01, 02, ...) for correct file sorting.
- Include the browser URL bar in screenshots when the URL is relevant to the step.
- For error documentation, capture the error state and any console errors.
- If the process involves sensitive data, warn the user before capturing screenshots.
