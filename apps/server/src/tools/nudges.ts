import { z } from 'zod'
import { OAUTH_MCP_SERVERS } from '../lib/clients/klavis/oauth-mcp-servers'
import { defineTool } from './framework'

const appNames = OAUTH_MCP_SERVERS.map((s) => s.name).join(', ')

export const suggest_schedule = defineTool({
  name: 'suggest_schedule',
  description:
    'MANDATORY: Call this after completing a task that could run on a recurring schedule (e.g. news summaries, monitoring, reports, price tracking, data gathering, weather checks). This helps the user automate repetitive tasks. Do NOT call if the task requires real-time user interaction or personal decisions.',
  input: z.object({
    query: z.string().describe('The original user query to schedule'),
    suggestedName: z
      .string()
      .describe(
        'A short, descriptive name for the scheduled task (e.g. "Morning News Briefing")',
      ),
    scheduleType: z
      .enum(['daily', 'hourly'])
      .describe('How often the task should run'),
    scheduleTime: z
      .string()
      .optional()
      .describe(
        'Suggested time for daily tasks in HH:MM format (e.g. "09:00"). Ignored for hourly.',
      ),
  }),
  handler: async (args, _ctx, response) => {
    response.text(
      JSON.stringify({
        type: 'schedule_suggestion',
        query: args.query,
        suggestedName: args.suggestedName,
        scheduleType: args.scheduleType,
        scheduleTime: args.scheduleTime ?? '09:00',
      }),
    )
  },
})

export const suggest_app_connection = defineTool({
  name: 'suggest_app_connection',
  description: `Suggest connecting an external app for better results. Call this when the user's request relates to a service available in Connect Apps but you don't currently have MCP tools for that service. The appName must be one of: ${appNames}.`,
  input: z.object({
    appName: z
      .string()
      .describe(
        'The name of the app to connect (must match a supported app name exactly)',
      ),
    reason: z
      .string()
      .describe(
        'A brief, user-friendly explanation of why connecting this app would help',
      ),
  }),
  handler: async (args, _ctx, response) => {
    response.text(
      JSON.stringify({
        type: 'app_connection',
        appName: args.appName,
        reason: args.reason,
      }),
    )
  },
})
