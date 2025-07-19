import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { BrowserPage } from '@/lib/browser/BrowserPage';

/**
 * Enum for navigation operations
 */
export const NavigationOperationTypeEnum = z.enum([
  'go_to_url',  // Navigate to a URL
  'go_back',  // Go back to previous page
  'go_forward',  // Go forward to next page
  'refresh'  // Refresh current page
]);

export type NavigationOperationType = z.infer<typeof NavigationOperationTypeEnum>;

/**
 * Schema for navigation tool input
 */
export const NavigationInputSchema = z.object({
  operationType: NavigationOperationTypeEnum,  // The operation to perform
  url: z.string().optional(),  // URL for go_to_url operation
  intent: z.string().optional()  // Optional description of why this navigation is being performed
});

export type NavigationInput = z.infer<typeof NavigationInputSchema>;

/**
 * Schema for navigation tool output
 */
export const NavigationOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  operationType: NavigationOperationTypeEnum,  // Operation that was performed
  message: z.string(),  // Human-readable result message
  url: z.string().optional(),  // Current URL after navigation
  title: z.string().optional()  // Current page title after navigation
});

export type NavigationOutput = z.infer<typeof NavigationOutputSchema>;

/**
 * Unified tool for navigation operations
 */
export class NavigationTool extends NxtscapeTool<NavigationInput, NavigationOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<NavigationInput, NavigationOutput> = {
      name: 'navigate',
      description: 'Perform navigation operations. Operations: "go_to_url" (navigate to a URL), "go_back" (go to previous page), "go_forward" (go to next page), "refresh" (refresh current page). Always pass operationType. Only pass url when using go_to_url.',
      category: 'navigation',
      version: '1.0.0',
      inputSchema: NavigationInputSchema,
      outputSchema: NavigationOutputSchema,
      examples: [
        {
          description: 'Navigate to a URL',
          input: { 
            operationType: 'go_to_url', 
            url: 'https://www.google.com',
            intent: 'Going to Google homepage'
          },
          output: {
            success: true,
            operationType: 'go_to_url',
            message: 'Navigated to https://www.google.com',
            url: 'https://www.google.com',
            title: 'Google'
          }
        },
        {
          description: 'Go back to previous page',
          input: { 
            operationType: 'go_back',
            intent: 'Returning to previous page'
          },
          output: {
            success: true,
            operationType: 'go_back',
            message: 'Navigated back to previous page',
            url: 'https://example.com',
            title: 'Example Domain'
          }
        },
        {
          description: 'Refresh current page',
          input: { 
            operationType: 'refresh',
            intent: 'Refreshing to get latest content'
          },
          output: {
            success: true,
            operationType: 'refresh',
            message: 'Page refreshed successfully',
            url: 'https://example.com',
            title: 'Example Domain'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Navigate',
        icon: '🧭',
        progressMessage: 'Performing navigation...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on operation
   */
  getProgressMessage(args: NavigationInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;
      const intent = args?.intent;

      // Use intent if provided, otherwise generate based on operation
      if (intent) {
        return intent;
      }

      switch (operationType) {
        case 'go_to_url':
          return args?.url ? `Navigating to ${args.url}` : 'Navigating to URL';
        case 'go_back':
          return 'Going back to previous page';
        case 'go_forward':
          return 'Going forward to next page';
        case 'refresh':
          return 'Refreshing the page';
        default:
          return 'Performing navigation...';
      }
    } catch {
      return 'Performing navigation...';
    }
  }

  /**
   * Override: Format result based on operation type
   */
  FormatResultForUI(output: NavigationOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    let result = '';
    switch (output.operationType) {
      case 'go_to_url':
        result = '🌐 Navigated to ';
        if (output.url) {
          try {
            const hostname = new URL(output.url).hostname;
            result += hostname;
          } catch {
            result += output.url;
          }
        } else {
          result += 'new page';
        }
        
        // Add page title if available
        if (output.title) {
          result += `\n📄 **Page:** ${output.title}`;
        }
        
        // Add full URL if available
        if (output.url) {
          result += `\n🔗 **URL:** ${output.url}`;
        }
        
        return result;
      
      case 'go_back':
        result = '⬅️ Went back to previous page';
        if (output.title) {
          result += `\n📄 **Page:** ${output.title}`;
        }
        return result;
      
      case 'go_forward':
        result = '➡️ Went forward to next page';
        if (output.title) {
          result += `\n📄 **Page:** ${output.title}`;
        }
        return result;
      
      case 'refresh':
        result = '🔄 Page refreshed';
        if (output.title) {
          result += `\n📄 **Page:** ${output.title}`;
        }
        return result;
      
      default:
        return `✅ ${output.message}`;
    }
  }

  protected async execute(input: NavigationInput): Promise<NavigationOutput> {
    // Validate inputs for operations that need them
    if (input.operationType === 'go_to_url' && !input.url) {
      return {
        success: false,
        operationType: input.operationType,
        message: 'go_to_url operation requires a url'
      };
    }

    try {
      // Get the current page
      const page = await this.executionContext.browserContext.getCurrentPage();
      
      // Execute the operation
      switch (input.operationType) {
        case 'go_to_url':
          return await this.navigateToUrl(page, input.url!);
        
        case 'go_back':
          return await this.goBack(page);
        
        case 'go_forward':
          return await this.goForward(page);
        
        case 'refresh':
          return await this.refreshPage(page);
        
        default:
          return {
            success: false,
            operationType: 'go_to_url',
            message: 'Invalid operation type specified'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: input.operationType,
        message: `Navigation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Navigate to a URL
   */
  private async navigateToUrl(page: BrowserPage, url: string): Promise<NavigationOutput> {
    try {
      // Normalize URL - add protocol if missing
      let normalizedUrl = url.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        // Check if it looks like a domain
        if (normalizedUrl.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}/)) {
          normalizedUrl = `https://${normalizedUrl}`;
        } else {
          // Might be a search query, use Google search
          normalizedUrl = `https://www.google.com/search?q=${encodeURIComponent(normalizedUrl)}`;
        }
      }

      await page.navigateTo(normalizedUrl);
      
      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get current page info
      const currentUrl = page.url();
      const currentTitle = await page.title();

      return {
        success: true,
        operationType: 'go_to_url',
        message: `Navigated to ${normalizedUrl}`,
        url: currentUrl,
        title: currentTitle
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      if (errorMessage.includes('not allowed')) {
        return {
          success: false,
          operationType: 'go_to_url',
          message: `URL not allowed: ${url}. This URL is restricted by security policy.`
        };
      }
      
      return {
        success: false,
        operationType: 'go_to_url',
        message: `Failed to navigate to ${url}: ${errorMessage}`
      };
    }
  }

  /**
   * Go back to previous page
   */
  private async goBack(page: BrowserPage): Promise<NavigationOutput> {
    try {
      await page.goBack();
      
      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get current page info
      const currentUrl = page.url();
      const currentTitle = await page.title();

      return {
        success: true,
        operationType: 'go_back',
        message: 'Navigated back to previous page',
        url: currentUrl,
        title: currentTitle
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if there's no history to go back to
      if (errorMessage.includes('Cannot navigate back')) {
        return {
          success: false,
          operationType: 'go_back',
          message: 'Cannot go back - no previous page in history'
        };
      }
      
      return {
        success: false,
        operationType: 'go_back',
        message: `Failed to go back: ${errorMessage}`
      };
    }
  }

  /**
   * Go forward to next page
   */
  private async goForward(page: BrowserPage): Promise<NavigationOutput> {
    try {
      await page.goForward();
      
      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get current page info
      const currentUrl = page.url();
      const currentTitle = await page.title();

      return {
        success: true,
        operationType: 'go_forward',
        message: 'Navigated forward to next page',
        url: currentUrl,
        title: currentTitle
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if there's no history to go forward to
      if (errorMessage.includes('Cannot navigate forward')) {
        return {
          success: false,
          operationType: 'go_forward',
          message: 'Cannot go forward - no next page in history'
        };
      }
      
      return {
        success: false,
        operationType: 'go_forward',
        message: `Failed to go forward: ${errorMessage}`
      };
    }
  }

  /**
   * Refresh the current page
   */
  private async refreshPage(page: BrowserPage): Promise<NavigationOutput> {
    try {
      await page.refreshPage();
      
      // Wait a bit for the page to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get current page info
      const currentUrl = page.url();
      const currentTitle = await page.title();

      return {
        success: true,
        operationType: 'refresh',
        message: 'Page refreshed successfully',
        url: currentUrl,
        title: currentTitle
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: 'refresh',
        message: `Failed to refresh page: ${errorMessage}`
      };
    }
  }
} 
