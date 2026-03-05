import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { fetchMcpTools } from './client'

function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = []

  return new Promise((resolve, reject) => {
    req.on('data', (chunk) => {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

describe('fetchMcpTools', () => {
  let originalFunction: FunctionConstructor

  beforeEach(() => {
    originalFunction = globalThis.Function
  })

  afterEach(() => {
    globalThis.Function = originalFunction
  })

  it('lists tools without compiling output schemas', async () => {
    const requests: string[] = []
    let initialized = false

    const server = createServer(async (req, res) => {
      if (req.method === 'GET') {
        res.writeHead(405)
        res.end()
        return
      }

      const message = JSON.parse(await readBody(req)) as {
        id?: string | number
        method: string
      }
      requests.push(message.method)

      if (message.method === 'initialize') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'mcp-session-id': 'test-session',
        })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              protocolVersion: '2025-03-26',
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: 'test-server',
                version: '1.0.0',
              },
            },
          }),
        )
        return
      }

      if (message.method === 'notifications/initialized') {
        initialized = true
        res.writeHead(202)
        res.end()
        return
      }

      if (message.method === 'tools/list') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
        })
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [
                {
                  name: 'browser_list_tabs',
                  description: 'List tabs',
                  inputSchema: {
                    type: 'object',
                  },
                  outputSchema: {
                    type: 'object',
                    properties: {
                      ok: {
                        type: 'boolean',
                      },
                    },
                  },
                },
              ],
            },
          }),
        )
        return
      }

      res.writeHead(500)
      res.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })

    try {
      globalThis.Function = (() => {
        throw new Error('blocked')
      }) as unknown as FunctionConstructor

      const { port } = server.address() as AddressInfo
      const tools = await fetchMcpTools(`http://127.0.0.1:${port}/mcp`)

      expect(tools).toEqual([
        {
          name: 'browser_list_tabs',
          description: 'List tabs',
        },
      ])
      expect(initialized).toBe(true)
      expect(requests).toEqual([
        'initialize',
        'notifications/initialized',
        'tools/list',
      ])
    } finally {
      globalThis.Function = originalFunction
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    }
  })
})
