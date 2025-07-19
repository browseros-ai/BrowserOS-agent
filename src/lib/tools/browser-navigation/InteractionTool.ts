import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { BrowserPage } from '@/lib/browser/BrowserPage';
import { Logging } from '@/lib/utils/Logging';
import { profileAsync } from '@/lib/utils/Profiler';

/**
 * Enum for interaction operations
 */
export const InteractionOperationTypeEnum = z.enum([
  'click',  // Click an element
  'input_text',  // Input text into an element
  'clear',  // Clear text from an input element
  'send_keys'  // Send keyboard keys/shortcuts
]);

export type InteractionOperationType = z.infer<typeof InteractionOperationTypeEnum>;

/**
 * Schema for interaction tool input
 */
export const InteractionInputSchema = z.object({
  operationType: InteractionOperationTypeEnum,  // The operation to perform
  index: z.number().optional(),  // Element index from the selector map (optional for send_keys)
  text: z.string().optional(),  // Text for input_text
  keys: z.string().optional(),  // Keys for send_keys operation
  intent: z.string().optional()  // Optional description of why this interaction is being performed
});

export type InteractionInput = z.infer<typeof InteractionInputSchema>;

/**
 * Schema for interaction tool output
 */
export const InteractionOutputSchema = z.object({
  success: z.boolean(),  // Whether the operation succeeded
  operationType: InteractionOperationTypeEnum,  // Operation that was performed
  message: z.string(),  // Human-readable result message
  elementInfo: z.object({
    tagName: z.string(),  // Element tag name
    text: z.string().optional(),  // Element text content
    type: z.string().optional(),  // Input type if applicable
    value: z.string().optional()  // Current value if applicable
  }).optional(),
  newTabOpened: z.boolean().optional()  // Whether a new tab was opened (for clicks)
});

export type InteractionOutput = z.infer<typeof InteractionOutputSchema>;

/**
 * Unified tool for element interactions
 */
export class InteractionTool extends NxtscapeTool<InteractionInput, InteractionOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<InteractionInput, InteractionOutput> = {
      name: 'interact',
      description: 'Perform element interactions. Operations: "click" (click element), "input_text" (type text into element), "clear" (clear input field), "send_keys" (send keyboard keys). Always pass operationType. Pass index for element operations. Pass text for input_text, keys for send_keys. Note: For dropdowns, click to open them and then click the desired option.',
      category: 'interaction',
      version: '1.0.0',
      inputSchema: InteractionInputSchema,
      outputSchema: InteractionOutputSchema,
      examples: [
        {
          description: 'Click a button',
          input: { 
            operationType: 'click',
            index: 15,
            intent: 'Clicking the submit button'
          },
          output: {
            success: true,
            operationType: 'click',
            message: 'Clicked element with index 15',
            elementInfo: {
              tagName: 'button',
              text: 'Submit'
            }
          }
        },
        {
          description: 'Input text into a field',
          input: { 
            operationType: 'input_text',
            index: 8,
            text: 'john.doe@example.com',
            intent: 'Entering email address'
          },
          output: {
            success: true,
            operationType: 'input_text',
            message: 'Input text into element with index 8',
            elementInfo: {
              tagName: 'input',
              type: 'email',
              value: 'john.doe@example.com'
            }
          }
        },
        {
          description: 'Clear an input field',
          input: { 
            operationType: 'clear',
            index: 12,
            intent: 'Clearing the search box'
          },
          output: {
            success: true,
            operationType: 'clear',
            message: 'Cleared element with index 12',
            elementInfo: {
              tagName: 'input',
              type: 'text',
              value: ''
            }
          }
        },
        {
          description: 'Send keyboard keys',
          input: { 
            operationType: 'send_keys',
            keys: 'Enter',
            intent: 'Pressing Enter to submit form'
          },
          output: {
            success: true,
            operationType: 'send_keys',
            message: 'Sent keys: Enter'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Interact',
        icon: '🖱️',
        progressMessage: 'Interacting with element...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message based on operation
   */
  getProgressMessage(args: InteractionInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const operationType = args?.operationType;
      const index = args?.index;
      const intent = args?.intent;

      // Use intent if provided, otherwise generate based on operation
      if (intent) {
        return intent;
      }

      switch (operationType) {
        case 'click':
          return `Clicking element ${index}`;
        case 'input_text':
          return `Typing into element ${index}`;
        case 'clear':
          return `Clearing element ${index}`;
        case 'send_keys':
          return `Sending keys: ${args?.keys}`;
        default:
          return 'Interacting with element...';
      }
    } catch {
      return 'Interacting with element...';
    }
  }

  /**
   * Override: Format result based on operation type
   */
  FormatResultForUI(output: InteractionOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    switch (output.operationType) {
      case 'click':
        if (output.newTabOpened) {
          return `🖱️ Clicked element (new tab opened)`;
        }
        return `🖱️ Clicked element`;
      
      case 'input_text':
        return `⌨️ Entered text`;
      
      case 'clear':
        return `🧹 Cleared field`;
      
      case 'send_keys':
        // Extract keys from message
        const keysMatch = output.message.match(/Sent keys: (.+)/);
        if (keysMatch && keysMatch[1]) {
          return `⌨️ Pressed ${keysMatch[1]}`;
        }
        return `⌨️ Sent keys`;
      
      default:
        return `✅ ${output.message}`;
    }
  }

  protected async execute(input: InteractionInput): Promise<InteractionOutput> {
    return profileAsync(`InteractionTool.execute[${input.operationType}]`, async () => {
    // Validate inputs for operations that need them
    const requiresIndex = ['click', 'input_text', 'clear'];
    
    if (requiresIndex.includes(input.operationType) && input.index === undefined) {
      return {
        success: false,
        operationType: input.operationType,
        message: `${input.operationType} operation requires index parameter`
      };
    }
    
    switch (input.operationType) {
      case 'input_text':
        if (!input.text) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'input_text operation requires text parameter'
          };
        }
        break;
      case 'send_keys':
        if (!input.keys) {
          return {
            success: false,
            operationType: input.operationType,
            message: 'send_keys operation requires keys parameter'
          };
        }
        break;
    }

    try {
      // Get the current page
      const page = await this.executionContext.browserContext.getCurrentPage();
      
      // Execute the operation
      switch (input.operationType) {
        case 'click':
          return await this.clickElement(page, input.index!);
        
        case 'input_text':
          return await this.inputText(page, input.index!, input.text!);
        
        case 'clear':
          return await this.clearElement(page, input.index!);
        
        case 'send_keys':
          return await this.sendKeys(page, input.keys!);
        
        default:
          return {
            success: false,
            operationType: 'click',
            message: 'Invalid operation type specified'
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: input.operationType,
        message: `Interaction failed: ${errorMessage}`
      };
    }
    });
  }

  /**
   * Click an element
   */
  private async clickElement(page: BrowserPage, index: number): Promise<InteractionOutput> {
    return profileAsync(`InteractionTool.clickElement[${index}]`, async () => {
    try {
      // Get the element from the selector map
      const element = await page.getElementByIndex(index);
      
      if (!element) {
        return {
          success: false,
          operationType: 'click',
          message: `Element with index ${index} not found`
        };
      }

      // Log element details before clicking
      Logging.log('InteractionTool', `Clicking element at index ${index}:`, 'info');
      Logging.log('InteractionTool', `  - NodeId: ${element.nodeId}`, 'info');
      Logging.log('InteractionTool', `  - Text: "${element.name || '(no text)'}"`, 'info');
      Logging.log('InteractionTool', `  - Tag: <${element.attributes?.['html-tag'] || 'unknown'}>`, 'info');
      Logging.log('InteractionTool', `  - Type: ${element.type}`, 'info');

      // Check if element is a file uploader
      if (page.isFileUploader(element)) {
        return {
          success: false,
          operationType: 'click',
          message: `Element ${index} opens a file upload dialog. File uploads are not supported in automated mode.`,
          elementInfo: {
            tagName: element.attributes?.['html-tag'] || 'unknown',
            type: 'file'
          }
        };
      }

      // Get initial state before click
      const initialUrl = page.url();
      const initialTabIds = await this.executionContext.browserContext.getAllTabIds();

      // Click the element (V2 doesn't support vision)
      await page.clickElement(element.nodeId);
      
      // Simple wait after interaction
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      let newTabOpened = false;
      
      // Check for new tabs
      const currentTabIds = await this.executionContext.browserContext.getAllTabIds();
      newTabOpened = currentTabIds.size > initialTabIds.size;
      
      if (newTabOpened) {
        const newTabId = Array.from(currentTabIds).find(id => !initialTabIds.has(id));
        if (newTabId) {
          Logging.log('InteractionTool', `New tab opened with ID: ${newTabId}`, 'info');
          await this.executionContext.browserContext.switchTab(newTabId);
        }
      }

      // Get element info for response
      const elementInfo = {
        tagName: element.attributes?.['html-tag'] || 'unknown',
        text: element.name || ''
      };

      Logging.log('InteractionTool', `Successfully clicked element at index ${index}`, 'info');

      return {
        success: true,
        operationType: 'click',
        message: `Clicked element with index ${index}: ${elementInfo.text}`,
        elementInfo,
        newTabOpened
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      if (errorMessage.includes('no longer available')) {
        return {
          success: false,
          operationType: 'click',
          message: `Element ${index} is no longer available - the page may have changed`
        };
      }
      
      return {
        success: false,
        operationType: 'click',
        message: `Failed to click element ${index}: ${errorMessage}`
      };
    }
    });
  }

  /**
   * Input text into an element
   */
  private async inputText(page: BrowserPage, index: number, text: string): Promise<InteractionOutput> {
    return profileAsync(`InteractionTool.inputText[${index}]`, async () => {
    try {
      // Get the element from the selector map
      const element = await page.getElementByIndex(index);
      
      if (!element) {
        return {
          success: false,
          operationType: 'input_text',
          message: `Element with index ${index} not found`
        };
      }

      // Log element details before inputting text
      Logging.log('InteractionTool', `Inputting text into element at index ${index}:`, 'info');
      Logging.log('InteractionTool', `  - NodeId: ${element.nodeId}`, 'info');
      Logging.log('InteractionTool', `  - Text: "${element.name || '(no text)'}"`, 'info');
      Logging.log('InteractionTool', `  - Tag: <${element.attributes?.['html-tag'] || 'unknown'}>`, 'info');
      Logging.log('InteractionTool', `  - Type: ${element.type}`, 'info');
      Logging.log('InteractionTool', `  - Input text: "${text}"`, 'info');

      // Input the text (V2 doesn't support vision)
      await page.inputText(element.nodeId, text);
      
      // Get element info for response
      const elementInfo = {
        tagName: element.attributes?.['html-tag'] || 'unknown',
        type: 'text',
        value: text
      };

      Logging.log('InteractionTool', `Successfully input text into element at index ${index}`, 'info');

      return {
        success: true,
        operationType: 'input_text',
        message: `Input text into element with index ${index}`,
        elementInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check for specific error types
      if (errorMessage.includes('not an input')) {
        return {
          success: false,
          operationType: 'input_text',
          message: `Element ${index} is not an input field`
        };
      }
      
      return {
        success: false,
        operationType: 'input_text',
        message: `Failed to input text into element ${index}: ${errorMessage}`
      };
    }
    });
  }

  /**
   * Clear text from an element
   */
  private async clearElement(page: BrowserPage, index: number): Promise<InteractionOutput> {
    return profileAsync(`InteractionTool.clearElement[${index}]`, async () => {
    try {
      // Get the element from the selector map
      const element = await page.getElementByIndex(index);
      
      if (!element) {
        return {
          success: false,
          operationType: 'clear',
          message: `Element with index ${index} not found`
        };
      }

      // Log element details before clearing
      Logging.log('InteractionTool', `Clearing element at index ${index}:`, 'info');
      Logging.log('InteractionTool', `  - NodeId: ${element.nodeId}`, 'info');
      Logging.log('InteractionTool', `  - Text: "${element.name || '(no text)'}"`, 'info');
      Logging.log('InteractionTool', `  - Tag: <${element.attributes?.['html-tag'] || 'unknown'}>`, 'info');
      Logging.log('InteractionTool', `  - Type: ${element.type}`, 'info');

      // Clear the element using the new V2 API
      await page.clearElement(element.nodeId);
      
      // Get element info for response
      const elementInfo = {
        tagName: element.attributes?.['html-tag'] || 'unknown',
        type: 'text',
        value: ''
      };

      Logging.log('InteractionTool', `Successfully cleared element at index ${index}`, 'info');

      return {
        success: true,
        operationType: 'clear',
        message: `Cleared element with index ${index}`,
        elementInfo
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        operationType: 'clear',
        message: `Failed to clear element ${index}: ${errorMessage}`
      };
    }
    });
  }

  /**
   * Send keyboard keys
   */
  private async sendKeys(page: BrowserPage, keys: string): Promise<InteractionOutput> {
    return profileAsync(`InteractionTool.sendKeys[${keys}]`, async () => {
    try {
      // Log the keys being sent
      Logging.log('InteractionTool', `Sending keys: "${keys}"`, 'info');
      
      await page.sendKeys(keys);
      
      return {
        success: true,
        operationType: 'send_keys',
        message: `Sent keys: ${keys}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operationType: 'send_keys',
        message: `Failed to send keys: ${errorMessage}`
      };
    }
    });
  }

} 
