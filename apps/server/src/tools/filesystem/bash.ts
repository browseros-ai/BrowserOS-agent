import os from 'node:os'
import { z } from 'zod'
import type { FilesystemToolDef } from './build-toolset'
import { truncateTail } from './truncate'

function getShellConfig(): { executable: string; args: string[] } {
  if (process.platform === 'win32') {
    const comSpec = process.env.ComSpec?.toLowerCase() ?? ''
    if (comSpec.endsWith('powershell.exe') || comSpec.endsWith('pwsh.exe')) {
      return {
        executable: process.env.ComSpec ?? 'powershell.exe',
        args: ['-NoProfile', '-Command'],
      }
    }
    return { executable: 'powershell.exe', args: ['-NoProfile', '-Command'] }
  }
  return { executable: 'bash', args: ['-c'] }
}

const shell = getShellConfig()
const shellLabel = process.platform === 'win32' ? 'PowerShell' : 'bash'

export const bash: FilesystemToolDef = {
  name: 'bash',
  description:
    `Execute a shell command using ${shellLabel}. Returns stdout and stderr. ` +
    'Output is truncated to last 2000 lines or 50KB. ' +
    'Optionally provide a timeout in seconds.',
  input: z.object({
    command: z.string().describe('Shell command to execute'),
    timeout: z
      .number()
      .optional()
      .describe('Timeout in seconds (default: 120)'),
  }),
  async execute(args, cwd) {
    const timeoutMs = (args.timeout ?? 120) * 1000

    const proc = Bun.spawn([shell.executable, ...shell.args, args.command], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        HOME: process.env.HOME ?? process.env.USERPROFILE ?? os.homedir(),
      },
    })

    const timer = setTimeout(() => proc.kill(), timeoutMs)

    let stdout = ''
    let stderr = ''

    try {
      const [outBuf, errBuf] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      stdout = outBuf
      stderr = errBuf
    } finally {
      clearTimeout(timer)
    }

    const exitCode = await proc.exited

    const combined = [stdout ? stdout : '', stderr ? `[stderr]\n${stderr}` : '']
      .filter(Boolean)
      .join('\n')

    const result = truncateTail(combined)

    const parts: string[] = []
    if (result.truncated) {
      parts.push(
        `[Output truncated — showing last ${result.outputLines} of ${result.totalLines} lines]`,
      )
    }
    parts.push(result.content)

    if (exitCode !== 0) {
      parts.push(`\n[Exit code: ${exitCode}]`)
      return {
        content: [{ type: 'text', text: parts.join('\n') }],
        isError: true,
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: parts.join('\n') || 'Command completed with no output.',
        },
      ],
    }
  },
}
