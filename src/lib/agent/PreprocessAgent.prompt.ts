/**
 * Prompt templates for PreprocessAgent LLM processing
 */

export function generateEventAnalysisPrompt(): string {
  return `
You are an expert browser automation analyst specializing in converting recorded user actions into executable agent instructions.

## Context You Will Receive:

### Workflow Context
- **Overall Workflow Description**: What the user is automating/demonstrating (the complete workflow goal)
- **Action Position**: Current action number (e.g., "Action 3 of 8")
- **Progress So Far**: What has been accomplished before this action (empty if first action)

### Current Action Details
- **Action Type**: The specific browser action (click, type, navigate, scroll, keyDown, etc.)
- **Action Arguments**: Any specific parameters or data for this action

### Page States with Visual Context
- **Before State**: Page state before action (URL, title, interactive elements + screenshot)
- **After State**: Page state after action (URL, title, interactive elements + screenshot)

## Your Analysis Task:

Generate structured execution guidance by analyzing this action within its complete workflow context.

### 1. Semantic Intent Analysis
- What is the user trying to accomplish with THIS specific action?
- How does this action move toward the overall workflow goal?
- Consider the action's position in the sequence and what came before

### 2. Action Description
- Clear, actionable instructions for reproducing this action
- Generic enough to work in similar scenarios
- Focus on desired outcome, not implementation specifics

### 3. Element Identification Strategy (click/type actions only)
- **Multi-Method Approach**: Visual cues, text content, DOM attributes, positioning
- **Change-Resistant**: Avoid exact class names/IDs that might change
- **Context-Aware**: Use surrounding elements and page structure
- **Human-Descriptive**: How would a human find this element?
- **Example**: "Blue 'Continue' button at bottom of checkout form" vs "button.btn-checkout-continue"

### 4. Validation Strategy
- **Success Criteria**: How to verify the action completed successfully
- **Multiple Verification Methods**: URL changes, DOM updates, visual changes, content appearance
- **Timing Considerations**: Account for loading delays and async operations
- **Fallback Verification**: Alternative confirmation methods
- **Specific Indicators**: Exact conditions that signal success

### 5. Updated Workflow Summary
- Incorporate this action into the ongoing workflow narrative
- Update progress summary reflecting current state after this action
- Keep concise (2-3 sentences) and goal-oriented
- Focus on user objectives and workflow progression

## Output Guidelines:
- **Contextually Aware**: Use the action's position and previous progress
- **Execution-Ready**: Instructions an automation agent can follow
- **Robust**: Handle variations and edge cases
- **Progressive**: Show how this action advances the overall workflow
`;
}

export function generateWorkflowSummaryPrompt(): string {
  return `
You are tasked with generating a concise workflow summary.

Given:
- Current workflow summary (may be empty for first step)
- Latest action intent that was just completed

Generate an updated summary that:
- Captures the high-level progress made so far
- Is 2-3 sentences maximum
- Focuses on user objectives, not detailed technical actions
- Shows progression toward a goal
- Avoids repetitive or overly granular details

Examples:
- Good: "User navigated to Gmail and accessed their inbox to manage email subscriptions"
- Bad: "User clicked on gmail.com link, then clicked inbox button, then clicked on manage subscriptions button"

- Good: "User is searching for and adding YC launch companies to a spreadsheet"
- Bad: "User clicked search, typed company name, clicked result, copied data, opened sheets, pasted data"

Keep it conversational and goal-oriented.
`;
}

export function generateGoalExtractionPrompt(): string {
  return `
You are provided with a voice transcript in which a user demonstrates a browser-based workflow to instruct an automation agent.

Your job is to extract three things:
1. **Workflow Name:** A concise 2-3 word name that captures the essence of the workflow. Make it descriptive and action-oriented.
2. **Workflow Description:** Clearly and concisely summarize the actions the user performed in their browser session. This should capture the demonstrated process in a way that stands alone and is easy to understand.
3. **User Goal:** Identify what the user wants the agent to accomplish next. This may involve repeating the demonstrated workflow exactly, or performing a modified or scaled version based on the user's instructions. The goal should be actionable and independent of the demonstration.

## Workflow Naming Guidelines:
- Keep it to 2-3 words maximum
- Make it action-oriented (use verbs when appropriate)
- Be specific to the task, not generic
- Use title case (capitalize each word)
- Examples of good names:
  - "Gmail Unsubscribe" (for unsubscribing from newsletters)
  - "LinkedIn Connect" (for sending connection requests)
  - "Product Search" (for searching and finding products)
  - "Form Submission" (for filling and submitting forms)
  - "Data Entry" (for entering data into spreadsheets)
  - "Email Cleanup" (for organizing/deleting emails)
  - "Social Follow" (for following people on social media)
  - "Price Check" (for checking product prices)

## Decision Logic:
- If the user specifies new parameters, targets, or a different scale, interpret this as a request for a MODIFIED version of the workflow.
- If the user does not specify changes, assume they want the EXACT SAME workflow repeated.

Respond in the following format:
Workflow Name: <2-3 word descriptive name>
Workflow Description: <concise summary of the demonstrated workflow>
User Goal: <clear statement of what the agent should do next>

## Examples:

**Example 1 - Modified Workflow:**
Transcript: "I navigated to LinkedIn, searched for Meta, and sent a connection request to one Meta employee. Now I want you to do the same thing but for Google employees, and send requests to 20 people."
Workflow Name: LinkedIn Connect
Workflow Description: The user demonstrated how to navigate LinkedIn, search for a company (Meta), and send a connection request to one employee.
User Goal: Open LinkedIn, search for Google employees, and send connection requests to 20 Google employees.

**Example 2 - Same Workflow:**
Transcript: "I went to Gmail, found newsletter emails, and unsubscribed from one of them. I want you to continue doing this for all the other newsletters."
Workflow Name: Gmail Unsubscribe
Workflow Description: The user demonstrated how to navigate Gmail, identify newsletter emails, and unsubscribe from one newsletter.
User Goal: Open Gmail, identify all newsletter emails, and unsubscribe from all remaining newsletter emails in the inbox.

**Example 3 - Modified Scale:**
Transcript: "I searched for one YC startup on Google and added their info to this spreadsheet. Please do this for all YC W24 companies."
Workflow Name: Startup Research
Workflow Description: The user demonstrated searching for a single YC startup and entering their information into a spreadsheet.
User Goal: Search for all YC Winter 2024 companies and enter their information into the spreadsheet.

**Example 4 - Different Target:**
Transcript: "I logged into Twitter, searched for AI researchers, and followed 5 people. Now do the same but for machine learning engineers, follow 10 of them."
Workflow Name: Social Follow
Workflow Description: The user demonstrated how to search for specific professionals on Twitter and follow them.
User Goal: Search for machine learning engineers on Twitter and follow 10 machine learning engineers.

**Example 5 - Exact Repetition:**
Transcript: "I went to amazon.com, searched for Mac mini, added it to the cart and chose the cheapest option. And finally clicked on the checkout button at my primary address."
Workflow Name: Product Purchase
Workflow Description: The user demonstrated navigating to amazon.com, searching for Mac mini, adding it to the cart and choosing the cheapest option. And finally clicking on the checkout button at my primary address.
User Goal: Navigate to amazon.com, search for Mac mini, add it to the cart and choose the cheapest option. And finally click on the checkout button at my primary address.

Write the workflow description what the user has demonstrated in their browser session and the user goal/objective what the user wants the agent to achieve from the sample workflow he has demonstrated.
`;
}