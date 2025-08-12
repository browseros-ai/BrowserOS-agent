import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { toolError } from '@/lib/tools/Tool.interface'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { generateExtractorSystemPrompt, generateExtractorTaskPrompt } from './ExtractTool.prompt'
import { invokeWithRetry } from '@/lib/utils/retryable'

// Input schema for extraction
const ExtractInputSchema = z.object({
  task: z.string(),  // What to extract (e.g., "Extract all product prices")
  tab_id: z.number(),  // Tab ID to extract from
  extract_type: z.enum(['links', 'text'])  // Type of content to extract
})

// Output schema for extracted data
const ExtractedDataSchema = z.object({
  content: z.string(),  // The LLM's extracted/summarized/rephrased output
  reasoning: z.string()  // LLM's explanation of what it did, found, and created
})

type ExtractInput = z.infer<typeof ExtractInputSchema>
type ExtractedData = z.infer<typeof ExtractedDataSchema>

// Factory function to create ExtractTool
export function createExtractTool(executionContext: ExecutionContext): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: 'extract_tool',
    description: 'Extract specific information from a web page using AI. Supports extracting text or links based on a task description.',
    schema: ExtractInputSchema,
    func: async (args: ExtractInput): Promise<string> => {
      try {
        // Get the page for the specified tab
        const pages = await executionContext.browserContext.getPages([args.tab_id])
        if (!pages || pages.length === 0) {
          return JSON.stringify(toolError(`Tab ${args.tab_id} not found`))
        }
        
        const page = pages[0]
        
        // Get raw content based on extract_type
        let rawContent: string
        if (args.extract_type === 'text') {
          const textSnapshot = await page.getTextSnapshot()
          // Convert sections to readable content
          rawContent = textSnapshot.sections && textSnapshot.sections.length > 0
            ? textSnapshot.sections.map((section: any) => 
                section.content || section.text || JSON.stringify(section)
              ).join('\n')
            : 'No text content found'
        } else {
          const linksSnapshot = await page.getLinksSnapshot()
          // Convert sections to readable content
          rawContent = linksSnapshot.sections && linksSnapshot.sections.length > 0
            ? linksSnapshot.sections.map((section: any) => 
                section.content || section.text || JSON.stringify(section)
              ).join('\n')
            : 'No links found'
        }
        
        // Get page metadata
        const url = await page.url()
        const title = await page.title()
        
        // Get LLM instance
        const llm = await executionContext.getLLM({temperature: 0.1})
        
        // Generate prompts
        const systemPrompt = generateExtractorSystemPrompt()
        const taskPrompt = generateExtractorTaskPrompt(
          args.task,
          args.extract_type,
          rawContent,
          { url, title }
        )
        
        // Get structured response from LLM with retry logic
        const structuredLLM = llm.withStructuredOutput(ExtractedDataSchema)
        const extractedData = await invokeWithRetry<ExtractedData>(
          structuredLLM,
          [
            new SystemMessage(systemPrompt),
            new HumanMessage(taskPrompt)
          ],
          3
        )
        
        // Return success result
        return JSON.stringify({
          ok: true,
          output: extractedData
        })
      } catch (error) {
        // Handle error
        const errorMessage = error instanceof Error ? error.message : String(error)
        return JSON.stringify(toolError(`Extraction failed: ${errorMessage}`))
      }
    }
  })
}
