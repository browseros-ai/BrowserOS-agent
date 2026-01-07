# @browseros-ai/agent-sdk

Browser automation SDK for BrowserOS — navigate, interact, extract data, and verify page state using natural language.

## Installation

```bash
npm install @browseros-ai/agent-sdk
# or
bun add @browseros-ai/agent-sdk
```

## Quick Start

```typescript
import { Agent } from '@browseros-ai/agent-sdk'
import { z } from 'zod'

const agent = new Agent({
  url: 'http://localhost:3000',
  llm: {
    provider: 'openai',
    apiKey: process.env.OPENAI_API_KEY,
  },
})

// Navigate to a page
await agent.nav('https://example.com')

// Perform actions with natural language
await agent.act('click the login button')

// Extract structured data
const { data } = await agent.extract('get all product names and prices', {
  schema: z.array(z.object({
    name: z.string(),
    price: z.number(),
  })),
})

// Verify page state
const { success, reason } = await agent.verify('user is logged in')
```

## API Reference

### `new Agent(options)`

Create a new agent instance.

```typescript
const agent = new Agent({
  url: string,           // BrowserOS server URL
  llm?: LLMConfig,       // Optional LLM configuration
  onProgress?: (event) => void,  // Progress callback
})
```

### `agent.nav(url, options?)`

Navigate to a URL.

```typescript
const { success } = await agent.nav('https://google.com')
```

### `agent.act(instruction, options?)`

Perform browser actions using natural language.

```typescript
// Simple action
await agent.act('click the submit button')

// With context interpolation
await agent.act('search for {{query}}', {
  context: { query: 'browseros' },
})

// Multi-step with limit
await agent.act('fill out the form and submit', {
  maxSteps: 15,
})
```

### `agent.extract(instruction, options)`

Extract structured data from the page.

```typescript
import { z } from 'zod'

const { data } = await agent.extract('get the page title', {
  schema: z.object({ title: z.string() }),
})
```

### `agent.verify(expectation, options?)`

Verify the current page state.

```typescript
const { success, reason } = await agent.verify('the form was submitted successfully')
```

## LLM Providers

Supported providers:

| Provider | Config |
|----------|--------|
| OpenAI | `{ provider: 'openai', apiKey: '...' }` |
| Anthropic | `{ provider: 'anthropic', apiKey: '...' }` |
| Google | `{ provider: 'google', apiKey: '...' }` |
| Azure | `{ provider: 'azure', apiKey: '...', resourceName: '...' }` |
| OpenRouter | `{ provider: 'openrouter', apiKey: '...' }` |
| Ollama | `{ provider: 'ollama', baseUrl: 'http://localhost:11434' }` |
| LM Studio | `{ provider: 'lmstudio', baseUrl: 'http://localhost:1234' }` |
| AWS Bedrock | `{ provider: 'bedrock', region: '...', accessKeyId: '...' }` |
| OpenAI Compatible | `{ provider: 'openai-compatible', baseUrl: '...', apiKey: '...' }` |

## Progress Events

Track agent operations:

```typescript
const agent = new Agent({
  url: 'http://localhost:3000',
  onProgress: (event) => {
    console.log(`[${event.type}] ${event.message}`)
  },
})
```

Event types: `nav`, `act`, `extract`, `verify`, `error`, `done`

## Error Handling

```typescript
import {
  NavigationError,
  ActionError,
  ExtractionError,
  VerificationError,
  ConnectionError
} from '@browseros-ai/agent-sdk'

try {
  await agent.act('click non-existent button')
} catch (error) {
  if (error instanceof ActionError) {
    console.error('Action failed:', error.message)
  }
}
```

## License

AGPL-3.0-or-later
