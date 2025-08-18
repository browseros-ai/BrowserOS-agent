import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"
import { PubSub } from "@/lib/pubsub"

// Constants
const SHOULD_WAIT = true;
const SEARCH_WAIT_MS = 1500

// Input schema for search operations
export const SearchInputSchema = z.object({
  searchProvider: z.enum(["google", "amazon", "google_maps"]),  // Search provider
  query: z.string(),  // Search query
})

export type SearchInput = z.infer<typeof SearchInputSchema>

export class SearchTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: SearchInput): Promise<ToolOutput> {
    try {
      const searchUrl = this._buildSearchUrl(input.searchProvider, input.query)
      const page = await this.executionContext.browserContext.getCurrentPage()
      await page.navigateTo(searchUrl)

      if (SHOULD_WAIT) {
        await new Promise(resolve => setTimeout(resolve, SEARCH_WAIT_MS))
      }
      
      // Emit status message
      this.executionContext.getPubSub().publishMessage(PubSub.createMessage(`Searched for "${input.query}" on ${this._getProviderName(input.searchProvider)}`, 'thinking'))
      
      return toolSuccess(`Searched for "${input.query}" on ${input.searchProvider}`);
    } catch (error) {
      return toolError(`Search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private _buildSearchUrl(provider: string, query: string): string {
    const encodedQuery = encodeURIComponent(query)
    
    switch (provider) {
      case "google":
        return `https://www.google.com/search?q=${encodedQuery}`
      
      case "amazon":
        return `https://www.amazon.com/s?k=${encodedQuery}`
      
      case "google_maps":
        return `https://www.google.com/maps/search/${encodedQuery}`
      
      default:
        return `https://www.google.com/search?q=${encodedQuery}`
    }
  }

  private _getProviderName(provider: string): string {
    const providerNames: Record<string, string> = {
      google: "Google",
      amazon: "Amazon",
      google_maps: "Google Maps",
    }
    return providerNames[provider] || provider
  }
}

// LangChain wrapper factory function
export function createSearchTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const searchTool = new SearchTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "search_tool",
    description: "Perform searches on different platforms: google (web search), amazon (products), google_maps (locations), google_finance (stocks).",
    schema: SearchInputSchema,
    func: async (args): Promise<string> => {
      const result = await searchTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
