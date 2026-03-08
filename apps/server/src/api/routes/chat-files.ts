import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'
import { logger } from '../../lib/logger'
import {
  type ChatFileService,
  ChatFileServiceError,
} from '../services/chat-file-service'
import type { Env } from '../types'
import { isTrustedLocalBrowserRequest } from '../utils/security'
import { ConversationIdParamSchema } from '../utils/validation'

interface ChatFileRouteDeps {
  fileService: ChatFileService
}

const ChatFilePathSchema = z.object({
  path: z.string().min(1, 'path is required'),
})

const SANDBOXED_INLINE_MEDIA_TYPES = new Set(['image/svg+xml', 'text/html'])

function sanitizeInlineFilename(filename: string): string {
  return Array.from(filename)
    .filter((character) => {
      const codePoint = character.codePointAt(0)
      return (
        codePoint !== undefined &&
        codePoint >= 0x20 &&
        codePoint !== 0x7f &&
        character !== '"'
      )
    })
    .join('')
}

function buildFileHeaders(result: {
  filename: string
  mediaType: string
}): Headers {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    'Content-Disposition': `inline; filename="${sanitizeInlineFilename(result.filename)}"`,
    'Content-Type': result.mediaType,
    'X-Content-Type-Options': 'nosniff',
  })

  if (SANDBOXED_INLINE_MEDIA_TYPES.has(result.mediaType)) {
    headers.set(
      'Content-Security-Policy',
      [
        'sandbox',
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        'img-src data: blob: http: https:',
        'font-src data: http: https:',
        'media-src data: blob: http: https:',
      ].join('; '),
    )
  }

  return headers
}

export function createChatFileRoutes(deps: ChatFileRouteDeps) {
  const { fileService } = deps

  return new Hono<Env>()
    .get(
      '/',
      zValidator('param', ConversationIdParamSchema),
      zValidator('query', ChatFilePathSchema),
      async (c) => {
        if (!isTrustedLocalBrowserRequest(c)) {
          return c.json({ error: 'Forbidden' }, 403)
        }

        const { conversationId } = c.req.valid('param')
        const { path } = c.req.valid('query')

        try {
          const result = await fileService.readFile(conversationId, path)
          return new Response(result.file, {
            headers: buildFileHeaders(result),
          })
        } catch (error) {
          if (error instanceof ChatFileServiceError) {
            return c.json({ error: error.message }, error.statusCode)
          }

          logger.error('Failed to render chat file', {
            conversationId,
            path,
            error: error instanceof Error ? error.message : String(error),
          })
          return c.json({ error: 'Failed to render file' }, 500)
        }
      },
    )
    .post(
      '/open',
      zValidator('param', ConversationIdParamSchema),
      zValidator('json', ChatFilePathSchema),
      async (c) => {
        if (!isTrustedLocalBrowserRequest(c)) {
          return c.json({ error: 'Forbidden' }, 403)
        }

        const { conversationId } = c.req.valid('param')
        const { path } = c.req.valid('json')

        try {
          const result = await fileService.openFile(conversationId, path)
          return c.json({ success: true, path: result.filePath })
        } catch (error) {
          if (error instanceof ChatFileServiceError) {
            return c.json({ error: error.message }, error.statusCode)
          }

          logger.error('Failed to open chat file', {
            conversationId,
            path,
            error: error instanceof Error ? error.message : String(error),
          })
          return c.json({ error: 'Failed to open file' }, 500)
        }
      },
    )
}
