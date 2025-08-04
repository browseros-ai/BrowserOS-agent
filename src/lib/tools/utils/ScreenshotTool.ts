import { z } from 'zod'
import { DynamicStructuredTool } from '@langchain/core/tools'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { Logging } from '@/lib/utils/Logging'
import { toolSuccess, toolError } from '@/lib/tools/Tool.interface'

// Input schema for the screenshot tool
const ScreenshotToolInputSchema = z.object({})  // No parameters needed

type ScreenshotToolInput = z.infer<typeof ScreenshotToolInputSchema>;

export function createScreenshotTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'screenshot_tool',
    description: 'Capture a screenshot of the current page. Returns base64 encoded image data.',
    schema: ScreenshotToolInputSchema,
    func: async (args: ScreenshotToolInput): Promise<string> => {
      try {
        // Get the current page from execution context
        const page = await executionContext.browserContext.getCurrentPage()
        
        if (!page) {
          const error = 'No active page found to take screenshot'
          Logging.log('ScreenshotTool', error, 'error')
          return JSON.stringify(toolError(error))
        }

        // Take the screenshot
        const base64Data = await page.takeScreenshot()
        
        if (!base64Data) {
          const error = 'Failed to capture screenshot - no data returned'
          Logging.log('ScreenshotTool', error, 'error')
          return JSON.stringify(toolError(error))
        }
        
        Logging.log('ScreenshotTool', `Screenshot captured successfully (${base64Data.length} bytes)`, 'info')
        
        // Return success with the base64 data in the output message
        return JSON.stringify(toolSuccess(`Screenshot captured successfully. Base64 data (${base64Data.length} bytes): ${base64Data}`))
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logging.log('ScreenshotTool', `Error capturing screenshot: ${errorMessage}`, 'error')
        
        return JSON.stringify(toolError(`Failed to capture screenshot: ${errorMessage}`))
      }
    }
  })
}
