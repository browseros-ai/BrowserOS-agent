import { z } from 'zod';
import { NxtscapeTool } from '../base/NxtscapeTool';
import { ToolConfig } from '../base/ToolConfig';
import { ExecutionContext } from '@/lib/runtime/ExecutionContext';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { withFlexibleStructuredOutput } from '@/lib/llm/utils/structuredOutput';
import { BrowserState } from '@/lib/browser/BrowserContext';
import { Logging } from '@/lib/utils/Logging';
import { profileAsync } from '@/lib/utils/Profiler';

/**
 * Schema for find element tool input
 */
export const FindElementInputSchema = z.object({
  elementDescription: z.string(),  // Natural language description of the element to find
  intent: z.string().optional()  // Optional context about why finding this element
});

export type FindElementInput = z.infer<typeof FindElementInputSchema>;

/**
 * Schema for find element tool output
 */
export const FindElementOutputSchema = z.object({
  success: z.boolean(),  // Whether an element was found
  index: z.number().optional(),  // Index of the found element
  confidence: z.enum(['high', 'medium', 'low']).optional(),  // Confidence in the match
  elementInfo: z.object({  // Information about the found element
    tagName: z.string(),  // HTML tag name
    text: z.string(),  // Visible text content
    attributes: z.record(z.string()).optional()  // Key attributes
  }).optional(),
  message: z.string()  // Human-readable result message
});

export type FindElementOutput = z.infer<typeof FindElementOutputSchema>;

/**
 * Tool for finding elements on a page using natural language descriptions
 * Uses Chrome BrowserOS V2 API for element identification
 */
export class FindElementTool extends NxtscapeTool<FindElementInput, FindElementOutput> {
  constructor(executionContext: ExecutionContext) {
    const config: ToolConfig<FindElementInput, FindElementOutput> = {
      name: 'find_element',
      description: 'Find an element on the page using a natural language description. Returns the element index to use with the interact tool. Uses AI to match your description to the best element.',
      category: 'navigation',
      version: '1.0.0',
      inputSchema: FindElementInputSchema,
      outputSchema: FindElementOutputSchema,
      examples: [
        {
          description: 'Find a submit button',
          input: { 
            elementDescription: 'submit button',
            intent: 'Looking for the form submission button'
          },
          output: {
            success: true,
            index: 23,
            confidence: 'high',
            elementInfo: {
              tagName: 'button',
              text: 'Submit',
              attributes: { type: 'submit' }
            },
            message: 'Found submit button at index 23 with high confidence'
          }
        },
        {
          description: 'Find an email input field',
          input: { 
            elementDescription: 'email address input field'
          },
          output: {
            success: true,
            index: 10,
            confidence: 'high',
            elementInfo: {
              tagName: 'input',
              text: '',
              attributes: { type: 'email', placeholder: 'Enter your email' }
            },
            message: 'Found email input field at index 10 with high confidence'
          }
        },
        {
          description: 'Element not found',
          input: { 
            elementDescription: 'login button'
          },
          output: {
            success: false,
            message: 'No element found matching "login button"'
          }
        }
      ],
      streamingConfig: {
        displayName: 'Find Element',
        icon: '🔍',
        progressMessage: 'Searching for element...'
      }
    };

    super(config, executionContext);
  }

  /**
   * Override: Generate contextual display message
   */
  getProgressMessage(args: FindElementInput): string {
    try {
      // Note: args should already be parsed by StreamEventProcessor

      const description = args?.elementDescription;
      const intent = args?.intent;

      if (intent) {
        return intent;
      } else if (description) {
        return `Finding: ${description}`;
      }

      return 'Searching for element...';
    } catch {
      return 'Searching for element...';
    }
  }

  /**
   * Override: Format result for display
   */
  FormatResultForUI(output: FindElementOutput): string {
    if (!output.success) {
      return `❌ ${output.message}`;
    }

    if (output.index !== undefined && output.confidence) {
      return `🔍 Found element at index ${output.index} (${output.confidence} confidence)`;
    }

    return `✅ ${output.message}`;
  }

  protected async execute(input: FindElementInput): Promise<FindElementOutput> {
    return profileAsync(`FindElementTool.execute[${input.elementDescription}]`, async () => {
    try {
      // Get browser state (V2 doesn't support vision/screenshots)
      const browserState = await this.executionContext.browserContext.getBrowserState();
      
      if (browserState.clickableElements.length === 0) {
        return {
          success: false,
          message: 'No clickable elements found on the current page'
        };
      }

      // Use LLM to find the element
      const result = await this.findElementWithLLM(
        input.elementDescription,
        browserState,
      );

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        message: `Failed to find element: ${errorMessage}`
      };
    }
    });
  }

  /**
   * Find element using LLM with structured output
   * Uses V2 browser state with unified element indexing
   */
  private async findElementWithLLM(
    description: string,
    browserState: BrowserState,
  ): Promise<FindElementOutput> {
    return profileAsync(`FindElementTool.findElementWithLLM[${description}]`, async () => {
    // Get LLM with low temperature for consistency
    const llm = await this.getLLM({ temperature: 0.1 });
    
    // Define output schema for LLM
    const findElementSchema = z.object({
      found: z.boolean().describe('Whether a matching element was found'),
      index: z.number().optional().describe('The index number of the best matching element'),
      confidence: z.enum(['high', 'medium', 'low']).optional().describe('Confidence level in the match'),
      reasoning: z.string().describe('Brief explanation of the decision')
    });
    
    // Create LLM with structured output using flexible schema handling
    const structuredLLM = await withFlexibleStructuredOutput(llm, findElementSchema);
    
    // Build system prompt
    const systemPrompt = `You are an expert at finding elements on web pages using Chrome BrowserOS V2 API.

Your task is to find the element that best matches the user's description.

**IMPORTANT INSTRUCTIONS:**
1. Elements are shown with nodeId in square brackets like [0], [1], [23], etc.
2. The nodeId is a sequential index assigned by Chrome BrowserOS to interactive elements
3. Return the NUMBER inside the brackets as the index (e.g., for [23] return 23)
4. Elements use a compact format with indentation showing DOM hierarchy:
   [nodeId] <T> <tag> "name" ctx:"context" path:"...>..." attr:"key=value ..."
   
   Where:
   - Indentation (spaces) indicates depth in the DOM tree
   - <T> is the type: <C> for clickable/selectable, <T> for typeable
   - <tag> is the HTML tag (button, input, a, div, etc.)
   - "name" is the visible text (truncated to 40 chars)
   - ctx:"context" shows surrounding text (truncated to 60 chars)
   - path:"...>..." shows last 3 ancestors in DOM (e.g., "nav>ul>a")
   - attr:"..." shows key attributes like type, placeholder, value, aria-label

   Examples:
   [1] <C> <button> "Submit" ctx:"Contact form - Send us a message" path:"main>form>button"
     [2] <C> <a> "Products" ctx:"Main navigation menu" path:"header>nav>a"
       [3] <C> <a> "Electronics" ctx:"Shop by category" path:"nav>ul>a"
   [10] <T> <input> "Email" ctx:"Sign up for newsletter" path:"footer>form>input" attr:"type=email placeholder=Enter your email"

5. The context field helps identify the element's purpose within the page
6. The path field shows the element's location in a concise format
7. Indentation visually shows parent-child relationships
8. Consider all available information when matching:
   - Type indicator (<C> or <T>)
   - HTML tag
   - Visible name/text
   - Context from surrounding elements
   - Path showing location
   - Attributes for inputs (type, placeholder, etc.)
9. Choose the SINGLE BEST match if multiple candidates exist

**SCREENSHOT GUIDANCE:**
If a screenshot is provided, use it for spatial awareness of the page layout:
- Visual positioning helps disambiguate elements with similar text
- Layout context shows which elements are grouped together
- Visual prominence (size, color, position) indicates importance
- Use the screenshot to understand the overall page structure and make better decisions

**Return format:**
- found: true if a matching element exists, false otherwise
- index: the nodeId of the element (the number inside the brackets)
- confidence: your confidence level (high/medium/low)
- reasoning: brief explanation of why you chose this element`;

    // Get DOM content as text
    // const domContent = browserState.hierarchicalStructure || browserState.clickableElementsString || '';
    const domContent = browserState.clickableElementsString + '\n' + browserState.typeableElementsString;
    
    // Build user message
    let userMessage: HumanMessage;
    
    // Check if screenshot is available
    if (browserState.screenshot) {
      // Create multi-modal message with text and screenshot
      userMessage = new HumanMessage({
        content: [
          { 
            type: 'text', 
            text: `Find the element matching this description: "${description}"

Interactive elements on the page:
${domContent}` 
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${browserState.screenshot}` }
          }
        ]
      });
    } else {
      // Text-only message
      userMessage = new HumanMessage(
        `Find the element matching this description: "${description}"

Interactive elements on the page:
${domContent}`
      );
    }

    try {
      // Get LLM response
      const llmResult = await structuredLLM.invoke([
        new SystemMessage(systemPrompt),
        userMessage
      ]);

      // Handle not found case
      if (!llmResult.found || llmResult.index === undefined) {
        return {
          success: false,
          message: llmResult.reasoning || `No element found matching "${description}"`
        };
      }

      // The index returned by LLM is actually the nodeId (they're the same in V2)
      const foundInClickable = browserState.clickableElements.find(element => element.nodeId === llmResult.index);
      const foundInTypeable = browserState.typeableElements.find(element => element.nodeId === llmResult.index);
      
      if (!foundInClickable && !foundInTypeable) {
        return {
          success: false,
          message: `Invalid index ${llmResult.index} returned - element not found in browser state`
        };
      }
      
      // Log the found element details
      const foundElement = foundInClickable || foundInTypeable;
      Logging.log('FindElementTool', `Found element at index ${llmResult.index}:`, 'info');
      Logging.log('FindElementTool', `  - Text: "${foundElement?.text || '(no text)'}"`, 'info');
      Logging.log('FindElementTool', `  - Tag: <${foundElement?.tag || 'unknown'}>`, 'info');
      Logging.log('FindElementTool', `  - Type: ${foundInClickable ? 'clickable' : 'typeable'}`, 'info');
      Logging.log('FindElementTool', `  - Confidence: ${llmResult.confidence}`, 'info');
      Logging.log('FindElementTool', `  - LLM Reasoning: ${llmResult.reasoning}`, 'info');
      
      // Return successful result with limited info since we don't have direct element access
      return {
        success: true,
        index: llmResult.index,
        confidence: llmResult.confidence,
        elementInfo: {
          tagName: foundElement?.tag || 'element',  // Use actual tag
          text: foundElement?.text || '',  // Use actual text
          attributes: {}
        },
        message: `Found ${description} at index ${llmResult.index} with ${llmResult.confidence} confidence`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`LLM element finding failed: ${errorMessage}`);
    }
    });
  }

}
