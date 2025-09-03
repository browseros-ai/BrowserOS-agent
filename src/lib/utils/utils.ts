/**
 * Parse potentially double-encoded JSON tool results.
 * Handles the common pattern where tool outputs are JSON-stringified twice.
 * 
 * @param toolResult - The string result from a tool
 * @returns Parsed object with 'output' field properly decoded
 * 
 * @example
 * // Double-encoded JSON
 * jsonParseToolOutput('{"ok":true,"output":"{\\"data\\":123}"}')
 * // Returns: { ok: true, output: { data: 123 } }
 * 
 * // Plain string output
 * jsonParseToolOutput('{"ok":true,"output":"Hello"}')
 * // Returns: { ok: true, output: "Hello" }
 * 
 * // Already parsed object
 * jsonParseToolOutput('{"ok":true,"output":{"data":123}}')
 * // Returns: { ok: true, output: { data: 123 } }
 */
export function jsonParseToolOutput(toolResult: string): any {
  // First parse - required for all tool outputs
  const parsed = JSON.parse(toolResult);
  
  // If output exists and is a string, try parsing it as JSON
  if (parsed.output && typeof parsed.output === 'string') {
    try {
      parsed.output = JSON.parse(parsed.output);
    } catch {
      // Keep as string if not valid JSON (e.g., plain text messages)
    }
  }
  
  return parsed;
}