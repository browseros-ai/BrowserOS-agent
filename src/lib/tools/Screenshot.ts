import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { Logging } from '@/lib/utils/Logging'
import { PubSub } from '@/lib/pubsub'
import { SCREENSHOT_SIZES, type ScreenshotSizeKey } from '@/lib/browser/BrowserOSAdapter'

const ScreenshotToolInputSchema = z.object({
  size: z.enum(['small', 'medium', 'large']).optional()  // Optional size parameter
})

type ScreenshotToolInput = z.infer<typeof ScreenshotToolInputSchema>;

export function ScreenshotTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'screenshot_tool',
    description: `Capture a screenshot of the current page. Use liberally - screenshots are fast and free!

SIZE OPTIONS:
• small (256px): Low detail, minimal token usage - just visual layout checks
• medium (768px): Balanced quality and token usage - DEFAULT
• large (1028px): High detail - for complex pages or detailed analysis

USE FOR DECISION-MAKING:
• Choosing between multiple options (products, buttons, links)
• Before important actions (Place Order, Submit, Confirm)
• Verifying prices, ratings, or details before proceeding
• Comparing different items or pages

USE FOR DEBUGGING:
• Can't find an element after trying
• Page looks different than expected
• Before calling human_input_tool
• Understanding error messages

Screenshots help you see what's on the page and make better decisions.`,
    schema: ScreenshotToolInputSchema,
    func: async (args: ScreenshotToolInput): Promise<string> => {
      try {
        // Check if model has enough tokens for screenshots
        const maxTokens = executionContext.messageManager.getMaxTokens()
        const MIN_TOKENS_FOR_SCREENSHOTS = 64000  // 128k minimum

        if (maxTokens < MIN_TOKENS_FOR_SCREENSHOTS) {
          Logging.log('ScreenshotTool',
            `Screenshots disabled: model has ${maxTokens} tokens (minimum: ${MIN_TOKENS_FOR_SCREENSHOTS})`,
            'info')

          return JSON.stringify({
            ok: true,
            output: `Screenshots are disabled for models with less than 128k tokens. Current model has ${maxTokens} tokens.`
          })
        }

        // Determine screenshot size
        let selectedSize: ScreenshotSizeKey
        if (args.size) {
          selectedSize = args.size
        } else {
          // Smart default: use smaller size for low-token models
          selectedSize = maxTokens < 200000 ? 'small' : 'medium'
        }

        const pixelSize = SCREENSHOT_SIZES[selectedSize]
        Logging.log('ScreenshotTool',
          `Using ${selectedSize} screenshot (${pixelSize}px) for model with ${maxTokens} tokens`,
          'info')

        executionContext.getPubSub().publishMessage(
          PubSub.createMessage(`Capturing ${selectedSize} screenshot (${pixelSize}px)`, 'thinking')
        )

        const page = await executionContext.browserContext.getCurrentPage()
        if (!page) {
          Logging.log('ScreenshotTool', 'No active page found to take screenshot', 'error')
          executionContext.messageManager.addAI('Screenshot unavailable - no active page. Continuing without visual verification.')
          return JSON.stringify({
            ok: true,
            output: 'Screenshot unavailable. Proceeding without visual capture.'
          })
        }

        const screenshotDataUrl = await page.takeScreenshot(selectedSize)
        if (!screenshotDataUrl) {
          Logging.log('ScreenshotTool', 'Failed to capture screenshot - no data returned', 'error')
          executionContext.messageManager.addAI('Screenshot capture failed. Continuing without visual verification.')
          return JSON.stringify({
            ok: true,
            output: 'Screenshot unavailable. Proceeding without visual capture.'
          })
        }

        Logging.log('ScreenshotTool',
          `${selectedSize} screenshot captured successfully (${screenshotDataUrl.length} bytes)`,
          'info')

        // Return success with the actual screenshot data
        const result = {
          message: `Captured ${selectedSize} screenshot (${pixelSize}px) of the page.`,
          size: selectedSize,
          pixels: pixelSize,
          screenshot: screenshotDataUrl
        }
        return JSON.stringify({
          ok: true,
          output: JSON.stringify(result)
        })

      } catch (error) {
        Logging.log('ScreenshotTool',
          `Screenshot error: ${error instanceof Error ? error.message : String(error)}`,
          'error')

        executionContext.messageManager.addAI('Screenshot failed. Continuing without visual verification.')
        return JSON.stringify({
          ok: false,
          error: `Screenshot failed: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }
  })
}
