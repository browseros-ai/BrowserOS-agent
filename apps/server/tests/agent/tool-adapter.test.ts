import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { buildBrowserToolSet } from '../../src/agent/tool-adapter'
import type { Browser } from '../../src/browser/browser'
import { defineTool } from '../../src/tools/framework'
import { ToolRegistry } from '../../src/tools/tool-registry'

describe('buildBrowserToolSet', () => {
  it('preserves structured content from browser tools', async () => {
    const registry = new ToolRegistry([
      defineTool({
        name: 'save_report',
        description: 'Save a report',
        input: z.object({}),
        output: z.object({
          generatedFiles: z.array(
            z.object({
              path: z.string(),
            }),
          ),
        }),
        async handler(_args, _ctx, response) {
          response.text('Saved report')
          response.data({
            generatedFiles: [{ path: '/tmp/report.html' }],
          })
        },
      }),
    ])

    const toolSet = buildBrowserToolSet(registry, {} as Browser)
    const result = await toolSet.save_report.execute?.({})

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Saved report' }],
      isError: false,
      structuredContent: {
        generatedFiles: [{ path: '/tmp/report.html' }],
      },
    })
  })
})
