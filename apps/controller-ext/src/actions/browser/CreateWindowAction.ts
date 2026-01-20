/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'

const CreateWindowInputSchema = z.object({
  url: z
    .string()
    .optional()
    .default('about:blank')
    .describe('URL to open in the new window'),
  incognito: z
    .boolean()
    .optional()
    .default(false)
    .describe('Create an incognito window'),
  focused: z
    .boolean()
    .optional()
    .default(true)
    .describe('Whether to focus the new window'),
})

const CreateWindowOutputSchema = z.object({
  windowId: z.number().describe('ID of the newly created window'),
  tabId: z.number().describe('ID of the first tab in the new window'),
})

type CreateWindowInput = z.infer<typeof CreateWindowInputSchema>
type CreateWindowOutput = z.infer<typeof CreateWindowOutputSchema>

/**
 * CreateWindowAction - Create a new browser window
 *
 * Creates a new browser window with an optional URL. Can create
 * regular or incognito windows.
 *
 * Input:
 * - url (optional): URL to open in the new window (default: about:blank)
 * - incognito (optional): Whether to create an incognito window (default: false)
 * - focused (optional): Whether to focus the new window (default: true)
 *
 * Output:
 * - windowId: ID of the newly created window
 * - tabId: ID of the first tab in the new window
 *
 * Example:
 * {
 *   "url": "https://www.google.com",
 *   "incognito": false,
 *   "focused": true
 * }
 * // Returns: { windowId: 123, tabId: 456 }
 */
export class CreateWindowAction extends ActionHandler<
  CreateWindowInput,
  CreateWindowOutput
> {
  readonly inputSchema = CreateWindowInputSchema

  async execute(input: CreateWindowInput): Promise<CreateWindowOutput> {
    const createData: chrome.windows.CreateData = {
      url: input.url,
      focused: input.focused,
      incognito: input.incognito,
    }

    const createdWindow = await chrome.windows.create(createData)

    if (!createdWindow) {
      throw new Error('Failed to create window')
    }

    if (createdWindow.id === undefined) {
      throw new Error('Created window has no ID')
    }

    const tabId = createdWindow.tabs?.[0]?.id
    if (tabId === undefined) {
      throw new Error('Created window has no tab')
    }

    return {
      windowId: createdWindow.id,
      tabId,
    }
  }
}
