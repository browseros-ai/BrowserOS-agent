# BrowserOS Agent Evaluation System

## Overview

Consolidated evaluation system for the BrowserOS agent, supporting both online (runtime) and offline (test script) evaluations. Uses Braintrust's latest SDK patterns with `initLogger` for production logging.

## Directory Structure

```
src/evals/
├── online/              # Online evaluation infrastructure
│   ├── BraintrustEventCollector.ts  # Event collection
│   ├── decorators.ts                # @track decorators
│   ├── EvalSettings.ts              # Settings management
│   ├── enable.ts                  # Enable eval mode
│   └── disable.ts                 # Disable eval mode
│
├── offline/             # Offline test suites
│   └── tools/                       # Tool-specific unit tests
│       ├── planner/                 # Planner tool
│       └── validator/               # Validator tool
│
└── shared/              # Shared utilities
    └── push-prompts.ts            # Extract prompts to JSON (Planned)
```

## Quick Start

### Online Evaluations (Configuration Only)

**⚠️ Currently configuration-only. Data collection requires integration with BrowserAgent.**

```bash
# Enable evaluation mode (sets up configuration only)
npm run eval:enable

# Disable when done
npm run eval:disable
```

**Note:** These scripts currently only save/clear settings. No actual data collection occurs until the system is integrated with BrowserAgent.

### Offline Evaluations (Existing)

Run standalone test suites:

```bash
# Tool-specific tests
npm run eval:planner     # Test planner tool
npm run eval:validator   # Test validator tool

# Extract prompts for version control
npm run extract:prompts
```

## Configuration

### Online Evaluation Settings

Set in browser console or environment:
```javascript
// API Key (required)
localStorage.setItem('BRAINTRUST_API_KEY', 'your-key')

// Enable/disable
localStorage.setItem('BROWSEROS_EVAL_MODE', 'true')
```

### Offline Test Configuration

Configured in test case JSON files:
```
offline/tools/planner/test-cases.json
offline/tools/validator/test-cases.json
```

## NPM Scripts

```json
{
  "scripts": {
    // Online evaluation
    "eval:enable": "tsx src/evals/online/enable.ts",
    "eval:disable": "tsx src/evals/online/disable.ts",
    
    // Offline tests
    "eval:planner": "tsx src/evals/offline/tools/planner/planner.eval.ts",
    "eval:validator": "tsx src/evals/offline/tools/validator/validator.eval.ts",
    
    // Utilities
    "extract:prompts": "tsx src/evals/shared/push-prompts.ts"
  }
}
```

## Implementation Status

### ✅ Phase 1: Infrastructure (COMPLETE - Updated)
- Online event collection using `initLogger` ✅
- Proper parent/child span relationships ✅
- Automatic LLM tracking with `wrapOpenAI` ✅
- Braintrust SDK handles all batching ✅
- Secure API key handling via `SecureEventCollectorProxy` ✅
- Settings management with privacy controls ✅

### ⚠️ Phase 2: Integration (PENDING)
- Connect to BrowserAgent
- Pass parent span IDs through execution
- **This is required for data collection to work**

### 📊 Phase 3: Analysis (FUTURE)
- Query Braintrust data
- Generate metrics

### 💬 Phase 4: User Feedback (FUTURE)
- UI for user ratings
- Ground truth collection

## Current State

**⚠️ IMPORTANT:** The evaluation system is currently **configuration-only**. Data collection will not work until Phase 2 (Integration) is completed.

- ✅ Enable/disable scripts work (save/clear settings)
- ✅ Configuration system is functional
- ❌ **No actual data collection** (not integrated with agent)
- ❌ **No event tracking** (decorators not applied to agent methods)

## Best Practices

1. **Online**: Enable only when needed (performance impact)
2. **Offline**: Run before commits to catch regressions
3. **Privacy**: Never log sensitive user data
4. **Versioning**: Extract prompts after changes

## Troubleshooting

### Online Eval Not Working?
```javascript
// Check if enabled
console.log(localStorage.getItem('BROWSEROS_EVAL_MODE'))

// Check API key
console.log(localStorage.getItem('BRAINTRUST_API_KEY'))
```

### Offline Tests Failing?
```bash
# Check OpenAI API key
echo $OPENAI_API_KEY

# Run with debug output
DEBUG=* npm run eval:planner
```

## Next Steps

1. **For developers**: Run offline tests before PRs
2. **For integration**: Complete Phase 2 to enable data collection
3. **For analysis**: Query Braintrust dashboard for insights (after integration)

## Integration Required

To make online evaluations functional, you need to:

1. **Add decorators to BrowserAgent methods:**
   ```typescript
   import { track, trackLLM } from '@/evals/online/decorators'
   
   class BrowserAgent {
     @track('agent_execution')
     async execute(task: string) {
       // Your existing logic
     }
   }
   ```

2. **Initialize event collector in constructor:**
   ```typescript
   constructor() {
     this.eventCollector = BraintrustEventCollector.getInstance()
   }
   ```

3. **Set up session tracking in execute method**
