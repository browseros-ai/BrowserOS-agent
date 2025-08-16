# Online Evaluation System

## Overview

Production-ready event collection system for BrowserOS agent using Braintrust's latest SDK patterns. Uses `initLogger` for production logging with automatic batching and proper parent/child span relationships.

**⚠️ CURRENT STATUS:** Infrastructure complete. Integration with BrowserAgent required for data collection.

## Core Components

```
src/evals/online/
├── BraintrustEventCollector.ts  # Main event collector using initLogger
├── decorators.ts                 # Method decorators with parent/child spans
├── EvalSettings.ts              # Settings management with privacy controls
├── enable.ts                    # Script to enable eval mode
└── disable.ts                   # Script to disable eval mode
```

## Key Features

- **Proper SDK Usage**: Uses `initLogger` (not `init`) for production logging
- **Automatic LLM Tracking**: `wrapOpenAI` for zero-config LLM instrumentation
- **Natural Span Lifecycle**: Short-lived spans that complete naturally
- **SDK-Managed Batching**: Braintrust SDK handles all batching internally
- **Parent/Child Tracing**: Proper trace hierarchies via `span.export()`
- **Secure API Keys**: `SecureEventCollectorProxy` for production use
- **Privacy Controls**: Configurable data sanitization
- **Performance Optimized**: Zero overhead when disabled

## Quick Start

### 1. Set up API keys (securely)

```bash
# For development only - production should use secure context
export BRAINTRUST_API_KEY=your-api-key
export OPENAI_API_KEY=your-openai-key
```

### 2. Enable evaluation mode

```bash
npm run eval:enable
```

### 3. Use the extension

Events will be collected once BrowserAgent integration is complete.

### 4. Disable when done

```bash
npm run eval:disable
```

## Usage in BrowserAgent

### Production Integration (Recommended)

```typescript
// Use SecureEventCollectorProxy for production to protect API keys
import { SecureEventCollectorProxy } from '@/evals/online/SecureAPIKeyHandler'

export class BrowserAgent {
  private eventCollector: SecureEventCollectorProxy
  private parentSpanId?: string  // Track parent for child spans
  
  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
    // Use proxy in production, direct collector in dev
    this.eventCollector = process.env.NODE_ENV === 'production' 
      ? SecureEventCollectorProxy.getInstance()
      : BraintrustEventCollector.getInstance()
  }
  
  async execute(task: string) {
    // Define sessionId first so it's available for endSession
    const sessionId = crypto.randomUUID()
    
    // Start session and get parent ID
    const { parent } = await this.eventCollector.startSession({
      sessionId,
      task,
      timestamp: Date.now()
    })
    
    // Store parent for child spans
    this.parentSpanId = parent
    
    try {
      // Track key decisions as child spans
      await this.eventCollector.logEvent({
        type: 'decision_point',
        name: 'classification',
        data: { is_simple: true }
      }, { parent })
      
      // Execute task...
      
      // End session with correct signature (parent, sessionId, result)
      await this.eventCollector.endSession(parent, sessionId, {
        success: true,
        summary: 'Task completed'
      })
    } catch (error) {
      await this.eventCollector.endSession(parent, sessionId, {
        success: false,
        error: error.message
      })
    }
  }
}
```

### Using Wrapped OpenAI Client

```typescript
// Get pre-wrapped OpenAI client with automatic tracking
const openai = this.eventCollector.openai

// Use normally - all LLM calls are automatically tracked
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [...]
})

// Automatically tracks:
// - Prompts and completions
// - Token usage
// - Model name
// - Latency
// - Streaming responses
```

### Using Decorators

```typescript
import { track, trackTool, trackBrowserAction } from '@/evals/online/decorators'

class MyAgent {
  parentSpanId?: string  // Store parent for decorators
  
  @track('agent_execution')
  async execute(task: string) {
    // Automatically tracked with parent/child spans
  }
  
  @trackTool('navigation')
  async navigateToUrl(url: string) {
    // Tool execution tracked
  }
  
  @trackBrowserAction('click')
  async clickElement(selector: string) {
    // Browser action tracked
  }
}
```

## Next Steps

1. **Complete Integration**: Add collector to BrowserAgent
2. **Test Data Flow**: Verify events appear in Braintrust
3. **Add User Feedback**: Collect thumbs up/down ratings
4. **Build Dashboard**: Query and visualize collected data