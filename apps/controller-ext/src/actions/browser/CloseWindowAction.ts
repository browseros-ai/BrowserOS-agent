/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { z } from 'zod'
import { CHROME_API_TIMEOUTS, withTimeout } from '@/utils/timeout'
import { ActionHandler } from '../ActionHandler'

const CloseWindowInputSchema = z.object({
  windowId: z.number().int().positive().describe('ID of the window to close'),
})

const CloseWindowOutputSchema = z.object({
  success: z.boolean().describe('Whether the window was successfully closed'),
})

type CloseWindowInput = z.infer<typeof CloseWindowInputSchema>
type CloseWindowOutput = z.infer<typeof CloseWindowOutputSchema>

export class CloseWindowAction extends ActionHandler<
  CloseWindowInput,
  CloseWindowOutput
> {
  readonly inputSchema = CloseWindowInputSchema

  async execute(input: CloseWindowInput): Promise<CloseWindowOutput> {
    await withTimeout(
      chrome.windows.remove(input.windowId),
      CHROME_API_TIMEOUTS.WINDOW_CLOSE,
      'chrome.windows.remove',
    )

    return {
      success: true,
    }
  }
}
