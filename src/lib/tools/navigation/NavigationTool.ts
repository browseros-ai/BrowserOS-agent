import { z } from "zod"
import { DynamicStructuredTool } from "@langchain/core/tools"
import { ExecutionContext } from "@/lib/runtime/ExecutionContext"
import { toolSuccess, toolError, type ToolOutput } from "@/lib/tools/Tool.interface"

// Constants
const ENABLE_WAIT = false  // Set to true to enable wait after navigation actions
const WAIT_DURATION = 1000  // Duration to wait in milliseconds
const HTTPS_PREFIX = "https://"
const HTTP_PREFIX = "http://"
const GOOGLE_SEARCH_URL = "https://www.google.com/search?q="

// Input schema for navigation operations
export const NavigationInputSchema = z.object({
  action: z.enum(["navigate", "back", "forward", "refresh"]),  // Navigation action to perform
  url: z.string().optional(),  // URL to navigate to (only required for 'navigate' action)
})

export type NavigationInput = z.infer<typeof NavigationInputSchema>

export class NavigationTool {
  constructor(private executionContext: ExecutionContext) {}

  async execute(input: NavigationInput): Promise<ToolOutput> {
    switch (input.action) {
      case "navigate":
        return this._navigateToUrl(input.url)
      case "back":
        return this._goBack()
      case "forward":
        return this._goForward()
      case "refresh":
        return this._refresh()
    }
  }

  // Private helper methods
  private async _navigateToUrl(url?: string): Promise<ToolOutput> {
    if (!url) {
      return toolError("URL is required for navigate action")
    }

    try {
      const normalizedUrl = this._normalizeUrl(url)
      const browserPage = await this.executionContext.browserContext.getCurrentPage()
      await browserPage.navigateTo(normalizedUrl)
      
      // Wait a bit for the page to settle after navigation
      if (ENABLE_WAIT) {
        await new Promise(resolve => setTimeout(resolve, WAIT_DURATION))
      }
      
      const [currentUrl, title] = await Promise.all([
        browserPage.url(),
        browserPage.title()
      ])
      
      return toolSuccess(`Navigated to ${currentUrl} - ${title}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Check for specific error types
      if (errorMessage.includes('not allowed')) {
        return toolError(`URL not allowed: ${url}. This URL is restricted by security policy.`)
      }
      
      return toolError(`Navigation failed: ${errorMessage}`)
    }
  }

  private async _goBack(): Promise<ToolOutput> {
    try {
      const browserPage = await this.executionContext.browserContext.getCurrentPage()
      await browserPage.goBack()
      
      // Wait a bit for the page to settle after navigation
      if (ENABLE_WAIT) {
        await new Promise(resolve => setTimeout(resolve, WAIT_DURATION))
      }
      
      const [currentUrl, title] = await Promise.all([
        browserPage.url(),
        browserPage.title()
      ])
      
      return toolSuccess(`Went back to ${currentUrl} - ${title}`)
    } catch (error) {
      // Check if there's no history to go back to
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Cannot navigate back') || errorMessage.includes('no previous page')) {
        return toolError("Cannot go back - no previous page in history")
      }
      return toolError(`Failed to go back: ${errorMessage}`)
    }
  }

  private async _goForward(): Promise<ToolOutput> {
    try {
      const browserPage = await this.executionContext.browserContext.getCurrentPage()
      await browserPage.goForward()
      
      // Wait a bit for the page to settle after navigation
      if (ENABLE_WAIT) {
        await new Promise(resolve => setTimeout(resolve, WAIT_DURATION))
      }
      
      const [currentUrl, title] = await Promise.all([
        browserPage.url(),
        browserPage.title()
      ])
      
      return toolSuccess(`Went forward to ${currentUrl} - ${title}`)
    } catch (error) {
      // Check if there's no history to go forward to
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Cannot navigate forward') || errorMessage.includes('no next page')) {
        return toolError("Cannot go forward - no next page in history")
      }
      return toolError(`Failed to go forward: ${errorMessage}`)
    }
  }

  private async _refresh(): Promise<ToolOutput> {
    try {
      const browserPage = await this.executionContext.browserContext.getCurrentPage()
      await browserPage.refreshPage()
      
      // Wait a bit for the page to settle after refresh
      if (ENABLE_WAIT) {
        await new Promise(resolve => setTimeout(resolve, WAIT_DURATION))
      }
      
      const [currentUrl, title] = await Promise.all([
        browserPage.url(),
        browserPage.title()
      ])
      
      return toolSuccess(`Refreshed ${currentUrl} - ${title}`)
    } catch (error) {
      return toolError(`Failed to refresh: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private _normalizeUrl(url: string): string {
    // If it already has a protocol, return as-is
    if (url.startsWith(HTTP_PREFIX) || url.startsWith(HTTPS_PREFIX)) {
      return url
    }
    
    // Check if it looks like a domain (contains dots but no spaces)
    const looksLikeDomain = url.includes('.') && !url.includes(' ')
    
    if (looksLikeDomain) {
      // Add https:// to domains
      return HTTPS_PREFIX + url
    } else {
      // Treat as search query
      return GOOGLE_SEARCH_URL + encodeURIComponent(url)
    }
  }
}

// LangChain wrapper factory function
export function createNavigationTool(executionContext: ExecutionContext): DynamicStructuredTool {
  const navigationTool = new NavigationTool(executionContext)
  
  return new DynamicStructuredTool({
    name: "navigation_tool",
    description: "Navigate the browser: go to URL, go back/forward in history, or refresh the page",
    schema: NavigationInputSchema,
    func: async (args): Promise<string> => {
      const result = await navigationTool.execute(args)
      return JSON.stringify(result)
    }
  })
}
