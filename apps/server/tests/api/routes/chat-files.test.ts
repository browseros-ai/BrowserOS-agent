import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { createChatFileRoutes } from '../../../src/api/routes/chat-files'
import type { ChatFileService } from '../../../src/api/services/chat-file-service'
import type { Env } from '../../../src/api/types'

const CONVERSATION_ID = '8ad89eca-e9f9-495a-80a8-a15d7c354181'

const LOCAL_ENV = {
  server: {
    requestIP() {
      return { address: '127.0.0.1' }
    },
  },
} as Env['Bindings']

function createRoute(fileService: Pick<ChatFileService, 'readFile'>) {
  return new Hono<Env>().route(
    '/chat/:conversationId/files',
    createChatFileRoutes({
      fileService: fileService as ChatFileService,
    }),
  )
}

describe('createChatFileRoutes', () => {
  it('sandboxes inline HTML files', async () => {
    const route = createRoute({
      async readFile() {
        return {
          file: new Blob(['<html><body>report</body></html>'], {
            type: 'text/html',
          }),
          filePath: '/tmp/report.html',
          filename: 'report.html',
          mediaType: 'text/html',
        }
      },
    })

    const response = await route.request(
      `http://localhost/chat/${CONVERSATION_ID}/files?path=report.html`,
      {
        headers: {
          host: 'localhost',
        },
      },
      LOCAL_ENV,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toContain('sandbox')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('does not sandbox PDF files', async () => {
    const route = createRoute({
      async readFile() {
        return {
          file: new Blob(['pdf'], {
            type: 'application/pdf',
          }),
          filePath: '/tmp/report.pdf',
          filename: 'report.pdf',
          mediaType: 'application/pdf',
        }
      },
    })

    const response = await route.request(
      `http://localhost/chat/${CONVERSATION_ID}/files?path=report.pdf`,
      {
        headers: {
          host: 'localhost',
        },
      },
      LOCAL_ENV,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Security-Policy')).toBeNull()
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
  })
})
