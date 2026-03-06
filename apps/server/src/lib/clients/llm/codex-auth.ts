/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createOpenAI } from '@ai-sdk/openai'
import type { LLMAuthMode } from '@browseros/shared/schemas/llm'
import { z } from 'zod'

const CODEX_AUTH_ISSUER = 'https://auth.openai.com'
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const CODEX_RESPONSES_URL = 'https://chatgpt.com/backend-api/codex/responses'
const BROWSEROS_ORIGINATOR = 'browseros'
const PLACEHOLDER_API_KEY = 'codex-local-chatgpt-auth'

const CodexAuthTokensSchema = z
  .object({
    id_token: z.string().optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    account_id: z.string().optional(),
  })
  .partial()

const CodexAuthFileSchema = z
  .object({
    auth_mode: z.string().optional(),
    tokens: CodexAuthTokensSchema.optional(),
    last_refresh: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()

const CodexTokenResponseSchema = z.object({
  id_token: z.string().optional(),
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
})

type CodexAuthFile = z.infer<typeof CodexAuthFileSchema>
type CodexTokenResponse = z.infer<typeof CodexTokenResponseSchema>

export interface CodexStatus {
  isAuthenticated: boolean
  authMode: 'chatgpt' | 'api-key' | null
  canUseChatGpt: boolean
  authPath: string
  message: string
}

type JwtClaims = {
  chatgpt_account_id?: string
  organizations?: Array<{ id: string }>
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string
  }
}

type CodexProviderConfig = {
  apiKey?: string
  authMode?: LLMAuthMode
}

type CodexFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

let pendingChatGptRefresh: Promise<CodexAuthFile> | null = null

function normalizeAuthMode(
  authMode?: string | null,
): 'chatgpt' | 'api-key' | null {
  if (authMode === 'chatgpt') return 'chatgpt'
  if (authMode === 'apikey' || authMode === 'api-key') return 'api-key'
  return null
}

export function getCodexAuthFilePath(): string {
  const homeDir = process.env.HOME || os.homedir()
  return path.join(homeDir, '.codex', 'auth.json')
}

function parseJwtClaims(token: string | undefined): JwtClaims | undefined {
  if (!token) return undefined

  const parts = token.split('.')
  if (parts.length !== 3) return undefined

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  } catch {
    return undefined
  }
}

function extractAccountIdFromClaims(
  claims: JwtClaims | undefined,
): string | undefined {
  if (!claims) return undefined
  return (
    claims.chatgpt_account_id ||
    claims['https://api.openai.com/auth']?.chatgpt_account_id ||
    claims.organizations?.[0]?.id
  )
}

function extractAccountId(tokens: CodexTokenResponse): string | undefined {
  return (
    extractAccountIdFromClaims(parseJwtClaims(tokens.id_token)) ||
    extractAccountIdFromClaims(parseJwtClaims(tokens.access_token))
  )
}

function getChatGptAccountId(auth: CodexAuthFile): string | undefined {
  return (
    auth.tokens?.account_id ||
    extractAccountIdFromClaims(parseJwtClaims(auth.tokens?.id_token)) ||
    extractAccountIdFromClaims(parseJwtClaims(auth.tokens?.access_token))
  )
}

async function readCodexAuthFile(): Promise<CodexAuthFile | null> {
  try {
    const raw = await readFile(getCodexAuthFilePath(), 'utf8')
    return CodexAuthFileSchema.parse(JSON.parse(raw))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function writeCodexAuthFile(auth: CodexAuthFile): Promise<void> {
  const authFile = getCodexAuthFilePath()
  await mkdir(path.dirname(authFile), { recursive: true })
  await writeFile(authFile, `${JSON.stringify(auth, null, 2)}\n`, 'utf8')
}

async function refreshChatGptTokens(
  currentAuth: CodexAuthFile,
): Promise<CodexAuthFile> {
  const refreshToken = currentAuth.tokens?.refresh_token
  if (!refreshToken) {
    throw new Error(
      'Local Codex ChatGPT login is missing a refresh token. Run `codex login` again.',
    )
  }

  const response = await fetch(`${CODEX_AUTH_ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CODEX_CLIENT_ID,
    }).toString(),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to refresh local Codex ChatGPT login (${response.status}). Run \`codex login\` again.`,
    )
  }

  const nextTokens = CodexTokenResponseSchema.parse(await response.json())
  const nextAuth: CodexAuthFile = {
    ...currentAuth,
    auth_mode: 'chatgpt',
    tokens: {
      ...currentAuth.tokens,
      id_token: nextTokens.id_token ?? currentAuth.tokens?.id_token,
      access_token: nextTokens.access_token,
      refresh_token: nextTokens.refresh_token ?? refreshToken,
      account_id:
        currentAuth.tokens?.account_id ||
        extractAccountId({
          ...nextTokens,
          id_token: nextTokens.id_token ?? currentAuth.tokens?.id_token,
        }),
    },
    last_refresh: Date.now(),
  }

  await writeCodexAuthFile(nextAuth)

  return nextAuth
}

async function refreshChatGptTokensOnce(
  currentAuth: CodexAuthFile,
): Promise<CodexAuthFile> {
  if (!pendingChatGptRefresh) {
    pendingChatGptRefresh = refreshChatGptTokens(currentAuth).finally(() => {
      pendingChatGptRefresh = null
    })
  }

  return pendingChatGptRefresh
}

async function loadChatGptAuth(): Promise<CodexAuthFile> {
  const auth = await readCodexAuthFile()

  if (!auth) {
    throw new Error(
      'No local Codex login found. Run `codex login` first, then use "Sign in with ChatGPT" in BrowserOS.',
    )
  }

  const authMode = normalizeAuthMode(auth.auth_mode)
  if (authMode !== 'chatgpt') {
    throw new Error(
      'Local Codex CLI auth is not ChatGPT-backed. Switch BrowserOS to "Use API key" or run `codex login` again.',
    )
  }

  if (!auth.tokens?.access_token) {
    throw new Error(
      'Local Codex ChatGPT login is incomplete. Run `codex login` again.',
    )
  }

  return auth
}

function rewriteCodexUrl(input: RequestInfo | URL): string {
  const currentUrl =
    input instanceof URL
      ? input
      : typeof input === 'string'
        ? new URL(input)
        : new URL(input.url)

  if (
    currentUrl.pathname.includes('/chat/completions') ||
    currentUrl.pathname.includes('/v1/responses') ||
    currentUrl.pathname.includes('/responses')
  ) {
    return CODEX_RESPONSES_URL
  }

  return currentUrl.toString()
}

function buildCodexHeaders(
  headersInit: HeadersInit | undefined,
  auth: CodexAuthFile,
): Headers {
  const headers = new Headers(headersInit)
  headers.delete('authorization')
  headers.delete('Authorization')
  headers.set('authorization', `Bearer ${auth.tokens?.access_token}`)
  headers.set('originator', BROWSEROS_ORIGINATOR)

  const accountId = getChatGptAccountId(auth)
  if (accountId) {
    headers.set('ChatGPT-Account-Id', accountId)
  }

  return headers
}

async function createCodexRequestInit(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  auth: CodexAuthFile,
): Promise<RequestInit> {
  if (!(input instanceof Request)) {
    return {
      ...init,
      headers: buildCodexHeaders(init?.headers, auth),
    }
  }

  const mergedHeaders = new Headers(input.headers)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      mergedHeaders.set(key, value)
    })
  }

  const nextInit: RequestInit = {
    ...init,
    cache: init?.cache ?? input.cache,
    credentials: init?.credentials ?? input.credentials,
    headers: buildCodexHeaders(mergedHeaders, auth),
    integrity: init?.integrity ?? input.integrity,
    keepalive: init?.keepalive ?? input.keepalive,
    method: init?.method ?? input.method,
    mode: init?.mode ?? input.mode,
    redirect: init?.redirect ?? input.redirect,
    referrer: init?.referrer ?? input.referrer,
    referrerPolicy: init?.referrerPolicy ?? input.referrerPolicy,
    signal: init?.signal ?? input.signal,
  }

  if (init?.body !== undefined) {
    nextInit.body = init.body
    return nextInit
  }

  if (!['GET', 'HEAD'].includes(input.method)) {
    nextInit.body = await input.clone().arrayBuffer()
  }

  return nextInit
}

export function createCodexChatGptFetch(): CodexFetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    let auth = await loadChatGptAuth()
    const url = rewriteCodexUrl(input)
    const execute = async () =>
      fetch(url, {
        ...(await createCodexRequestInit(input, init, auth)),
      })

    let response = await execute()

    if (
      (response.status === 401 || response.status === 403) &&
      auth.tokens?.refresh_token
    ) {
      auth = await refreshChatGptTokensOnce(auth)
      response = await execute()
    }

    return response
  }
}

function getResolvedAuthMode({
  apiKey,
  authMode,
}: CodexProviderConfig): LLMAuthMode {
  if (authMode) return authMode
  return apiKey ? 'api-key' : 'chatgpt'
}

export function createCodexProvider({ apiKey, authMode }: CodexProviderConfig) {
  const resolvedAuthMode = getResolvedAuthMode({ apiKey, authMode })

  if (resolvedAuthMode === 'api-key') {
    if (!apiKey) {
      throw new Error('Codex API key mode requires an OpenAI API key')
    }

    return createOpenAI({
      apiKey,
      name: 'codex',
      headers: { originator: BROWSEROS_ORIGINATOR },
    })
  }

  return createOpenAI({
    apiKey: PLACEHOLDER_API_KEY,
    name: 'codex',
    headers: { originator: BROWSEROS_ORIGINATOR },
    fetch: createCodexChatGptFetch() as typeof fetch,
  })
}

export async function getCodexStatus(): Promise<CodexStatus> {
  const auth = await readCodexAuthFile()
  const authMode = normalizeAuthMode(auth?.auth_mode)

  if (!auth || !authMode) {
    return {
      isAuthenticated: false,
      authMode: null,
      canUseChatGpt: false,
      authPath: getCodexAuthFilePath(),
      message:
        'Run `codex login` on this device to reuse your ChatGPT Codex access in BrowserOS.',
    }
  }

  if (authMode === 'api-key') {
    return {
      isAuthenticated: true,
      authMode,
      canUseChatGpt: false,
      authPath: getCodexAuthFilePath(),
      message:
        'Codex CLI is logged in with an API key. BrowserOS cannot import that key, so paste it directly in BrowserOS if you want API-key mode.',
    }
  }

  const canUseChatGpt = Boolean(auth.tokens?.access_token)

  return {
    isAuthenticated: canUseChatGpt,
    authMode,
    canUseChatGpt,
    authPath: getCodexAuthFilePath(),
    message: canUseChatGpt
      ? 'Local Codex ChatGPT login found. BrowserOS can reuse it on this device.'
      : 'Local Codex auth was found, but it is incomplete. Run `codex login` again.',
  }
}
