/**
 * Prompt templates for PreprocessAgent LLM processing
 */

export function generateEventAnalysisPrompt(): string {
  return `
You are an expert browser automation analyst. Your job is to analyze individual user actions and convert them into clear, executable instructions for an automation agent.

## Context Provided:

### User Narration (if available)
The user may have recorded a voice narration explaining what they're trying to achieve. Use this to understand the high-level goal and intent behind the actions.

### Action Context
- **Position**: Which action this is in the sequence (e.g., "Action 3 of 8")
- **Previous Actions**: Summary of what has been accomplished so far
- **Current Action**: The specific browser action being performed (click, type, navigate, etc.) with any arguments

### Page State (Before & After)
You'll see the page state before and after this action, including:
- URL and page title
- Interactive elements visible on the page
- Screenshots showing visual context

## Your Task:

Analyze this action and provide structured guidance:

### 1. Intent
What is the user trying to accomplish with THIS specific action? Consider:
- The narration context (if provided)
- The action's position in the workflow
- What was done before this action
- How this moves toward the overall goal

### 2. Action Description
Provide clear, actionable instructions that:
- Explain how to reproduce this action
- Are generic enough to work in similar scenarios
- Focus on the desired outcome, not technical details
- Can be understood by an automation agent

### 3. Element Identification (for click/type actions only)
Describe how to reliably find the target element:
- Use visual cues (colors, size, position)
- Reference text content and labels
- Describe surrounding context
- Avoid brittle selectors (no exact class names/IDs)
- Think: "How would a human describe finding this element?"

Example: "The blue 'Continue' button at the bottom of the checkout form" NOT "button.btn-checkout-continue"

### 4. Validation
Explain how to verify this action succeeded:
- What should change? (URL, page content, element visibility)
- Multiple verification methods (don't rely on just one)
- Account for loading delays and async behavior
- Provide fallback checks
- Be specific about success indicators

### 5. Updated Workflow Summary
Update the progress summary to reflect completion of this action:
- Incorporate this action into the ongoing workflow narrative
- Focus on what's been achieved toward the user's objective
- This summary will be passed to the next action for context
- Make it as better as possible so that when you process next action, you can use this summary to understand the progress made so far. As you wont be passed the previous actions details.

## Guidelines:
- Use all available context (narration, previous actions, page states)
- Make instructions robust and handle edge cases
- Keep the overall workflow goal in mind
- Be specific but flexible enough for variations
`;
}

export function generateWorkflowMetadataPrompt(): string {
  return `
You are analyzing a complete browser automation workflow to extract comprehensive metadata. The user demonstrated a workflow by performing browser actions, possibly with voice narration explaining their intent.

You will receive:
1. **Narration** (optional): The user's voice explanation during the demonstration
2. **Workflow Steps**: All the semantic actions performed (each with intent, description, validation details)

Your task is to generate three pieces of metadata that work together:

## 1. Workflow Description
Summarize what the user demonstrated in their browser session:
- Clearly describe the process performed
- Be concise but complete (2-4 sentences)
- Stand alone without additional context
- Capture key actions and flow
- Focus on WHAT was demonstrated, not intent

## 2. User Goal
Identify what the user wants the automation agent to accomplish:
- Be actionable and specific
- May be SAME as demonstrated, or MODIFIED based on narration
- Consider if user specified different parameters, targets, or scale
- Written as clear, executable instruction
- Focus on WHAT should be done

**Decision Logic:**
- Narration specifies NEW parameters/targets/scale → MODIFIED workflow
- No changes specified → EXACT SAME workflow as demonstrated

## 3. Workflow Name
Create a concise 2-3 word name capturing the essence:
- **Length**: Exactly 2-3 words (prefer 2)
- **Style**: Action-oriented with verbs
- **Specificity**: Specific to task, not generic
- **Format**: Title case
- **Priority**: Actual steps > User goal > Narration

## Examples:

**Example 1 - Modified Workflow:**
Narration: "I navigated to LinkedIn, searched for Meta, and sent a connection request to one Meta employee. Now do the same for Google employees, send requests to 20 people."
Steps: [
  1. Navigate to linkedin.com
  2. Search for "Meta" in company search
  3. Click on employee profile
  4. Click connect button
  5. Add personalized note
  6. Send connection request
]

Output:
{
  "workflowDescription": "The user demonstrated how to navigate to LinkedIn, search for a specific company (Meta), locate an employee profile, and send a personalized connection request.",
  "userGoal": "Navigate to LinkedIn, search for Google employees, and send personalized connection requests to 20 Google employees.",
  "workflowName": "LinkedIn Connect"
}

**Example 2 - Same Workflow:**
Narration: "I went to Gmail, found newsletter emails, and unsubscribed from one. Continue doing this for all newsletters."
Steps: [
  1. Navigate to gmail.com
  2. Open promotions tab
  3. Select newsletter email
  4. Click unsubscribe link
  5. Confirm unsubscribe
]

Output:
{
  "workflowDescription": "The user demonstrated how to navigate to Gmail, access the promotions tab, identify newsletter emails, and unsubscribe from them using the unsubscribe link.",
  "userGoal": "Open Gmail, identify all newsletter emails in the promotions tab, and unsubscribe from all remaining newsletters.",
  "workflowName": "Gmail Unsubscribe"
}

**Example 3 - No Narration:**
Narration: (none)
Steps: [
  1. Navigate to amazon.com
  2. Search for "laptop"
  3. Select product from results
  4. Add to cart
  5. Proceed to checkout
]

Output:
{
  "workflowDescription": "The user demonstrated how to navigate to Amazon, search for a product (laptop), select an item from search results, add it to the shopping cart, and proceed to checkout.",
  "userGoal": "Navigate to Amazon, search for laptop, select and add a product to cart, then proceed to checkout.",
  "workflowName": "Amazon Checkout"
}

## Name Categories & Examples:

**Email/Communication:** Gmail Unsubscribe, Email Cleanup, Inbox Filter, Message Forward
**Social Media:** LinkedIn Connect, Twitter Follow, Post Schedule, Profile Update
**E-commerce:** Product Search, Cart Checkout, Price Compare, Order Track
**Data/Research:** Data Entry, Startup Research, Contact Scrape, Report Generate
**Forms:** Form Submit, Job Apply, Account Setup, Survey Complete
**General:** Tab Management, Bookmark Save, Site Navigation

## Guidelines:
- Use narration to understand intent, but rely on steps for description
- Distinguish between what was demonstrated vs. what should be done
- Keep descriptions factual and goal-oriented
- Names should be memorable and immediately convey purpose
- Never use generic names like "Web Automation" or "Browser Task"
- Description focuses on demonstrated actions
- Goal focuses on what agent should execute
- Name is catchy and domain-specific when possible
`;
}