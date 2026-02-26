import { spawn } from 'node:child_process'
import { z } from 'zod'
import { truncateTail } from './truncate'
import type { FilesystemTool } from './types'

const bashInputSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  timeout: z
    .number()
    .positive()
    .optional()
    .describe('Timeout in seconds (optional)'),
})

type BashInput = z.infer<typeof bashInputSchema>

function getShellCommand(): { shell: string; args: string[] } {
  if (process.platform === 'win32') {
    return { shell: 'cmd.exe', args: ['/d', '/s', '/c'] }
  }
  return { shell: process.env.SHELL || '/bin/bash', args: ['-lc'] }
}

async function runCommand(
  command: string,
  cwd: string,
  timeoutSeconds?: number,
): Promise<{ exitCode: number | null; output: string; timedOut: boolean }> {
  const { shell, args } = getShellCommand()

  return new Promise((resolve, reject) => {
    const child = spawn(shell, [...args, command], {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const outputParts: string[] = []
    let timedOut = false

    const timeoutId = timeoutSeconds
      ? setTimeout(() => {
          timedOut = true
          child.kill('SIGTERM')
        }, timeoutSeconds * 1_000)
      : undefined

    child.stdout.on('data', (chunk: Buffer) => {
      outputParts.push(chunk.toString('utf-8'))
    })

    child.stderr.on('data', (chunk: Buffer) => {
      outputParts.push(chunk.toString('utf-8'))
    })

    child.on('error', (error) => {
      if (timeoutId) clearTimeout(timeoutId)
      reject(error)
    })

    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId)
      resolve({
        exitCode: code,
        output: outputParts.join(''),
        timedOut,
      })
    })
  })
}

export const bashTool: FilesystemTool<BashInput> = {
  name: 'bash',
  description:
    'Execute a shell command in the session directory. Returns combined stdout and stderr.',
  inputSchema: bashInputSchema,
  execute: async ({ command, timeout }, cwd) => {
    const { exitCode, output, timedOut } = await runCommand(
      command,
      cwd,
      timeout,
    )
    const truncation = truncateTail(output)

    let text = truncation.content || '(no output)'
    if (truncation.truncated) {
      const startLine = truncation.totalLines - truncation.outputLines + 1
      text += `\n\n[Showing lines ${startLine}-${truncation.totalLines} of ${truncation.totalLines}. Output truncated.]`
    }

    if (timedOut) {
      throw new Error(`${text}\n\nCommand timed out after ${timeout} seconds`)
    }

    if (exitCode !== 0) {
      throw new Error(`${text}\n\nCommand exited with code ${exitCode}`)
    }

    return {
      content: [{ type: 'text', text }],
    }
  },
}
