import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolSuccess, toolError, type ToolOutput } from '@/lib/tools/ToolInterface'

// Input schema for date tool
const DateToolInputSchema = z.object({
  date_range: z.enum([
    'today',
    'yesterday',
    'lastWeek',
    'lastMonth',
    'last30Days',
    'custom'
  ]).describe('Date range to calculate'),
  
  dayStart: z.number()
    .min(0)
    .max(365)
    .optional()
    .describe('For custom range: days back from today for START (e.g., 300 = 300 days ago)'),
    
  dayEnd: z.number()
    .min(0)
    .max(365)
    .optional()
    .describe('For custom range: days back from today for END (e.g., 5 = 5 days ago)'),
  
  format: z.enum([
    'iso',
    'date',
    'us',
    'eu',
    'unix'
  ]).default('date')
    .describe('Output format: iso (ISO-8601), date (YYYY-MM-DD), us (MM/DD/YYYY), eu (DD/MM/YYYY), unix (timestamp)')
})

export type DateToolInput = z.infer<typeof DateToolInputSchema>

/**
 * DateTool - Provides formatted dates and date ranges for browser automation
 * Following the FindElementTool pattern
 */
export class DateToolImpl {
  private executionContext: ExecutionContext

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
  }

  async execute(input: DateToolInput): Promise<ToolOutput> {
    try {
      const { date_range, dayStart, dayEnd, format = 'date' } = input
      
      const now = new Date()
      let startDate: Date
      let endDate: Date
      let isSingleDate = false
      
      // Calculate dates based on range
      switch (date_range) {
        case 'today':
          startDate = new Date(now)
          endDate = new Date(now)
          isSingleDate = true
          break
          
        case 'yesterday':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 1)
          endDate = new Date(startDate)
          isSingleDate = true
          break
          
        case 'lastWeek':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 7)
          endDate = new Date(now)
          break
          
        case 'lastMonth':
        case 'last30Days':
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - 30)
          endDate = new Date(now)
          break
          
        case 'custom':
          // Validate custom range inputs
          if (dayStart === undefined || dayEnd === undefined) {
            return toolError('dayStart and dayEnd are required for custom date range')
          }
          if (dayStart < dayEnd) {
            return toolError('dayStart must be >= dayEnd (dayStart is further back in time)')
          }
          
          startDate = new Date(now)
          startDate.setDate(startDate.getDate() - dayStart)
          endDate = new Date(now)
          endDate.setDate(endDate.getDate() - dayEnd)
          break
          
        default:
          return toolError(`Unknown date range: ${date_range}`)
      }
      
      // Reset time to start of day for date-only formats
      if (format !== 'iso') {
        startDate.setHours(0, 0, 0, 0)
        endDate.setHours(0, 0, 0, 0)
      }
      
      // Format dates based on requested format
      const formattedStart = this.formatDate(startDate, format)
      const formattedEnd = this.formatDate(endDate, format)
      
      // Build response based on single date or range
      if (isSingleDate) {
        return toolSuccess(JSON.stringify({
          date: formattedStart
        }))
      } else {
        return toolSuccess(JSON.stringify({
          startDate: formattedStart,
          endDate: formattedEnd
        }))
      }
    } catch (error) {
      return toolError(`Date calculation failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private formatDate(date: Date, format: string): string | number {
    switch (format) {
      case 'iso':
        return date.toISOString()
        
      case 'date':
        // YYYY-MM-DD format
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
        
      case 'us':
        // MM/DD/YYYY format
        const usMonth = String(date.getMonth() + 1).padStart(2, '0')
        const usDay = String(date.getDate()).padStart(2, '0')
        const usYear = date.getFullYear()
        return `${usMonth}/${usDay}/${usYear}`
        
      case 'eu':
        // DD/MM/YYYY format
        const euDay = String(date.getDate()).padStart(2, '0')
        const euMonth = String(date.getMonth() + 1).padStart(2, '0')
        const euYear = date.getFullYear()
        return `${euDay}/${euMonth}/${euYear}`
        
      case 'unix':
        // Unix timestamp in milliseconds
        return date.getTime()
        
      default:
        // Default to date format
        return this.formatDate(date, 'date') as string
    }
  }
}

/**
 * Factory function to create DateTool for LangChain integration
 * Following the FindElementTool pattern
 */
export function DateTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const tool = new DateToolImpl(executionContext)

  return new DynamicStructuredTool({
    name: "date_tool",
    description: `Get current date or calculate date ranges for browser automation.
    Supports ranges: today, yesterday, lastWeek, lastMonth, last30Days, custom.
    Formats: iso (ISO-8601 with time), date (YYYY-MM-DD), us (MM/DD/YYYY), eu (DD/MM/YYYY), unix (milliseconds).
    For custom ranges, dayStart is days back for start date, dayEnd is days back for end date.
    Example: dayStart=7, dayEnd=0 gives last 7 days from a week ago to today.`,

    schema: DateToolInputSchema,

    func: async (args): Promise<string> => {
      const result = await tool.execute(args)
      return JSON.stringify(result)
    }
  })
}