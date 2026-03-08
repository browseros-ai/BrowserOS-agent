import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SessionStore } from '../../src/agent/session-store'
import {
  ChatFileService,
  ChatFileServiceError,
} from '../../src/api/services/chat-file-service'

const CONVERSATION_ID = '8ad89eca-e9f9-495a-80a8-a15d7c354181'

let tempRoot: string
let workspaceDir: string
let outsideDir: string

beforeEach(async () => {
  tempRoot = join(
    tmpdir(),
    `chat-file-service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  workspaceDir = join(tempRoot, 'workspace')
  outsideDir = join(tempRoot, 'outside')

  await mkdir(workspaceDir, { recursive: true })
  await mkdir(outsideDir, { recursive: true })
})

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true })
})

describe('ChatFileService', () => {
  it('resolves a relative path inside the session execution dir', async () => {
    const filePath = join(workspaceDir, 'report.html')
    await writeFile(filePath, '<html>report</html>')

    const sessionStore = new SessionStore()
    sessionStore.set(CONVERSATION_ID, {
      agent: {} as never,
      executionDir: workspaceDir,
    })

    const service = new ChatFileService({
      sessionStore,
      executionDir: tempRoot,
    })

    const resolvedPath = await service.resolveFilePath(
      CONVERSATION_ID,
      'report.html',
    )

    expect(resolvedPath).toBe(await realpath(filePath))
  })

  it('rejects a path outside the session execution dir', async () => {
    const insidePath = join(workspaceDir, 'report.html')
    const outsidePath = join(outsideDir, 'secret.html')
    await writeFile(insidePath, '<html>report</html>')
    await writeFile(outsidePath, '<html>secret</html>')

    const sessionStore = new SessionStore()
    sessionStore.set(CONVERSATION_ID, {
      agent: {} as never,
      executionDir: workspaceDir,
    })

    const service = new ChatFileService({
      sessionStore,
      executionDir: tempRoot,
    })

    await expect(
      service.resolveFilePath(CONVERSATION_ID, outsidePath),
    ).rejects.toBeInstanceOf(ChatFileServiceError)
  })

  it('falls back to the default per-session directory', async () => {
    const sessionDir = join(tempRoot, 'sessions', CONVERSATION_ID)
    const filePath = join(sessionDir, 'report.pdf')
    await mkdir(sessionDir, { recursive: true })
    await writeFile(filePath, 'pdf')

    const service = new ChatFileService({
      sessionStore: new SessionStore(),
      executionDir: tempRoot,
    })

    const resolvedPath = await service.resolveFilePath(
      CONVERSATION_ID,
      'report.pdf',
    )

    expect(resolvedPath).toBe(await realpath(filePath))
  })
})
