/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { afterEach, beforeEach, describe, it } from 'bun:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  createCodexChatGptFetch,
  getCodexAuthFilePath,
  getCodexStatus,
} from '../src/lib/clients/llm/codex-auth'

function createJwt(payload: object): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  )
  return `header.${encodedPayload}.signature`
}

describe('codex auth', () => {
  let tempHome: string
  let originalHome: string | undefined
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'browseros-codex-test-'))
    originalHome = process.env.HOME
    originalFetch = globalThis.fetch
    process.env.HOME = tempHome
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalHome === undefined) {
      delete process.env.HOME
    } else {
      process.env.HOME = originalHome
    }
    fs.rmSync(tempHome, { recursive: true, force: true })
  })

  it('reports missing local codex auth', async () => {
    const status = await getCodexStatus()

    assert.strictEqual(status.isAuthenticated, false)
    assert.strictEqual(status.authMode, null)
    assert.strictEqual(status.canUseChatGpt, false)
    assert.strictEqual(status.authPath, getCodexAuthFilePath())
  })

  it('reports available local chatgpt auth', async () => {
    const authPath = getCodexAuthFilePath()
    fs.mkdirSync(path.dirname(authPath), { recursive: true })
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          account_id: 'acct_123',
        },
      }),
    )

    const status = await getCodexStatus()

    assert.strictEqual(status.isAuthenticated, true)
    assert.strictEqual(status.authMode, 'chatgpt')
    assert.strictEqual(status.canUseChatGpt, true)
  })

  it('refreshes chatgpt auth on unauthorized codex response', async () => {
    const authPath = getCodexAuthFilePath()
    fs.mkdirSync(path.dirname(authPath), { recursive: true })
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: 'stale-token',
          refresh_token: 'refresh-token',
          account_id: 'acct_123',
        },
      }),
    )

    let codexRequests = 0
    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input.url

      if (url === 'https://auth.openai.com/oauth/token') {
        return new Response(
          JSON.stringify({
            access_token: 'fresh-token',
            refresh_token: 'fresh-refresh-token',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        )
      }

      if (url === 'https://chatgpt.com/backend-api/codex/responses') {
        codexRequests += 1
        const headers = new Headers(init?.headers)

        if (codexRequests === 1) {
          assert.strictEqual(headers.get('authorization'), 'Bearer stale-token')
          return new Response('unauthorized', { status: 401 })
        }

        assert.strictEqual(headers.get('authorization'), 'Bearer fresh-token')
        assert.strictEqual(headers.get('ChatGPT-Account-Id'), 'acct_123')
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      throw new Error(`Unexpected fetch URL in test: ${url}`)
    }) as typeof globalThis.fetch

    const codexFetch = createCodexChatGptFetch()
    const response = await codexFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        authorization: 'Bearer ignored-by-codex-fetch',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'gpt-5.4' }),
    })

    assert.strictEqual(response.status, 200)

    const savedAuth = JSON.parse(fs.readFileSync(authPath, 'utf8'))
    assert.strictEqual(savedAuth.tokens.access_token, 'fresh-token')
    assert.strictEqual(savedAuth.tokens.refresh_token, 'fresh-refresh-token')
  })

  it('preserves request method and body when the SDK passes a Request', async () => {
    const authPath = getCodexAuthFilePath()
    fs.mkdirSync(path.dirname(authPath), { recursive: true })
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          account_id: 'acct_123',
        },
      }),
    )

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input.url

      assert.strictEqual(url, 'https://chatgpt.com/backend-api/codex/responses')
      const request = new Request(url, init)
      assert.strictEqual(request.method, 'POST')
      assert.strictEqual(
        request.headers.get('authorization'),
        'Bearer access-token',
      )
      assert.strictEqual(request.headers.get('ChatGPT-Account-Id'), 'acct_123')
      assert.strictEqual(
        await request.text(),
        JSON.stringify({ model: 'gpt-5.4' }),
      )

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof globalThis.fetch

    const codexFetch = createCodexChatGptFetch()
    const response = await codexFetch(
      new Request('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'gpt-5.4' }),
      }),
    )

    assert.strictEqual(response.status, 200)
  })

  it('derives the chatgpt account id from the token when needed', async () => {
    const authPath = getCodexAuthFilePath()
    fs.mkdirSync(path.dirname(authPath), { recursive: true })
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        auth_mode: 'chatgpt',
        tokens: {
          access_token: createJwt({ chatgpt_account_id: 'acct_from_token' }),
          refresh_token: 'refresh-token',
        },
      }),
    )

    globalThis.fetch = (async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      const url =
        input instanceof URL
          ? input.toString()
          : typeof input === 'string'
            ? input
            : input.url

      assert.strictEqual(url, 'https://chatgpt.com/backend-api/codex/responses')
      const headers = new Headers(init?.headers)
      assert.strictEqual(headers.get('ChatGPT-Account-Id'), 'acct_from_token')

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }) as typeof globalThis.fetch

    const codexFetch = createCodexChatGptFetch()
    const response = await codexFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-5.4' }),
    })

    assert.strictEqual(response.status, 200)
  })
})
