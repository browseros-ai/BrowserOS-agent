const BROWSER_WORKFLOW_PATTERNS = [
  /\b(compose|draft|write|send)\b.*\b(email|mail)\b/i,
  /\b(email|mail)\b.*\b(compose|draft|write|send)\b/i,
]

export function isBrowserWorkflowQuery(text: string) {
  return BROWSER_WORKFLOW_PATTERNS.some((pattern) => pattern.test(text))
}
