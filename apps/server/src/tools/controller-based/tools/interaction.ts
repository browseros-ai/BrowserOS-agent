/**
 * @license
 * Copyright 2025 BrowserOS
 */
import { z } from 'zod'

import { ToolCategories } from '../../types/tool-categories'
import { defineTool } from '../../types/tool-definition'
import type { Context } from '../types/context'
import type { Response } from '../types/response'
import {
  ElementFormatter,
  type InteractiveNode,
} from '../utils/element-formatter'

const FULL_FORMATTER = new ElementFormatter('full')
const DETAILED_FORMATTER = new ElementFormatter('detailed')
const SIMPLIFIED_FORMATTER = new ElementFormatter('simplified')

export const getInteractiveElements = defineTool<
  z.ZodRawShape,
  Context,
  Response
>({
  name: 'browser_get_interactive_elements',
  description:
    'Get a snapshot of all interactive elements on the page (buttons, links, inputs)',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to get elements from'),
    simplified: z
      .boolean()
      .optional()
      .describe('Use simplified format (default: false)'),
  },
  handler: async (request, response, context) => {
    const { tabId, simplified = false } = request.params as {
      tabId: number
      simplified?: boolean
    }

    const result = await context.executeAction('getInteractiveSnapshot', {
      tabId,
    })
    const snapshot = result as {
      snapshotId: number
      timestamp: number
      elements: InteractiveNode[]
      hierarchicalStructure?: string
      processingTimeMs: number
    }

    const formatter = simplified ? SIMPLIFIED_FORMATTER : DETAILED_FORMATTER

    // Separate clickable and typeable elements
    const clickableElements = snapshot.elements.filter(
      (node) => node.type === 'clickable' || node.type === 'selectable',
    )
    const typeableElements = snapshot.elements.filter(
      (node) => node.type === 'typeable',
    )

    // Format elements
    const clickableString = formatter.formatElements(clickableElements, false)
    const typeableString = formatter.formatElements(typeableElements, false)

    // Build content string for both text response and structured content
    const lines: string[] = []
    lines.push(`INTERACTIVE ELEMENTS (Snapshot ID: ${snapshot.snapshotId}):`)
    lines.push(`Processing time: ${snapshot.processingTimeMs}ms`)
    lines.push('')

    if (clickableString) {
      lines.push('Clickable elements:')
      lines.push(clickableString)
      lines.push('')
    }

    if (typeableString) {
      lines.push('Input fields:')
      lines.push(typeableString)
      lines.push('')
    }

    if (!clickableString && !typeableString) {
      lines.push('No interactive elements found on this page.')
      lines.push('')
    }

    if (!simplified && snapshot.hierarchicalStructure) {
      lines.push('Page Structure:')
      lines.push(snapshot.hierarchicalStructure)
      lines.push('')
    }

    lines.push('Legend:')
    for (const entry of formatter.getLegend()) {
      lines.push(`  ${entry}`)
    }

    // Output text response
    for (const line of lines) {
      response.appendResponseLine(line)
    }

    // Add structured content for programmatic access
    response.addStructuredContent('content', lines.join('\n'))
  },
})

export const grepInteractiveElements = defineTool<
  z.ZodRawShape,
  Context,
  Response
>({
  name: 'browser_grep_interactive_elements',
  description:
    'Search interactive elements using regex patterns (case insensitive). Returns elements ' +
    'matching the pattern against their full formatted representation (nodeId, type, tag, ' +
    'name, attributes, viewport status). Use pipe (|) for OR patterns.',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: true,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID to search elements in'),
    pattern: z
      .string()
      .describe(
        'Regex pattern to match (case insensitive). Supports standard regex including ' +
          'pipe for OR (e.g., "submit|cancel", "button.*primary", "[0-9]+")',
      ),
    context: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        'Number of elements to show before and after each match (default: 2). Set to 0 to show only matches.',
      ),
  },
  handler: async (request, response, ctx) => {
    const {
      tabId,
      pattern,
      context: contextLines = 2,
    } = request.params as {
      tabId: number
      pattern: string
      context?: number
    }

    const result = await ctx.executeAction('getInteractiveSnapshot', {
      tabId,
    })
    const snapshot = result as {
      snapshotId: number
      timestamp: number
      elements: InteractiveNode[]
      processingTimeMs: number
    }

    const formatter = FULL_FORMATTER
    let regex: RegExp
    try {
      regex = new RegExp(pattern, 'i')
    } catch {
      response.appendResponseLine(`Invalid regex pattern: ${pattern}`)
      return
    }

    const allElements = snapshot.elements
    const formattedElements = allElements.map((node) => ({
      node,
      formatted: formatter.formatElement(node),
    }))

    const matchingIndices: number[] = []
    for (let i = 0; i < formattedElements.length; i++) {
      if (regex.test(formattedElements[i].formatted)) {
        matchingIndices.push(i)
      }
    }

    const lines: string[] = []
    lines.push(`GREP RESULTS (Pattern: "${pattern}", Context: ${contextLines})`)
    lines.push(
      `Snapshot ID: ${snapshot.snapshotId} | Processing: ${snapshot.processingTimeMs}ms`,
    )
    lines.push('')

    if (matchingIndices.length > 0) {
      lines.push(
        `Matches (${matchingIndices.length} of ${allElements.length} elements):`,
      )
      lines.push('')

      const includedIndices = new Set<number>()
      for (const idx of matchingIndices) {
        const start = Math.max(0, idx - contextLines)
        const end = Math.min(formattedElements.length - 1, idx + contextLines)
        for (let i = start; i <= end; i++) {
          includedIndices.add(i)
        }
      }

      const sortedIndices = Array.from(includedIndices).sort((a, b) => a - b)
      let lastIdx = -2
      for (const idx of sortedIndices) {
        if (lastIdx >= 0 && idx - lastIdx > 1) {
          lines.push('  ---')
        }
        const isMatch = matchingIndices.includes(idx)
        const prefix = isMatch ? '> ' : '  '
        lines.push(`${prefix}${formattedElements[idx].formatted}`)
        lastIdx = idx
      }
    } else {
      lines.push(`No elements matched pattern "${pattern}"`)
      lines.push(`Total elements searched: ${allElements.length}`)
    }

    lines.push('')
    lines.push('Legend:')
    for (const entry of formatter.getLegend()) {
      lines.push(`  ${entry}`)
    }
    lines.push('  > - Matching element')

    for (const line of lines) {
      response.appendResponseLine(line)
    }

    response.addStructuredContent('content', lines.join('\n'))
  },
})

export const clickElement = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_click_element',
  description:
    'Click an element by its nodeId (from browser_get_interactive_elements)',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce
      .number()
      .describe('Node ID from browser_get_interactive_elements'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId } = request.params as {
      tabId: number
      nodeId: number
    }

    await context.executeAction('click', { tabId, nodeId })

    response.appendResponseLine(`Clicked element ${nodeId} in tab ${tabId}`)
    response.setIncludeSnapshot?.(true)
  },
})

export const typeText = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_type_text',
  description: 'Type text into an input element',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the input element'),
    text: z.string().describe('Text to type into the element'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId, text } = request.params as {
      tabId: number
      nodeId: number
      text: string
    }

    await context.executeAction('click', { tabId, nodeId })
    await context.executeAction('inputText', { tabId, nodeId, text })

    response.appendResponseLine(
      `Typed text into element ${nodeId} in tab ${tabId}`,
    )
    response.setIncludeSnapshot?.(true)
  },
})

export const clearInput = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_clear_input',
  description: 'Clear text from an input element',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the input element'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId } = request.params as {
      tabId: number
      nodeId: number
    }

    await context.executeAction('click', { tabId, nodeId })
    await context.executeAction('clear', { tabId, nodeId })

    response.appendResponseLine(`Cleared element ${nodeId} in tab ${tabId}`)
  },
})

export const scrollToElement = defineTool<z.ZodRawShape, Context, Response>({
  name: 'browser_scroll_to_element',
  description: 'Scroll to bring an element into view',
  annotations: {
    category: ToolCategories.ELEMENT_INTERACTION,
    readOnlyHint: false,
  },
  schema: {
    tabId: z.coerce.number().describe('Tab ID containing the element'),
    nodeId: z.coerce.number().describe('Node ID of the element to scroll to'),
  },
  handler: async (request, response, context) => {
    const { tabId, nodeId } = request.params as {
      tabId: number
      nodeId: number
    }

    await context.executeAction('scrollToNode', { tabId, nodeId })

    response.appendResponseLine(`Scrolled to element ${nodeId} in tab ${tabId}`)
  },
})
