// ===== SIMPLE PARSING FUNCTIONS =====
// Ultra-simple regex patterns that work 99% of the time
// Matches format: "- Reasoning: content" or "- Proposed Actions: content"

export function parseReasoning(output: string): string {
  const lowerOutput = output.toLowerCase();

  // Find reasoning section start (newline + any chars + reasoning)
  const reasoningMatch = lowerOutput.match(/.*?action.*?reasoning.*?/i);
  if (!reasoningMatch) return "";

  const startIndex = reasoningMatch.index! + reasoningMatch[0].length;

  // Find exact next section names with flexible formatting
  const nextSections = [
    /\n.*?proposed.*?actions?.*?/i,
    /\n.*?todo.*?markdown.*?/i,
    /\n.*?task.*?complete.*?/i,
    /\n.*?final.*?answer.*?/i
  ];

  let endIndex = output.length;
  for (const sectionPattern of nextSections) {
    const match = lowerOutput.slice(startIndex).match(sectionPattern);
    if (match && match.index !== undefined) {
      const actualIndex = startIndex + match.index;
      if (actualIndex < endIndex) {
        endIndex = actualIndex;
      }
    }
  }

  return output.slice(startIndex, endIndex).trim();
}

export function parseProposedActions(output: string): string {
  const lowerOutput = output.toLowerCase();

  // Find proposed actions section start (newline + any chars + proposed actions)
  const actionsMatch = lowerOutput.match(/\n.*?proposed.*?actions?.*?/i);
  if (!actionsMatch) return "";

  const startIndex = actionsMatch.index! + actionsMatch[0].length;

  // Find exact next section names with flexible formatting
  const nextSections = [
    /\n.*?todo.*?markdown.*?/i,
    /\n.*?task.*?complete.*?/i,
    /\n.*?final.*?answer.*?/i
  ];

  let endIndex = output.length;
  for (const sectionPattern of nextSections) {
    const match = lowerOutput.slice(startIndex).match(sectionPattern);
    if (match && match.index !== undefined) {
      const actualIndex = startIndex + match.index;
      if (actualIndex < endIndex) {
        endIndex = actualIndex;
      }
    }
  }

  return output.slice(startIndex, endIndex).trim();
}

export function parseTaskComplete(output: string): boolean {
  const lowerOutput = output.toLowerCase();

  // Find task complete section start (newline + any chars + task complete)
  const taskMatch = lowerOutput.match(/\n.*?task.*?complete.*?/i);
  if (!taskMatch) return false;

  const startIndex = taskMatch.index! + taskMatch[0].length;

  // Find next section (only final answer comes after task complete)
  const nextSections = [
    /\n.*?final.*?answer.*?/i
  ];

  let endIndex = output.length;
  for (const sectionPattern of nextSections) {
    const match = lowerOutput.slice(startIndex).match(sectionPattern);
    if (match && match.index !== undefined) {
      const actualIndex = startIndex + match.index;
      if (actualIndex < endIndex) {
        endIndex = actualIndex;
      }
    }
  }

  const value = output.slice(startIndex, endIndex).trim().toLowerCase();
  return value.includes('true') || value.includes('yes') || value.includes('complete');
}

export function parseFinalAnswer(output: string): string {
  const lowerOutput = output.toLowerCase();

  // Find final answer section start (newline + any chars + final answer)
  const finalMatch = lowerOutput.match(/\n.*?final.*?answer.*?/i);
  if (!finalMatch) return "";

  const startIndex = finalMatch.index! + finalMatch[0].length;

  // Final answer is always last section, so take everything to end
  return output.slice(startIndex).trim();
}

export function parseTodoMarkdown(output: string): string {
  const lowerOutput = output.toLowerCase();

  // Find todo markdown section start (newline + any chars + todo markdown)
  const todoMatch = lowerOutput.match(/\n.*?todo.*?markdown.*?/i);
  if (!todoMatch) return "";

  const startIndex = todoMatch.index! + todoMatch[0].length;

  // Find exact next section names with flexible formatting
  const nextSections = [
    /\n.*?proposed.*?actions?.*?/i,
    /\n.*?task.*?complete.*?/i,
    /\n.*?final.*?answer.*?/i
  ];

  let endIndex = output.length;
  for (const sectionPattern of nextSections) {
    const match = lowerOutput.slice(startIndex).match(sectionPattern);
    if (match && match.index !== undefined) {
      const actualIndex = startIndex + match.index;
      if (actualIndex < endIndex) {
        endIndex = actualIndex;
      }
    }
  }

  return output.slice(startIndex, endIndex).trim();
}

// Removed parseAllTodosComplete - using unified Task Complete now

export function parseSummary(output: string): string {
  // For execution history summary, return cleaned output
  return output.trim();
}