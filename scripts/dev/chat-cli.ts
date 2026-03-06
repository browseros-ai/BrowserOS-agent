#!/usr/bin/env bun
/**
 * Chat CLI - Send a chat request to the HTTP Agent Server
 *
 * Usage:
 *   bun --env-file=.env.dev tests/agent-cli.ts "your message here"
 *   bun --env-file=.env.dev tests/agent-cli.ts --provider=openai --model=gpt-4o "your message here"
 *
 * Options:
 *   --provider  AI provider (default: browseros)
 *   --model     Model name (default: default)
 *   --port      Server port (default: $BROWSEROS_SERVER_PORT or 9100)
 *   --system-prompt  Custom system prompt to append
 *   --show-full-output  Show full tool output (default: truncated to 50 chars)
 */

interface ChatRequest {
  conversationId: string
  message: string
  provider: string
  model: string
  apiKey?: string
  userSystemPrompt?: string
}

function parseArgs(): {
  message: string
  provider: string
  model: string
  port: string
  userSystemPrompt?: string
  showFullOutput: boolean
} {
  const args = process.argv.slice(2)
  let provider = 'browseros'
  let model = 'default'
  let port = process.env.BROWSEROS_SERVER_PORT || '9100'
  let showFullOutput = false
  let userSystemPrompt: string | undefined
  let message = ''

  for (const arg of args) {
    if (arg.startsWith('--provider=')) {
      provider = arg.split('=')[1]
    } else if (arg.startsWith('--model=')) {
      model = arg.split('=')[1]
    } else if (arg.startsWith('--port=')) {
      port = arg.split('=')[1]
    } else if (arg.startsWith('--system-prompt=')) {
      userSystemPrompt = arg.split('=').slice(1).join('=')
    } else if (arg === '--show-full-output') {
      showFullOutput = true
    } else if (!arg.startsWith('--')) {
      message = arg
    }
  }

  if (!message) {
    console.error('Usage: bun scripts/dev/chat-cli.ts [options] "your message"')
    console.error('Options:')
    console.error(
      '  --provider=<provider>  AI provider (anthropic, openai, google, etc.)',
    )
    console.error('  --model=<model>        Model name')
    console.error(
      '  --port=<port>          Server port (default: $BROWSEROS_SERVER_PORT or 9100)',
    )
    console.error('  --system-prompt=<prompt>  Custom system prompt to append')
    console.error(
      '  --show-full-output     Show full tool output (default: truncated)',
    )
    process.exit(1)
  }

  return { message, provider, model, port, userSystemPrompt, showFullOutput }
}

function truncateOutput(obj: unknown, maxLen = 50): unknown {
  if (typeof obj === 'string') {
    return obj.length > maxLen ? `${obj.slice(0, maxLen)}...` : obj
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => truncateOutput(item, maxLen))
  }
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = truncateOutput(value, maxLen)
    }
    return result
  }
  return obj
}

interface StreamEvent {
  type: string
  delta?: string
  output?: unknown
  [key: string]: unknown
}

function handleTextEvent(event: StreamEvent): boolean {
  if (event.type === 'text-start') {
    process.stdout.write('\n💬 ')
    return true
  }
  if (event.type === 'text-delta') {
    process.stdout.write(event.delta ?? '')
    return true
  }
  if (event.type === 'text-end') {
    process.stdout.write('\n\n')
    return true
  }
  return false
}

function formatEventForOutput(
  event: StreamEvent,
  showFullOutput: boolean,
): StreamEvent {
  if (!showFullOutput && event.type === 'tool-output-available') {
    return { ...event, output: truncateOutput(event.output) }
  }
  return event
}

function processSSELine(line: string, showFullOutput: boolean): void {
  if (!line.trim() || !line.startsWith('data: ')) return

  const data = line.slice(6)
  if (data === '[DONE]') {
    console.log('\n--- Done ---\n')
    return
  }

  try {
    const event: StreamEvent = JSON.parse(data)
    if (handleTextEvent(event)) return
    console.log(
      JSON.stringify(formatEventForOutput(event, showFullOutput), null, 2),
    )
  } catch {
    console.log(data)
  }
}

async function chat(config: {
  message: string
  provider: string
  model: string
  port: string
  userSystemPrompt?: string
  showFullOutput: boolean
}) {
  const conversationId = crypto.randomUUID()

  const request: ChatRequest = {
    conversationId,
    message: config.message,
    provider: config.provider,
    model: config.model,
    userSystemPrompt: config.userSystemPrompt,
  }

  console.log('\n--- Request ---')
  console.log(JSON.stringify(request, null, 2))
  console.log('\n--- Response Stream ---\n')

  const response = await fetch(`http://127.0.0.1:${config.port}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error(`HTTP ${response.status}: ${error}`)
    process.exit(1)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    console.error('No response body')
    process.exit(1)
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      processSSELine(line, config.showFullOutput)
    }
  }
}

const config = parseArgs()
chat(config).catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
