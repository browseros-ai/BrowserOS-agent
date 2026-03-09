import { z } from 'zod'
import { TweeksService } from '../api/services/tweeks-service'
import { defineTool } from './framework'

const tweeksService = new TweeksService()

const pageParam = z.number().describe('Page ID (from list_pages)')

export const create_tweek = defineTool({
  name: 'create_tweek',
  description:
    'Save a new website modification (tweek). Provide a name, the target domain, URL pattern, and the JavaScript or CSS script to inject. The tweek will auto-apply on matching pages.',
  input: z.object({
    name: z.string().min(1).describe('Short name for the tweek'),
    description: z.string().optional().describe('What this tweek does'),
    domain: z.string().min(1).describe('Target domain (e.g. "youtube.com")'),
    url_pattern: z
      .string()
      .min(1)
      .describe(
        'URL pattern with wildcards (e.g. "https://www.youtube.com/*")',
      ),
    script: z.string().min(1).describe('JavaScript or CSS code to inject'),
    script_type: z.enum(['js', 'css']).default('js').describe('Type of script'),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    domain: z.string(),
  }),
  handler: async (args, _ctx, response) => {
    const tweek = tweeksService.create({
      name: args.name,
      description: args.description,
      domain: args.domain,
      url_pattern: args.url_pattern,
      script: args.script,
      script_type: args.script_type,
    })
    response.text(
      `Created tweek "${tweek.name}" (${tweek.id}) for ${tweek.domain}`,
    )
    response.data({
      id: tweek.id,
      name: tweek.name,
      domain: tweek.domain,
    })
  },
})

export const list_tweeks = defineTool({
  name: 'list_tweeks',
  description:
    'List all saved tweeks (website modifications). Optionally filter by domain.',
  input: z.object({
    domain: z
      .string()
      .optional()
      .describe('Filter by domain (e.g. "youtube.com")'),
  }),
  output: z.object({
    tweeks: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        domain: z.string(),
        enabled: z.boolean(),
      }),
    ),
    count: z.number(),
  }),
  handler: async (args, _ctx, response) => {
    const tweeks = tweeksService.list(args.domain)

    if (tweeks.length === 0) {
      response.text(
        args.domain
          ? `No tweeks found for ${args.domain}.`
          : 'No tweeks found.',
      )
      response.data({ tweeks: [], count: 0 })
      return
    }

    const lines = tweeks.map(
      (t) =>
        `- ${t.name} (${t.id}) — ${t.domain} [${t.enabled ? 'ON' : 'OFF'}]`,
    )
    response.text(`Found ${tweeks.length} tweek(s):\n${lines.join('\n')}`)
    response.data({
      tweeks: tweeks.map((t) => ({
        id: t.id,
        name: t.name,
        domain: t.domain,
        enabled: Boolean(t.enabled),
      })),
      count: tweeks.length,
    })
  },
})

export const apply_tweek = defineTool({
  name: 'apply_tweek',
  description:
    'Apply a saved tweek to the current page by injecting its script. The tweek must exist and be enabled.',
  input: z.object({
    page: pageParam,
    tweek_id: z.string().describe('ID of the tweek to apply'),
  }),
  output: z.object({
    applied: z.boolean(),
    tweek_name: z.string().optional(),
  }),
  handler: async (args, ctx, response) => {
    const tweek = tweeksService.getById(args.tweek_id)

    if (!tweek) {
      response.error(`Tweek not found: ${args.tweek_id}`)
      return
    }

    if (!tweek.enabled) {
      response.error(`Tweek "${tweek.name}" is disabled.`)
      return
    }

    let expression: string
    if (tweek.script_type === 'css') {
      const escaped = tweek.script.replace(/`/g, '\\`').replace(/\$/g, '\\$')
      expression = `(() => {
        const style = document.createElement('style');
        style.dataset.tweekId = '${tweek.id}';
        style.textContent = \`${escaped}\`;
        document.head.appendChild(style);
        return 'CSS injected';
      })()`
    } else {
      expression = tweek.script
    }

    const result = await ctx.browser.evaluate(args.page, expression)

    if (result.error) {
      response.error(`Script error: ${result.error}`)
      response.data({ applied: false })
      return
    }

    response.text(`Applied tweek "${tweek.name}" to page ${args.page}`)
    response.data({ applied: true, tweek_name: tweek.name })
  },
})

export const toggle_tweek = defineTool({
  name: 'toggle_tweek',
  description: 'Enable or disable a saved tweek.',
  input: z.object({
    tweek_id: z.string().describe('ID of the tweek to toggle'),
    enabled: z
      .boolean()
      .describe('Whether to enable (true) or disable (false)'),
  }),
  output: z.object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
  }),
  handler: async (args, _ctx, response) => {
    const tweek = tweeksService.update(args.tweek_id, {
      enabled: args.enabled,
    })

    if (!tweek) {
      response.error(`Tweek not found: ${args.tweek_id}`)
      return
    }

    const state = args.enabled ? 'enabled' : 'disabled'
    response.text(`Tweek "${tweek.name}" is now ${state}.`)
    response.data({
      id: tweek.id,
      name: tweek.name,
      enabled: Boolean(tweek.enabled),
    })
  },
})

export const delete_tweek = defineTool({
  name: 'delete_tweek',
  description: 'Permanently delete a saved tweek.',
  input: z.object({
    tweek_id: z.string().describe('ID of the tweek to delete'),
  }),
  output: z.object({
    deleted: z.boolean(),
  }),
  handler: async (args, _ctx, response) => {
    const deleted = tweeksService.delete(args.tweek_id)

    if (!deleted) {
      response.error(`Tweek not found: ${args.tweek_id}`)
      return
    }

    response.text(`Tweek ${args.tweek_id} deleted.`)
    response.data({ deleted: true })
  },
})
