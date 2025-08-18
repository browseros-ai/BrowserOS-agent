export const refreshStateToolDescription = `🚨 EMERGENCY DIAGNOSTIC TOOL - LAST RESORT ONLY 🚨

Retrieves EXHAUSTIVE browser state with FULL DOM details for debugging stuck automation.

⚠️ WHEN TO USE (ALL conditions must be met):
1. You've tried the same action 2-3 times and it keeps failing
2. Element finding or interaction is consistently failing
3. The page seems completely different than expected
4. You genuinely cannot proceed without understanding the full page structure

❌ DO NOT USE FOR:
- Routine state checks (tools already get fresh state internally)
- After simple navigation (wasteful and slow)
- First attempts at finding elements (try normal methods first)
- Regular task execution (unnecessary overhead)

✅ USE ONLY WHEN:
- Multiple consecutive "element not found" errors on the same element
- interact_tool repeatedly fails despite element seeming to exist
- You suspect hidden elements, shadow DOM, or complex CSS is blocking you
- Debugging why automation is completely stuck

📊 RETURNS:
- Complete DOM tree with ALL attributes
- Computed styles for elements
- Form states and values
- Hidden element properties
- Shadow DOM contents
- Frame/iframe information

⚡ PERFORMANCE WARNING:
This tool is computationally expensive and returns massive amounts of data.
Only use when absolutely necessary to diagnose blocking issues.

Remember: If you're using this tool frequently, something is wrong with your approach.`;