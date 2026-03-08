import { spawn } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import type { SessionStore } from '../../agent/session-store'

interface ChatFileServiceDeps {
  sessionStore: SessionStore
  executionDir: string
}

export class ChatFileServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 500,
  ) {
    super(message)
    this.name = 'ChatFileServiceError'
  }
}

export class ChatFileService {
  constructor(private deps: ChatFileServiceDeps) {}

  async readFile(
    conversationId: string,
    requestedPath: string,
  ): Promise<{
    file: Blob
    filePath: string
    filename: string
    mediaType: string
  }> {
    const filePath = await this.resolveFilePath(conversationId, requestedPath)
    const file = Bun.file(filePath)
    const exists = await file.exists()
    if (!exists) {
      throw new ChatFileServiceError('File not found', 404)
    }

    return {
      file,
      filePath,
      filename: basename(filePath),
      mediaType: file.type || 'application/octet-stream',
    }
  }

  async openFile(
    conversationId: string,
    requestedPath: string,
  ): Promise<{ filePath: string }> {
    const filePath = await this.resolveFilePath(conversationId, requestedPath)
    await openFileWithDefaultApp(filePath)
    return { filePath }
  }

  async resolveFilePath(
    conversationId: string,
    requestedPath: string,
  ): Promise<string> {
    if (!requestedPath.trim()) {
      throw new ChatFileServiceError('File path is required', 400)
    }

    const roots = [
      this.deps.sessionStore.get(conversationId)?.executionDir,
      join(this.deps.executionDir, 'sessions', conversationId),
    ].filter(
      (root, index, values): root is string =>
        Boolean(root) && values.indexOf(root) === index,
    )

    for (const root of roots) {
      const resolvedPath = await resolveFileWithinRoot(root, requestedPath)
      if (resolvedPath) return resolvedPath
    }

    throw new ChatFileServiceError('File not found', 404)
  }
}

async function resolveFileWithinRoot(
  rootPath: string,
  requestedPath: string,
): Promise<string | null> {
  const realRoot = await realpath(rootPath).catch(() => null)
  if (!realRoot) return null

  const candidatePath = isAbsolute(requestedPath)
    ? requestedPath
    : resolve(realRoot, requestedPath)
  const realCandidate = await realpath(candidatePath).catch(() => null)
  if (!realCandidate) return null

  const relativePath = relative(realRoot, realCandidate)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null
  }

  const fileStat = await stat(realCandidate).catch(() => null)
  if (!fileStat?.isFile()) return null

  return realCandidate
}

async function openFileWithDefaultApp(filePath: string): Promise<void> {
  const [command, ...args] = getOpenCommand(filePath)

  await new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })
    child.once('error', rejectPromise)
    child.once('spawn', () => {
      child.unref()
      resolvePromise()
    })
  }).catch((error) => {
    throw new ChatFileServiceError(
      error instanceof Error ? error.message : 'Failed to open file',
      500,
    )
  })
}

function getOpenCommand(filePath: string): string[] {
  if (process.platform === 'darwin') {
    return ['open', filePath]
  }

  if (process.platform === 'win32') {
    return ['cmd', '/c', 'start', '', filePath]
  }

  return ['xdg-open', filePath]
}
