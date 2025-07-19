import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { BrowserPage } from '@/lib/browser/BrowserPage';

/**
 * Enum for scroll operations
 */
export const ScrollOperationTypeEnum = z.enum([
  'scroll_down',  // Scroll down by viewports
  'scroll_up',  // Scroll up by viewports
  'scroll_to_element'  // Scroll to element by index
]);

export type ScrollOperationType = z.infer<typeof ScrollOperationTypeEnum>;

/**
 * Schema for scroll tool input
 */
export const ScrollInputSchema = z.object({
  operationType: ScrollOperationTypeEnum,  // The operation to perform
  amount: z.number().optional(),  // Number of viewports to scroll (for scroll_down/up)
  index: z.number().optional(),  // Element index (for scroll_to_element)
  intent: z.string().optional()  // Optional description of why this scroll is being performed
});

export type ScrollInput = z.infer<typeof ScrollInputSchema>;

/**
 * Schema for scroll tool output
 */
export const ScrollOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  operationType: ScrollOperationTypeEnum,  // Operation that was performed
  message: z.string(),  // Human-readable result message
  elementFound: z.boolean().optional()  // Whether target element was found (for scroll_to_element)
});

export type ScrollOutput = z.infer<typeof ScrollOutputSchema>;

/**
 * Tool for scrolling operations using viewport-based scrolling
 */
export class ScrollTool extends NxtscapeTool<ScrollInput, ScrollOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<ScrollInput, ScrollOutput> = {
      name: 'scroll',
      description: 'Perform scrolling operations. Operations: "scroll_down" (scroll down by viewports), "scroll_up" (scroll up by viewports), "scroll_to_element" (scroll to element by index). Always pass operationType. Pass amount for number of viewports to scroll (default 1), or index for element scrolling.',
      category: 'interaction',
      version: '1.0.0',
      inputSchema: ScrollInputSchema,
      outputSchema: ScrollOutputSchema,
      examples: [
        {
          description: 'Scroll down one viewport',
          input: { 
            operationType: 'scroll_down',
            intent: 'Scrolling to see more content'
          },
          output: {
            success: true,
            operationType: 'scroll_down',
            message: 'Scrolled down 1 viewport'
          }
        },
        {
          description: 'Scroll down multiple viewports',
          input: { 
            operationType: 'scroll_down',
            amount: 2,
            intent: 'Scrolling down 2 viewports'
          },
          output: {
            success: true,
            operationType: 'scroll_down',
            message: 'Scrolled down 2 viewports'
          }
        },
        {
          description: 'Scroll up one viewport',
          input: { 
            operationType: 'scroll_up',
            intent: 'Scrolling back up'
          },
          output: {
            success: true,
            operationType: 'scroll_up',
            message: 'Scrolled up 1 viewport'
          }
        },
        {
          description: 'Scroll to element by index',
          input: { 
            operationType: 'scroll_to_element',
            index: 42,
            intent: 'Scrolling to button with index 42'
          },
          output: {
            success: true,
            operationType: 'scroll_to_element',
            message: 'Scrolled to element with index 42',
            elementFound: true
          }
        }
      ],
      streamingConfig: {
        displayName: 'Scroll',
        icon: '📜',
        progressMessage: 'Scrolling page...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on operation
   */
  getProgressMessage(args: ScrollInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;
      const intent = args?.intent;

      // Use intent if provided, otherwise generate based on operation
      if (intent) {
        return intent;
      }

      switch (operationType) {
        case 'scroll_down':
          return args?.amount 
            ? `Scrolling down ${args.amount} viewport${args.amount > 1 ? 's' : ''}`
            : 'Scrolling down';
        case 'scroll_up':
          return args?.amount 
            ? `Scrolling up ${args.amount} viewport${args.amount > 1 ? 's' : ''}`
            : 'Scrolling up';
        case 'scroll_to_element':
          return args?.index !== undefined 
            ? `Scrolling to element ${args.index}`
            : 'Scrolling to element';
        default:
          return 'Scrolling page...';
      }
    } catch {
      return 'Scrolling page...';
    }
  }

  /**
   * Override: Format result based on operation type
   */
  FormatResultForUI(output: ScrollOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    switch (output.operationType) {
      case 'scroll_down':
        return `⬇️ Scrolled down`;
      
      case 'scroll_up':
        return `⬆️ Scrolled up`;
      
      case 'scroll_to_element':
        return output.elementFound 
          ? `🎯 Scrolled to element`
          : `❓ Element not found`;
      
      default:
        return `✅ ${output.message}`;
    }
  }

  protected async execute(input: ScrollInput): Promise<ScrollOutput> {
    // Validate inputs for operations that need them
    switch (input.operationType) {
      case 'scroll_to_element':
        if (input.index === undefined) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'scroll_to_element operation requires index parameter'
          };
        }
        break;
    }

    try {
      // Get the current page
      const page = await this.browserContext.getCurrentPage();
      
      // Execute the operation
      switch (input.operationType) {
        case 'scroll_down':
          return await this.scrollDown(page, input.amount);
        
        case 'scroll_up':
          return await this.scrollUp(page, input.amount);
        
        case 'scroll_to_element':
          return await this.scrollToElement(page, input.index!);
        
        default:
          return {
            success: false,
            operationType: 'scroll_down',
            message: 'Invalid operation type specified'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: input.operationType,
        message: `Scroll operation failed: ${errorMessage}`
      };
    }
  }

  /**
   * Scroll down the page by viewports
   */
  private async scrollDown(page: BrowserPage, amount?: number): Promise<ScrollOutput> {
    try {
      // Perform scroll (amount is number of viewports)
      const viewports = amount || 1;
      await page.scrollDown(viewports);
      
      return {
        success: true,
        operationType: 'scroll_down',
        message: `Scrolled down ${viewports} viewport${viewports > 1 ? 's' : ''}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: 'scroll_down',
        message: `Failed to scroll down: ${errorMessage}`
      };
    }
  }

  /**
   * Scroll up the page by viewports
   */
  private async scrollUp(page: BrowserPage, amount?: number): Promise<ScrollOutput> {
    try {
      // Perform scroll (amount is number of viewports)
      const viewports = amount || 1;
      await page.scrollUp(viewports);
      
      return {
        success: true,
        operationType: 'scroll_up',
        message: `Scrolled up ${viewports} viewport${viewports > 1 ? 's' : ''}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: 'scroll_up',
        message: `Failed to scroll up: ${errorMessage}`
      };
    }
  }



  /**
   * Scroll to element by index
   */
  private async scrollToElement(page: BrowserPage, index: number): Promise<ScrollOutput> {
    try {
      // Get the element from the selector map
      const element = await page.getElementByIndex(index);
      
      if (!element) {
        return {
          success: false,
          operationType: 'scroll_to_element',
          message: `Element with index ${index} not found`,
          elementFound: false
        };
      }

      // V2: Use nodeId to scroll
      const success = await page.scrollToElement(element.nodeId);
      
      if (!success) {
        return {
          success: false,
          operationType: 'scroll_to_element',
          message: `Could not scroll to element with index ${index}`,
          elementFound: false
        };
      }

      return {
        success: true,
        operationType: 'scroll_to_element',
        message: `Scrolled to element with index ${index}`,
        elementFound: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: 'scroll_to_element',
        message: `Failed to scroll to element: ${errorMessage}`,
        elementFound: false
      };
    }
  }
} 
