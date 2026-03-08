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

function createRoute(
  fileService: Partial<Pick<ChatFileService, 'readFile' | 'openFile'>>,
) {
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

  it('strips control characters from inline filenames', async () => {
    const route = createRoute({
      async readFile() {
        return {
          file: new Blob(['<html><body>report</body></html>'], {
            type: 'text/html',
          }),
          filePath: '/tmp/report.html',
          filename: 'report.html\r\nX-Injected: value',
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
    expect(response.headers.get('Content-Disposition')).toBe(
      'inline; filename="report.htmlX-Injected: value"',
    )
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

  it('opens files with the native app route', async () => {
    let openedPath: string | undefined
    const route = createRoute({
      async openFile(_conversationId, path) {
        openedPath = path
        return { filePath: '/tmp/report.docx' }
      },
    })

    const response = await route.request(
      `http://localhost/chat/${CONVERSATION_ID}/files/open`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'localhost',
        },
        body: JSON.stringify({ path: 'report.docx' }),
      },
      LOCAL_ENV,
    )

    expect(response.status).toBe(200)
    expect(openedPath).toBe('report.docx')
    expect(await response.json()).toEqual({
      success: true,
      path: '/tmp/report.docx',
    })
  })
})
