/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'

const CloseWindowInputSchema = z.object({
  windowId: z.number().int().positive().describe('ID of the window to close'),
})

const CloseWindowOutputSchema = z.object({
  success: z.boolean().describe('Whether the window was successfully closed'),
})

type CloseWindowInput = z.infer<typeof CloseWindowInputSchema>
type CloseWindowOutput = z.infer<typeof CloseWindowOutputSchema>

/**
 * CloseWindowAction - Close a browser window by ID
 *
 * Closes the window with the given ID.
 *
 * Input:
 * - windowId: ID of the window to close
 *
 * Output:
 * - success: true if window was closed
 *
 * Example:
 * {
 *   "windowId": 123
 * }
 * // Returns: { success: true }
 */
export class CloseWindowAction extends ActionHandler<
  CloseWindowInput,
  CloseWindowOutput
> {
  readonly inputSchema = CloseWindowInputSchema

  async execute(input: CloseWindowInput): Promise<CloseWindowOutput> {
    await chrome.windows.remove(input.windowId)

    return {
      success: true,
    }
  }
}
