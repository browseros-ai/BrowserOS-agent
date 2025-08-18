# ChatAgent Design Document

## Overview
ChatAgent is a lightweight, specialized agent designed for immediate Q&A interactions with web pages. Unlike BrowserAgent which handles complex multi-step automation tasks, ChatAgent focuses on extracting page content once and providing direct answers to user questions.

## Core Philosophy
- **Two-pass design** - Pass 1 without tools (<400ms), Pass 2 with tools only if needed
- **Immediate answers** - No planning, no classification, no task decomposition
- **Minimal tools** - Just 3 essential tools for Q&A (screenshot, scroll, refresh)
- **Page context first** - Extract page content once, use for entire conversation
- **Simple prompts** - Direct and focused system prompts without complex instructions
- **Stream-first** - Direct streaming to UI without "thinking" states

## Architecture

### Class Structure
```typescript
class ChatAgent {
  private static readonly MAX_TURNS = 20
  private static readonly TOOLS = ['screenshot_tool','scroll_tool','refresh_browser_state_tool']

  constructor(private executionContext: ExecutionContext) {
    this.toolManager = new ToolManager(executionContext)
    this._registerTools()
  }

  async execute(query: string): Promise<void> {
    this._ensureAbortable()

    const ctx = await this._extractPageContext()              // token-aware
    const system = generateChatSystemPrompt(ctx)              // compact, per-tab caps

    this._initializeChat(system, query)

    const msg1 = await this._stream({ tools: false })         // fast path
    if (this._shouldStopAfterPass1(msg1)) return

    this.messageManager.addSystemReminder('Enabling tools for visual/scroll context.')
    const msg2 = await this._stream({ tools: true })
    if (msg2.tool_calls?.length) await this._processTools(msg2.tool_calls)
  }

  // … helpers use EventProcessor in no-thinking mode, abort checks, and tool special-cases
}
```

### Execution Flow (Two-Pass Design)
```
User Query
    ↓
Get Selected Tabs (single or multiple)
    ↓
Extract Page Context from All Tabs
    ↓
Initialize Chat Session with Context
    ↓
Pass 1: Stream Direct Answer (NO TOOLS) ← Target <400ms
    ↓
[If confident answer] → Complete
    ↓
Pass 2: Stream with Tools Enabled
    ↓
Process Minimal Tools
    ↓
Complete
```

The two-pass approach ensures ultra-fast first response by:
1. **Pass 1**: Direct LLM streaming without tool binding overhead
2. **Pass 2**: Only if needed, enable minimal tools for enhanced answers

### Key Differences from BrowserAgent

| Aspect | BrowserAgent | ChatAgent |
|--------|-------------|-----------|
| Purpose | Complex automation tasks | Simple Q&A about pages |
| Classification | Yes - simple vs complex | None |
| Planning | Multi-step plans | None |
| Tool Count | 15+ tools | 3 tools |
| Validation | Task completion validation | None |
| TODO Management | Full tracking | None |
| Message History | Complex with reminders | Simple conversation |
| Max Iterations | 100+ | 20 |
| Error Recovery | Re-planning on failure | Simple error message |

## Implementation Details

### Performance Optimization Strategy
The two-pass design optimizes for ultra-fast first response:

**Pass 1 Performance Characteristics:**
- No tool binding overhead (~50-100ms saved)
- No tool schema validation
- Direct LLM streaming
- Target: First token in <400ms

**Pass 2 (Only when needed):**
- Minimal tool set (3 tools only)
- Selective tool execution
- Smart caching of page context

### 1. Tool Registration
ChatAgent only registers essential tools:
- `screenshot_tool` - Capture visual information when needed
- `scroll_tool` - Navigate page to access more content
- `refresh_browser_state_tool` - Get updated browser state when needed

### 2. Page Context Extraction
```typescript
// Support for both single and multi-tab extraction
// NTN -- don't add anything else here -- let's implement clean simple design first.
interface ExtractedPageContext {
  tabs: Array<{
    id: number
    url: string
    title: string
    text: string
  }>
  isSingleTab: boolean
}

private async _extractPageContext(): Promise<ExtractedPageContext> {
  // Get selected tab IDs from execution context
  const selectedTabIds = this.executionContext.getSelectedTabIds()
  const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0)
  
  // Get browser pages (similar to GetSelectedTabsTool)
  const pages = await this.executionContext.browserContext.getPages(
    hasUserSelectedTabs && selectedTabIds ? selectedTabIds : undefined
  )
  
  // Compute per-tab token budget to keep system prompt small
  const perTabTokenBudget = this._computePerTabTokenBudget(pages.length)
  
  // Extract content from each tab (similar to ExtractTool logic)
  const tabs = await Promise.all(
    pages.map(async page => {
      const textSnapshot = await page.getTextSnapshot()
      const text = textSnapshot.sections?.map(section => 
        section.content || section.text || ''
      ).join('\n') || 'No content found'
      
      // Token-aware truncation for compact context
      const truncated = this._truncateToTokens(text, perTabTokenBudget)
      
      return {
        id: page.tabId,
        url: page.url(),
        title: await page.title(),
        text: truncated
        // NTN -- don't need clickables, typables
      }
    })
  )
  
  return {
    tabs,
    isSingleTab: tabs.length === 1
  }
}
    
```

### 3. System Prompt Design
The system prompt is minimal and focused:
```typescript
export function generateChatSystemPrompt(pageContext: ExtractedPageContext): string {
  if (pageContext.isSingleTab) {
    const tab = pageContext.tabs[0]
    return `You are a helpful assistant that answers questions about the current webpage.

## Current Page
URL: ${tab.url}
Title: ${tab.title}

## Page Content
${tab.text}

## Instructions
1. Answer the user's question directly based on the page content
2. Be concise and accurate
3. Use screenshot_tool for visual information
4. Use scroll_tool if content is below the fold
5. Just answer - no planning or task management

You're in Q&A mode. Provide direct answers.`
  } else {
    // Multi-tab prompt
    return `You are a helpful assistant that answers questions about multiple webpages.

## Open Tabs (${pageContext.tabs.length} tabs)
${pageContext.tabs.map((tab, index) => `
### Tab ${index + 1} - ${tab.title}
URL: ${tab.url}
Content: ${tab.text}
`).join('\n')}

## Instructions
1. Answer questions by analyzing content from all tabs
2. Specify which tab information comes from when relevant
3. Compare/contrast information across tabs when appropriate
4. Be concise and accurate
5. Just answer - no planning or task management

You're in Q&A mode for multiple tabs. Provide direct answers.`
  }
}
```

### 4. Two-Pass Execution Strategy
```typescript
async execute(query: string): Promise<void> {
  // Extract context once (fast, local operation)
  const pageContext = await this._extractPageContext()
  const system = generateChatSystemPrompt(pageContext)
  this._initializeChat(system, query)

  // Pass 1: Direct answer without tools (target <400ms)
  const answer1 = await this._streamLLM({ tools: false })
  
  // Optional: Check if answer is confident/complete
  if (this._isConfident(answer1)) {
    return  // Done - achieved <400ms response
  }

  // Pass 2: Try again with minimal tools if needed
  const answer2 = await this._streamLLM({ tools: true })
  if (answer2.tool_calls) {
    await this._processMinimalTools(answer2.tool_calls)
  }
}

private async _streamLLM(opts: { tools: boolean }): Promise<AIMessage> {
  const llm = await this.executionContext.getLLM()
  
  // Only bind tools in Pass 2
  const llmToUse = opts.tools 
    ? llm.bindTools(this.toolManager.getAll())
    : llm
  
  const stream = await llmToUse.stream(this.messageManager.getMessages())
  
  // Direct streaming - no "thinking" phase
  for await (const chunk of stream) {
    // Emit chunk to UI under ChatAgent label (no thinking UI)
    // this.eventEmitter.streamAnswer?.(chunk.content)
  }
  
  return accumulatedMessage
}

private _isConfident(message: AIMessage): boolean {
  // Default: Pass 1 is final unless answer explicitly requests visual/scroll context
  const content = (message.content as string || '').toLowerCase()
  const needsView = /(cannot see|can\'t see|scroll|screenshot|image|below the fold|need to view)/.test(content)
  return !needsView
}

private async _processMinimalTools(toolCalls: any[]): Promise<void> {
  // Process tools but handle screenshots specially to avoid token bloat
  for (const toolCall of toolCalls) {
    const tool = this.toolManager.get(toolCall.name)
    if (!tool) continue

    if (toolCall.name === 'screenshot_tool') {
      // Emit screenshot to UI but store only placeholder in message history
      const result = await tool.func(toolCall.args)
      this.eventEmitter.emitToolResult('screenshot_tool', result)
      this.messageManager.addTool('{"ok":true,"output":"Screenshot captured"}', toolCall.id)
    } else if (toolCall.name === 'refresh_browser_state_tool') {
      // Add simplified tool result and attach browser state context
      const result = await tool.func(toolCall.args)
      try {
        const parsed = JSON.parse(result)
        const simplified = JSON.stringify({ ok: parsed.ok, output: parsed.ok ? 'Browser state refreshed successfully' : 'Refresh failed' })
        this.messageManager.addTool(simplified, toolCall.id)
        if (parsed.ok && parsed.output) this.messageManager.addBrowserState(parsed.output)
      } catch {
        this.messageManager.addTool(result, toolCall.id)
      }
    } else {
      // Normal tool processing for scroll/refresh
      const result = await tool.func(toolCall.args)
      this.messageManager.addTool(result, toolCall.id)
    }
  }
}
```

## Integration Points

### 1. NxtScape Routing
```typescript
// NxtScape.ts
public async run(options: RunOptions) {
  if (this.executionContext.isChatMode()) {
    const chatAgent = new ChatAgent(this.executionContext)
    await chatAgent.execute(query)
  } else {
    await this.browserAgent.execute(query)
  }
}
```

### 2. ExecutionContext Extension
```typescript
// ExecutionContext.ts
private chatMode: boolean = false

setChatMode(enabled: boolean): void {
  this.chatMode = enabled
}

isChatMode(): boolean {
  return this.chatMode
}
```

### 3. Frontend Integration
```typescript
// settingsStore.ts
interface Settings {
  // ... existing settings
  chatMode: boolean  // New setting for chat mode
}

// Header.tsx or SettingsModal.tsx
<Toggle 
  label="Chat Mode (Q&A)" 
  checked={chatMode}
  onChange={setChatMode}
/>
```

## Testing Strategy

### Unit Tests (ChatAgent.test.ts)
1. **Agent Creation**
   - Verify only chat tools are registered (screenshot, scroll, refresh_browser_state)
   - Verify tool manager has exactly 3 tools

2. **Context Extraction - Single Tab**
   - Mock single tab with getPages returning one page
   - Verify extraction calls getTextSnapshot
   - Verify context includes tab info

3. **Context Extraction - Multiple Tabs**  
   - Mock multiple tabs with getPages returning array
   - Verify extraction from all tabs
   - Verify prompt handles multiple tabs correctly

4. **Message Management**
   - Verify simple system prompt generation
   - Verify no TODO reminders added
   - Verify no classification messages

5. **Error Handling**
   - Verify graceful handling when no tabs available
   - Verify abort signal handling

### Integration Tests (ChatAgent.integration.test.ts)
1. **Single Tab Q&A Flow**
   - Mock page with known content
   - Ask question about content
   - Verify direct answer without planning
   - Verify no classification or validator tools called

2. **Multi-Tab Q&A Flow**
   - Mock 3 tabs with different content
   - Ask comparison question across tabs
   - Verify answer references multiple tabs
   - Verify correct tab attribution

3. **Tool Usage**
   - Verify screenshot_tool can be called
   - Verify scroll_tool can be called
   - Verify refresh_browser_state_tool can be called
   - Verify planner_tool is NOT available

## Benefits
1. **Performance** - No classification/planning overhead
2. **Simplicity** - Focused single-purpose implementation
3. **User Experience** - Immediate responses for simple questions
4. **Maintainability** - Clean separation from complex automation logic
5. **Token Efficiency** - Minimal context, no complex prompts
6. **Multi-Tab Support** - Can answer questions across multiple tabs simultaneously

## Future Enhancements
1. **Multi-turn conversations** - Allow follow-up questions
2. **Context refresh** - Option to re-extract page on demand
3. **Smart tool selection** - Auto-detect when visual context needed
4. **Response caching** - Cache answers for repeated questions
5. **Markdown formatting** - Better formatting for code/tables in pages

## Migration Path
1. Phase 1: Implement ChatAgent alongside BrowserAgent
2. Phase 2: Add UI toggle for chat mode
3. Phase 3: Auto-detect Q&A vs automation tasks
4. Phase 4: Unified agent with mode switching

## Success Metrics
- **Primary Goal: First response < 400ms** (Pass 1, no tools)
- 80% of queries answered in Pass 1 without tools
- Token usage 50% less than BrowserAgent for Q&A
- No planning/classification overhead
- Direct answers without intermediate steps
- Pass 2 (with tools) only for ~20% of queries needing visual/dynamic content
