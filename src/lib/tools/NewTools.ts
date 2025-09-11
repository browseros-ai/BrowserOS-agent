/**
 * NewTools - Migrated tools from NewAgent.ts
 *
 * IMPORTANT: These tools maintain EXACT functionality from NewAgent.ts
 * They are designed to work with an extended ExecutionContext that provides
 * all necessary dependencies.
 */

import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { Logging } from "@/lib/utils/Logging";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

// Tool result schema - EXACT from NewAgent
const ToolResultSchema = z.object({
  ok: z.boolean(),
  output: z.any().optional(),
  error: z.string().optional(),
});

type ToolResult = z.infer<typeof ToolResultSchema>;

/**
 * Create all NewAgent tools with the provided context
 */
export function createNewTools(
  context: ExecutionContext,
): DynamicStructuredTool[] {
  return [
    // createObserveTool(context),
    // createVisualObserveTool(context),
    createMoondreamVisualClickTool(context),
    createMoondreamVisualTypeTool(context),
    // createClickAtCoordinatesTool(context),
    // createTypeAtCoordinatesTool(context),
    createTypeTool(context),
    createClearTool(context),
    createScrollTool(context),
    createNavigateTool(context),
    createKeyTool(context),
    createWaitTool(context),
    createTodoSetTool(context),
    createTodoGetTool(context),
    createTabsTool(context),
    createTabOpenTool(context),
    createTabFocusTool(context),
    createTabCloseTool(context),
    createExtractTool(context),
    createHumanInputTool(context),
    createDoneTool(context),
  ];
}

// ============= Individual Tool Implementations =============

// Define the output schema for observe tool
const ObserveResultSchema = z.object({
  done: z.boolean().describe("User goal met"),
  status: z
    .enum(["on_track", "stalled", "off_track", "blocked"])
    .describe("Overall state vs goal"),
  making_progress: z.boolean().describe("Binary progress signal"),
  loop_detected: z.boolean().describe("Are we repeating without progress?"),
  diagnosis: z.string().describe("1-2 sentence blunt analysis"),
  mistakes: z
    .array(z.string())
    .max(5)
    .default([])
    .describe("Terse mistake descriptions"),
  next_steps: z
    .array(z.string())
    .min(1)
    .max(5)
    .describe("Precise, actionable steps (imperative)"),
  evidence: z
    .array(z.string())
    .max(5)
    .default([])
    .describe("Visual/DOM cues backing diagnosis"),
  note: z.array(z.string()).max(5).default([]).describe("Short tips, gotchas"),
});

type ObserveResult = z.infer<typeof ObserveResultSchema>;

// Observe tool input schema (no input)
const ObserveInputSchema = z.object({});
type ObserveInput = z.infer<typeof ObserveInputSchema>;

export function createVisualObserveTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "observe",
    description:
      "Assess current state, progress, and suggest next steps. Takes no arguments, always captures screenshot.",
    schema: ObserveInputSchema,
    func: async (args: ObserveInput) => {
      try {
        context.incrementMetric("observations");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🔍 Observing page state...", "thinking")
        );

        // Constants for context building
        const RECENT_HISTORY_COUNT = 10;

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // 2. Gather comprehensive state
        const pageDetails = await page.getPageDetails();
        const goal = context.getCurrentTask() || "";
        const todos = context.getTodoList();
        const recentHistory =
          context.getSimplifiedMessageHistory(RECENT_HISTORY_COUNT);

        // Capture screenshot for visual analysis
        const screenshot = await page.takeScreenshot("large", true);

        if (!screenshot) {
          Logging.log(
            "NewAgent",
            "Failed to capture screenshot for observe",
            "warning",
          );
        }

        // 4. Build LLM context
        const llm = await context.getLLM({
          temperature: 0.2, // Low temp for consistent analysis
          maxTokens: 4096,
        });

        const structuredLLM = llm.withStructuredOutput(ObserveResultSchema);

        // 5. Create strict mistake-focused system prompt
        const systemPrompt = `You are a visual browser task assessor. Given the GOAL, recent actions, current page, and screenshot:

CLASSIFY the situation:
- status: 'on_track' (progressing), 'stalled' (looping), 'off_track' (wrong direction), or 'blocked' (can't proceed)
- making_progress: true if state changed meaningfully toward goal
- loop_detected: true if repeating same failed actions

IDENTIFY MISTAKES from visual analysis (be specific):
1. Wrong visual target: interacted with incorrect element based on appearance
2. Misidentified element: clicked/typed in visually similar but wrong element
3. Repeated action: same visual action with no visible state change
4. Missing verification: didn't wait for visual confirmation after action

PROVIDE CORRECTIONS (visual-based guidance):
- Describe WHAT to do visually: "Click the blue submit button" not specific IDs
- Focus on visual intent: "Type in the search box with magnifying glass icon"
- Use visual descriptions: "Navigate to login page", "Clear the text field labeled 'Email'"
- Be visually goal-oriented: "Submit the form with green button", "Wait for results list to appear"

SET FLAGS:
- done=true ONLY when screenshot shows clear visual success evidence matching the GOAL

IMPORTANT: Rely entirely on visual analysis of the screenshot to understand the current page state and determine appropriate next actions.

Return ONLY valid JSON per the schema.`;

        // 6. Build user prompt with all context
        const userPrompt = `GOAL: ${goal}

RECENT (last ${RECENT_HISTORY_COUNT}):
${recentHistory.join("\n")}

STATE:
- Page: ${pageDetails.title} (${pageDetails.url})
- Errors: ${context.getExecutionMetrics().errors}
- Todos: ${todos || "None"}

Analyze the screenshot to determine the current state and next steps.

Return JSON only.`;

        // 7. Build messages array
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ];

        // Add screenshot if available
        if (screenshot) {
          messages.push(
            new HumanMessage({
              content: [
                { type: "text", text: "Current page screenshot:" },
                { type: "image_url", image_url: { url: screenshot } },
              ],
            })
          );
        }

        // 8. Invoke LLM for analysis
        const result = await structuredLLM.invoke(messages);

        // 9. Append to message manager
        // Always add screenshot when available
        if (screenshot) {
          // Queue screenshot to be added after tool results
          context.messageManager.queueScreenshot(
            screenshot,
            `Screenshot for next action - ${result.diagnosis}`,
          );
        }

        // Build feedback message
        const feedbackParts = [
          `OBSERVATION FEEDBACK:`,
          `Status: ${result.status}`,
          `Diagnosis: ${result.diagnosis}`,
        ];

        if (result.mistakes && result.mistakes.length > 0) {
          feedbackParts.push(`Mistakes: ${result.mistakes.join("; ")}`);
        }

        if (result.next_steps && result.next_steps.length > 0) {
          feedbackParts.push(`Next: ${result.next_steps[0]}`);
        }

        const feedback = feedbackParts.join("\n");

        // Determine screenshot status
        const screenshotStatus = screenshot
          ? "Screenshot captured and available"
          : "Screenshot capture failed";

        // Return same format as old observe tool, with feedback added
        const toolResultJson = JSON.stringify({
          ok: true,
          output: {
            url: pageDetails.url,
            title: pageDetails.title,
            screenshot: screenshotStatus,
            feedback: feedback,
          },
        });

        // Log for debugging
        Logging.log(
          "NewAgent",
          `Observe: ${result.status} - ${result.diagnosis}`,
          result.status === "on_track" ? "info" : "warning",
        );

        if (result.loop_detected) {
          Logging.log("NewAgent", "Loop detected!", "error");
        }

        return toolResultJson;
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Observe failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

export function createObserveTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "observe",
    description:
      "Assess current state, progress, and suggest next steps. Takes no arguments, always captures screenshot.",
    schema: ObserveInputSchema,
    func: async (args: ObserveInput) => {
      try {
        context.incrementMetric("observations");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🔍 Observing page state...", "thinking")
        );

        // Constants for context building
        const RECENT_HISTORY_COUNT = 10;

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // 2. Gather comprehensive state
        const pageDetails = await page.getPageDetails();
        const goal = context.getCurrentTask() || "";
        const todos = context.getTodoList();
        const recentHistory =
          context.getSimplifiedMessageHistory(RECENT_HISTORY_COUNT);

        // 3. Get DOM elements (full, not trimmed)
        const clickableElements = await page.getClickableElementsString(false);
        const typeableElements = await page.getTypeableElementsString(false);

        // Capture screenshot for visual analysis
        const screenshot = await page.takeScreenshot("large", true);

        if (!screenshot) {
          Logging.log(
            "NewAgent",
            "Failed to capture screenshot for observe",
            "warning",
          );
        }

        // 4. Build LLM context
        const llm = await context.getLLM({
          temperature: 0.2, // Low temp for consistent analysis
          maxTokens: 4096,
        });

        const structuredLLM = llm.withStructuredOutput(ObserveResultSchema);

        // 5. Create strict mistake-focused system prompt
        const systemPrompt = `You are a ruthless browser task assessor. Given the GOAL, recent actions, current page, DOM digest, and screenshot:

CLASSIFY the situation:
- status: 'on_track' (progressing), 'stalled' (looping), 'off_track' (wrong direction), or 'blocked' (can't proceed)
- making_progress: true if state changed meaningfully toward goal
- loop_detected: true if repeating same failed actions

IDENTIFY MISTAKES (be specific):
1. Wrong field: typed value in incorrect input (check label/placeholder/name)
2. Wrong element: clicked similar but incorrect button/link
3. Repeated action: same tool+args with no state change
4. Missing verification: didn't wait or confirm after action

PROVIDE CORRECTIONS (high-level strategic guidance):
- Describe WHAT to do, not HOW: "Sign in with credentials" not "click [23]"
- Focus on intent: "Search for the query term" not specific field IDs
- Use semantic descriptions: "Navigate to login page", "Clear the email field and enter search term"
- Be goal-oriented: "Submit the form", "Wait for results to load"

SET FLAGS:
- done=true ONLY when page shows clear success evidence matching the GOAL

IMPORTANT: Screenshots may display nodeId numbers visually overlaid on elements. Use these visual indicators along with clickable elements to accurately analyze.

Return ONLY valid JSON per the schema.`;

        // 6. Build user prompt with all context
        const userPrompt = `GOAL: ${goal}

RECENT (last ${RECENT_HISTORY_COUNT}):
${recentHistory.join("\n")}

STATE:
- Page: ${pageDetails.title} (${pageDetails.url})
- Errors: ${context.getExecutionMetrics().errors}
- Todos: ${todos || "None"}

CLICKABLE ELEMENTS:
${clickableElements || "No clickable elements"}

TYPEABLE ELEMENTS:
${typeableElements || "No typeable elements"}

Return JSON only.`;

        // 7. Build messages array
        const messages = [
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt),
        ];

        // Add screenshot if available
        if (screenshot) {
          messages.push(
            new HumanMessage({
              content: [
                { type: "text", text: "Current page screenshot:" },
                { type: "image_url", image_url: { url: screenshot } },
              ],
            })
          );
        }

        // 8. Invoke LLM for analysis
        const result = await structuredLLM.invoke(messages);

        // 9. Append to message manager
        // Always add screenshot when available
        if (screenshot) {
          // Queue screenshot to be added after tool results
          context.messageManager.queueScreenshot(
            screenshot,
            `Screenshot for next action - ${result.diagnosis}`,
          );
        }

        // Build feedback message
        const feedbackParts = [
          `OBSERVATION FEEDBACK:`,
          `Status: ${result.status}`,
          `Diagnosis: ${result.diagnosis}`,
        ];

        if (result.mistakes && result.mistakes.length > 0) {
          feedbackParts.push(`Mistakes: ${result.mistakes.join("; ")}`);
        }

        if (result.next_steps && result.next_steps.length > 0) {
          feedbackParts.push(`Next: ${result.next_steps[0]}`);
        }

        const feedback = feedbackParts.join("\n");

        // Determine screenshot status
        const screenshotStatus = screenshot
          ? "Screenshot captured and available"
          : "Screenshot capture failed";

        // Return same format as old observe tool, with feedback added
        const toolResultJson = JSON.stringify({
          ok: true,
          output: {
            url: pageDetails.url,
            title: pageDetails.title,
            screenshot: screenshotStatus,
            clickableElements: clickableElements || "No clickable elements",
            typeableElements: typeableElements || "No typeable elements",
            feedback: feedback,
          },
        });

        // Log for debugging
        Logging.log(
          "NewAgent",
          `Observe: ${result.status} - ${result.diagnosis}`,
          result.status === "on_track" ? "info" : "warning",
        );

        if (result.loop_detected) {
          Logging.log("NewAgent", "Loop detected!", "error");
        }

        return toolResultJson;
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Observe failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Click tool input schema
const ClickInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
    .describe("The nodeId number from [brackets] in element list"),
});
type ClickInput = z.infer<typeof ClickInputSchema>;

export function createClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click",
    description: "Click an element by its nodeId (number in brackets)",
    schema: ClickInputSchema,
    func: async (args: ClickInput) => {
      try {
        context.incrementMetric("toolCalls");

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element [${args.nodeId}] not found`,
          });
        }

        await page.clickElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked element [${args.nodeId}]${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click [${args.nodeId}]: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Type tool input schema
const TypeInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
    .describe("The nodeId number from [brackets] in element list"),
  text: z.string().describe("Text to type into the element"),
});
type TypeInput = z.infer<typeof TypeInputSchema>;

export function createTypeTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type",
    description: "Type text into an input element",
    schema: TypeInputSchema,
    func: async (args: TypeInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element [${args.nodeId}] not found`,
          });
        }

        await page.inputText(args.nodeId, args.text);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" into element [${args.nodeId}]${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type into [${args.nodeId}]: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Clear tool input schema
const ClearInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
    .describe("The nodeId number from [brackets] in element list"),
});
type ClearInput = z.infer<typeof ClearInputSchema>;

export function createClearTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "clear",
    description: "Clear text from an input element",
    schema: ClearInputSchema,
    func: async (args: ClearInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clearing text...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Ensure element is in viewport
        const { element, scrollMessage } = await page.ensureElementInViewport(
          args.nodeId,
        );
        if (!element) {
          return JSON.stringify({
            ok: false,
            error: `Element [${args.nodeId}] not found`,
          });
        }

        await page.clearElement(args.nodeId);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully cleared element [${args.nodeId}]${scrollMessage}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to clear [${args.nodeId}]: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Scroll tool input schema
const ScrollInputSchema = z.object({
  nodeId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("NodeId to scroll to (optional)"),
  direction: z
    .enum(["up", "down"])
    .optional()
    .describe("Direction to scroll page if no nodeId provided"),
  amount: z
    .number()
    .int()
    .positive()
    .optional()
    .default(1)
    .describe("Number of viewport heights to scroll (default: 1)"),
});
type ScrollInput = z.infer<typeof ScrollInputSchema>;

export function createScrollTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "scroll",
    description: "Scroll to a specific element or scroll the page",
    schema: ScrollInputSchema,
    func: async (args: ScrollInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Scrolling...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        const amount = args.amount || 1;

        if (args.nodeId) {
          const scrolled = await page.scrollToElement(args.nodeId);
          return JSON.stringify({
            ok: true,
            output: `Scrolled to element [${args.nodeId}]: ${scrolled ? "success" : "already visible"}`,
          });
        } else if (args.direction) {
          if (args.direction === "down") {
            await page.scrollDown(amount);
          } else {
            await page.scrollUp(amount);
          }
          return JSON.stringify({
            ok: true,
            output: `Scrolled ${args.direction} ${amount} viewport(s)`,
          });
        } else {
          return JSON.stringify({
            ok: false,
            error: "Must provide either nodeId or direction",
          });
        }
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Scroll failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Navigate tool input schema
const NavigateInputSchema = z.object({
  url: z
    .string()
    .url()
    .describe("Full URL to navigate to (must include https://)"),
});
type NavigateInput = z.infer<typeof NavigateInputSchema>;

export function createNavigateTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "navigate",
    description: "Navigate to a URL",
    schema: NavigateInputSchema,
    func: async (args: NavigateInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Navigating...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.navigateTo(args.url);
        await page.waitForStability();

        return JSON.stringify({
          ok: true,
          output: `Successfully navigated to ${args.url}`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Navigation failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Key tool input schema
const KeyInputSchema = z.object({
  key: z
    .enum([
      "Enter",
      "Tab",
      "Escape",
      "Backspace",
      "Delete",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ])
    .describe("Keyboard key to press"),
});
type KeyInput = z.infer<typeof KeyInputSchema>;

export function createKeyTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "key",
    description: "Send a keyboard key press",
    schema: KeyInputSchema,
    func: async (args: KeyInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Pressing key...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.sendKeys(args.key);

        return JSON.stringify({
          ok: true,
          output: `Pressed ${args.key} key`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Key press failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Wait tool input schema
const WaitInputSchema = z.object({
  seconds: z
    .number()
    .positive()
    .optional()
    .default(1)
    .describe("Additional seconds to wait (default: 1)"),
});
type WaitInput = z.infer<typeof WaitInputSchema>;

export function createWaitTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "wait",
    description: "Wait for page to stabilize after actions",
    schema: WaitInputSchema,
    func: async (args: WaitInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Waiting for ${args.seconds}...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        await page.waitForStability();
        const waitSeconds = args.seconds || 2;
        if (waitSeconds > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, waitSeconds * 1000),
          );
        }

        return JSON.stringify({
          ok: true,
          output: `Waited ${waitSeconds} seconds for stability`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Wait failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TodoSet tool input schema
const TodoSetInputSchema = z.object({
  todos: z.string().describe("Markdown formatted todo list"),
});
type TodoSetInput = z.infer<typeof TodoSetInputSchema>;

export function createTodoSetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_set",
    description:
      "Set or update the TODO list with markdown checkboxes (- [ ] pending, - [x] done)",
    schema: TodoSetInputSchema,
    func: async (args: TodoSetInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(args.todos, "thinking")
        );
        context.setTodoList(args.todos);

        Logging.log(
          "NewAgent",
          `Updated todo list: ${args.todos.split("\n").length} items`,
          "info",
        );

        return JSON.stringify({
          ok: true,
          output: "Todos updated",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to update todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TodoGet tool input schema (no input)
const TodoGetInputSchema = z.object({});
type TodoGetInput = z.infer<typeof TodoGetInputSchema>;

export function createTodoGetTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "todo_get",
    description: "Get the current TODO list",
    schema: TodoGetInputSchema,
    func: async (args: TodoGetInput) => {
      try {
        context.incrementMetric("toolCalls");

        return JSON.stringify({
          ok: true,
          output: context.getTodoList() || "No todos yet",
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to get todos: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Tabs tool input schema (no input)
const TabsInputSchema = z.object({});
type TabsInput = z.infer<typeof TabsInputSchema>;

export function createTabsTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tabs",
    description: "List all tabs in the current browser window",
    schema: TabsInputSchema,
    func: async (args: TabsInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Listing browser tabs...", "thinking")
        );

        // Get current window
        const currentWindow = await chrome.windows.getCurrent();

        // Get tabs in current window
        const tabs = await chrome.tabs.query({
          windowId: currentWindow.id,
        });

        // Format tab info
        const tabList = tabs
          .filter((tab) => tab.id !== undefined)
          .map((tab) => ({
            id: tab.id!,
            title: tab.title || "Untitled",
            url: tab.url || "",
            active: tab.active || false,
          }));

        return JSON.stringify({
          ok: true,
          output: tabList,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to list tabs: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabOpen tool input schema
const TabOpenInputSchema = z.object({
  url: z
    .string()
    .url()
    .optional()
    .describe("URL to open (optional, defaults to new tab page)"),
});
type TabOpenInput = z.infer<typeof TabOpenInputSchema>;

export function createTabOpenTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_open",
    description: "Open a new browser tab with optional URL",
    schema: TabOpenInputSchema,
    func: async (args: TabOpenInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Opening tab...", "thinking")
        );

        const targetUrl = args.url || "chrome://newtab/";
        const page = await context.browserContext.openTab(targetUrl);

        return JSON.stringify({
          ok: true,
          output: {
            tabId: page.tabId,
            url: targetUrl,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to open tab: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabFocus tool input schema
const TabFocusInputSchema = z.object({
  tabId: z.number().int().positive().describe("Tab ID to focus"),
});
type TabFocusInput = z.infer<typeof TabFocusInputSchema>;

export function createTabFocusTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_focus",
    description: "Switch focus to a specific tab by ID",
    schema: TabFocusInputSchema,
    func: async (args: TabFocusInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Switching tab...", "thinking")
        );

        // Switch to tab using browserContext
        await context.browserContext.switchTab(args.tabId);

        // Get tab info for confirmation
        const tab = await chrome.tabs.get(args.tabId);

        // Note: In NewAgent, this updates this.page reference
        // The caller will need to handle updating the current page reference

        return JSON.stringify({
          ok: true,
          output: `Focused tab: ${tab.title || "Untitled"} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to focus tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// TabClose tool input schema
const TabCloseInputSchema = z.object({
  tabId: z.number().int().positive().describe("Tab ID to close"),
});
type TabCloseInput = z.infer<typeof TabCloseInputSchema>;

export function createTabCloseTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "tab_close",
    description: "Close a specific tab by ID",
    schema: TabCloseInputSchema,
    func: async (args: TabCloseInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Closing tab...", "thinking")
        );

        // Verify tab exists
        const tab = await chrome.tabs.get(args.tabId);
        const title = tab.title || "Untitled";

        // Close tab using browserContext
        await context.browserContext.closeTab(args.tabId);

        // Note: In NewAgent, this updates this.page reference
        // The caller will need to handle updating the current page reference

        return JSON.stringify({
          ok: true,
          output: `Closed tab: ${title} (ID: ${args.tabId})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to close tab ${args.tabId}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

export function createExtractTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "extract",
    description:
      "Extract structured data from current page using AI. Provide a JSON format object and description of what to extract.",
    schema: z.object({
      format: z
        .any()
        .describe(
          "JSON object showing desired output structure (e.g., {title: '', price: 0, items: []})",
        ),
      task: z
        .string()
        .describe("Description of what data to extract from the page"),
    }),
    func: async ({ format, task }: { format: any; task: string }) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Extracting data from page...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get all page content using simplified string methods
        const pageDetails = await page.getPageDetails();
        const textContent = await page.getTextSnapshotString();
        const linksContent = await page.getLinksSnapshotString();

        // Merge all content into comprehensive context
        const pageContext = {
          url: pageDetails.url,
          title: pageDetails.title,
          text: textContent || "No text content",
          links: linksContent || "No links found",
        };

        // Get LLM instance
        const llm = await context.getLLM({
          temperature: 0.1,
          maxTokens: 8000,
        });

        // Create extraction prompt
        const systemPrompt =
          "You are a data extraction specialist. Extract the requested information from the page content and return it in the exact JSON structure provided.";

        const userPrompt = `Task: ${task}

Desired output format:
${JSON.stringify(format, null, 2)}

Page content:
URL: ${pageContext.url}
Title: ${pageContext.title}

Text content:
${pageContext.text.substring(0, 8000)}${pageContext.text.length > 8000 ? "...[truncated]" : ""}

Links found:
${pageContext.links.substring(0, 2000)}${pageContext.links.length > 2000 ? "\n...[more links]" : ""}

Extract the requested data and return it matching the exact structure of the format provided.`;

        Logging.log(
          "NewAgent",
          `Extracting data with format: ${JSON.stringify(format)}`,
          "info",
        );

        // Just invoke LLM without structured output - let it figure out the JSON
        const response = await llm.invoke([
          new SystemMessage(
            systemPrompt +
            "\n\nIMPORTANT: Return ONLY valid JSON, no explanations or markdown."
          ),
          new HumanMessage(userPrompt),
        ]);

        // Try to parse the JSON response
        try {
          const content = response.content as string;
          // Clean up response - remove markdown code blocks if present
          const cleanedContent = content
            .replace(/```json\s*/gi, "")
            .replace(/```\s*/g, "")
            .trim();

          const extractedData = JSON.parse(cleanedContent);

          return JSON.stringify({
            ok: true,
            output: extractedData,
          });
        } catch (parseError) {
          // If parsing fails, return the raw response with an error
          return JSON.stringify({
            ok: false,
            error: `Failed to parse extraction result as JSON. Raw output: ${response.content}`,
          });
        }
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Extraction failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// HumanInput tool input schema
const HumanInputSchema = z.object({
  prompt: z.string().describe("The situation requiring human intervention"),
});
type HumanInput = z.infer<typeof HumanInputSchema>;

export function createHumanInputTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "human_input",
    description: `Request human intervention when stuck or need manual action.

Use this when:
- You need the human to manually complete a step (enter credentials, solve CAPTCHA, etc.)
- You're blocked and need the human to take over temporarily  
- You encounter an error that requires human judgment
- You need confirmation before proceeding with a risky action

The human will either click "Done" (after taking action) or "Abort task" (to cancel).`,
    schema: HumanInputSchema,
    func: async (args: HumanInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("⏸️ Requesting human input...", "thinking")
        );

        // Generate unique request ID
        const requestId = PubSubChannel.generateId("human_input");

        // Store request ID in execution context for later retrieval
        context.setHumanInputRequestId(requestId);

        // Publish message to UI showing we're waiting
        const messageId = PubSubChannel.generateId("human_input_msg");
        context
          .getPubSub()
          .publishMessage(
            PubSubChannel.createMessageWithId(
              messageId,
              `⏸️ **Waiting for human input:** ${args.prompt}`,
              "thinking",
            ),
          );

        // Publish special event for UI to show the dialog
        context.getPubSub().publishHumanInputRequest({
          requestId,
          prompt: args.prompt,
        });

        // Return immediately with special flag
        return JSON.stringify({
          ok: true,
          output: `Waiting for human input: ${args.prompt}`,
          requiresHumanInput: true, // Special flag for execution loop
          requestId,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  });
}

// Done tool input schema
const DoneInputSchema = z.object({
  success: z.boolean().describe("Whether the task was completed successfully"),
  message: z
    .string()
    .optional()
    .describe("Completion message or reason for failure"),
});
type DoneInput = z.infer<typeof DoneInputSchema>;

export function createDoneTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "done",
    description: "Mark the task as complete",
    schema: DoneInputSchema,
    func: async (args: DoneInput) => {
      context.incrementMetric("toolCalls");

      return JSON.stringify({
        ok: true,
        output: {
          success: args.success,
        },
      });
    },
  });
}

// Moondream Visual Click Tool
const MoondreamVisualClickInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Describe what to click on (e.g., 'button', 'blue submit button', 'search icon')",
    ),
});
type MoondreamVisualClickInput = z.infer<
  typeof MoondreamVisualClickInputSchema
>;

// Moondream API response type
interface MoondreamPointResponse {
  request_id?: string;
  points: Array<{ x: number; y: number }>;
  error?: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

export function createMoondreamVisualClickTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "visual_click",
    description:
      "Click on any element by describing what it looks like. Pass a clear description like 'blue submit button', 'search icon', 'first checkbox', 'close button in modal', etc.",
    schema: MoondreamVisualClickInputSchema,
    func: async (args: MoondreamVisualClickInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("🎯 Clicking...", "thinking")
        );

        // Get API key from args or environment
        const apiKey = process.env.MOONDREAM_API_KEY;
        if (!apiKey) {
          return JSON.stringify({
            ok: false,
            error: "Vision API key not provided.",
          });
        }

        // Get current page
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Take screenshot with exact viewport dimensions for accurate coordinate mapping
        const screenshot = await page.takeScreenshotWithDimensions(
          viewport.width,
          viewport.height,
          false, // no highlights
        );
        if (!screenshot) {
          return JSON.stringify({
            ok: false,
            error: "Failed to capture screenshot for Moondream visual click",
          });
        }

        // Call Moondream API
        const response = await fetch("https://api.moondream.ai/v1/point", {
          method: "POST",
          headers: {
            "X-Moondream-Auth": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: screenshot,
            object: args.instruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error?.message || `API error: ${response.status}`;
          return JSON.stringify({
            ok: false,
            error: `Moondream API error: ${errorMessage}`,
          });
        }

        const data: MoondreamPointResponse = await response.json();

        // Check if any points were found
        if (!data.points || data.points.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No "${args.instruction}" found on the page`,
          });
        }

        // Use the first point (most confident match)
        const point = data.points[0];

        // Convert normalized coordinates (0-1) to viewport pixels
        // Since we took screenshot with exact viewport dimensions, mapping is direct
        const x = Math.round(point.x * viewport.width);
        const y = Math.round(point.y * viewport.height);

        // Use the clickAtCoordinates method (which internally calls clickCoordinates API)
        await page.clickAtCoordinates(x, y);

        return JSON.stringify({
          ok: true,
          output: {
            coordinates: { x, y },
            description: `Clicked "${args.instruction}" at (${x}, ${y})`,
            pointsFound: data.points.length,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Moondream click failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Moondream Visual Type Tool
const MoondreamVisualTypeInputSchema = z.object({
  instruction: z
    .string()
    .describe(
      "Describe the input field to type in (e.g., 'search box', 'email field', 'password input')",
    ),
  text: z.string().describe("Text to type into the identified field"),
});
type MoondreamVisualTypeInput = z.infer<typeof MoondreamVisualTypeInputSchema>;

export function createMoondreamVisualTypeTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "visual_type",
    description:
      "Type text into any input field by describing what it looks like. Pass a clear description like 'search box', 'email field', 'username input', 'comment textarea', etc.",
    schema: MoondreamVisualTypeInputSchema,
    func: async (args: MoondreamVisualTypeInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`⌨️ Typing "${args.text}"...`, "thinking")
        );

        // Get API key from environment
        const apiKey = process.env.MOONDREAM_API_KEY;
        if (!apiKey) {
          return JSON.stringify({
            ok: false,
            error: "Vision API key not provided.",
          });
        }

        // Get current page
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Take screenshot with exact viewport dimensions
        const screenshot = await page.takeScreenshotWithDimensions(
          viewport.width,
          viewport.height,
          false, // no highlights
        );
        if (!screenshot) {
          return JSON.stringify({
            ok: false,
            error: "Failed to capture screenshot for Moondream visual type",
          });
        }

        // Call Moondream API to find the input field
        const response = await fetch("https://api.moondream.ai/v1/point", {
          method: "POST",
          headers: {
            "X-Moondream-Auth": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            image_url: screenshot,
            object: args.instruction,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const errorMessage =
            errorData.error?.message || `API error: ${response.status}`;
          return JSON.stringify({
            ok: false,
            error: `Moondream API error: ${errorMessage}`,
          });
        }

        const data: MoondreamPointResponse = await response.json();

        // Check if any points were found
        if (!data.points || data.points.length === 0) {
          return JSON.stringify({
            ok: false,
            error: `No "${args.instruction}" found on the page`,
          });
        }

        // Use the first point (most confident match)
        const point = data.points[0];

        // Convert normalized coordinates (0-1) to viewport pixels
        const x = Math.round(point.x * viewport.width);
        const y = Math.round(point.y * viewport.height);

        // Use the typeAtCoordinates method (which internally calls typeAtCoordinates API)
        await page.typeAtCoordinates(x, y, args.text);

        return JSON.stringify({
          ok: true,
          output: {
            coordinates: { x, y },
            description: `Typed "${args.text}" into "${args.instruction}" at (${x}, ${y})`,
            pointsFound: data.points.length,
          },
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Moondream type failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Click at coordinates tool
const ClickAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
});
type ClickAtCoordinatesInput = z.infer<typeof ClickAtCoordinatesInputSchema>;

export function createClickAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "click_at_coordinates",
    description:
      "Click at specific viewport coordinates (x, y). Use when you have exact pixel coordinates where you want to click.",
    schema: ClickAtCoordinatesInputSchema,
    func: async (args: ClickAtCoordinatesInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage("Clicking...", "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions for validation
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Validate coordinates are within viewport bounds
        if (args.x < 0 || args.x > viewport.width) {
          return JSON.stringify({
            ok: false,
            error: `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          return JSON.stringify({
            ok: false,
            error: `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`,
          });
        }

        // Execute the click
        await page.clickAtCoordinates(args.x, args.y);

        return JSON.stringify({
          ok: true,
          output: `Successfully clicked at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to click at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// Type at coordinates tool
const TypeAtCoordinatesInputSchema = z.object({
  x: z.number().int().nonnegative().describe("X coordinate in viewport pixels"),
  y: z.number().int().nonnegative().describe("Y coordinate in viewport pixels"),
  text: z.string().describe("Text to type at the specified coordinates"),
});
type TypeAtCoordinatesInput = z.infer<typeof TypeAtCoordinatesInputSchema>;

export function createTypeAtCoordinatesTool(
  context: ExecutionContext,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "type_at_coordinates",
    description:
      "Type text at specific viewport coordinates (x, y). The tool will first click at the coordinates to focus, then type the text. Use when you have exact pixel coordinates for a text input field.",
    schema: TypeAtCoordinatesInputSchema,
    func: async (args: TypeAtCoordinatesInput) => {
      try {
        context.incrementMetric("toolCalls");
        
        // Emit thinking message
        context.getPubSub().publishMessage(
          PubSubChannel.createMessage(`Typing "${args.text}"...`, "thinking")
        );

        // Get current page from browserContext
        const page = await context.browserContext.getCurrentPage();

        // Get viewport dimensions for validation
        const viewport = await page.executeJavaScript(`
          ({ width: window.innerWidth, height: window.innerHeight })
        `);

        // Validate coordinates are within viewport bounds
        if (args.x < 0 || args.x > viewport.width) {
          return JSON.stringify({
            ok: false,
            error: `X coordinate ${args.x} is outside viewport width (0-${viewport.width})`,
          });
        }

        if (args.y < 0 || args.y > viewport.height) {
          return JSON.stringify({
            ok: false,
            error: `Y coordinate ${args.y} is outside viewport height (0-${viewport.height})`,
          });
        }

        // Execute the type operation (which includes click for focus)
        await page.typeAtCoordinates(args.x, args.y, args.text);

        return JSON.stringify({
          ok: true,
          output: `Successfully typed "${args.text}" at (${args.x}, ${args.y})`,
        });
      } catch (error) {
        context.incrementMetric("errors");
        return JSON.stringify({
          ok: false,
          error: `Failed to type at coordinates: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },
  });
}

// VisualClick coordinate type (no schema needed since we parse XML)
// type VisualClickCoordinate = {
//   x: number;
//   y: number;
//   confidence: number;
//   description: string;
//   notFound: boolean;
// };
//
// // VisualClick tool input schema
// const VisualClickInputSchema = z.object({
//   instruction: z
//     .string()
//     .describe(
//       "Describe what to click on (e.g., 'the blue login button', 'the search icon in the top right')",
//     ),
// });
// type VisualClickInput = z.infer<typeof VisualClickInputSchema>;

// export function createVisualClickTool(
//   context: ExecutionContext,
// ): DynamicStructuredTool {
//   return new DynamicStructuredTool({
//     name: "visual_click",
//     description:
//       "Click on any visual element by describing it. Takes a screenshot, asks AI for coordinates, places crosshair, then clicks.",
//     schema: VisualClickInputSchema,
//     func: async (args: VisualClickInput) => {
//       try {
//         context.incrementMetric("toolCalls");
//
//         // Get current page from browserContext
//         const page = await context.browserContext.getCurrentPage();
//
//         // Get viewport dimensions
//         const viewport = await page.executeJavaScript(`
//           ({ width: window.innerWidth, height: window.innerHeight })
//         `);
//
//         // Take screenshot with fixed dimensions
//         const screenshot = await page.takeScreenshotWithDimensions(
//           1024,
//           768,
//           false,
//         );
//         if (!screenshot) {
//           return JSON.stringify({
//             ok: false,
//             error: "Failed to capture screenshot for visual click",
//           });
//         }
//
//         // Get coordinates from LLM using XML tags for deterministic extraction
//         const llm = await context.getLLM({
//           temperature: 0.1,
//           maxTokens: 1000,
//         });
//
//         // Use invokeWithRetry for reliability (3 retries, same as InteractionTool)
//         const messages = [
//           new SystemMessage(`You are a visual element locator. Given a screenshot and instruction, you need to find the element and return its coordinates.
//
// Analyze the screenshot and provide your response with coordinates in the following XML format:
//
// <coordinates>
// {
//   "notFound": false,
//   "x": 512,
//   "y": 384,
//   "confidence": 0.95,
//   "description": "Found the blue button in the center"
// }
// </coordinates>
//
// The JSON inside <coordinates> tags MUST include:
// - notFound: boolean (true if element cannot be found, false if found)
// - x: number between 0-1024 (horizontal position)
// - y: number between 0-768 (vertical position)
// - confidence: number between 0-1 (how confident you are)
// - description: string (what you found or why not found)
//
// If you CANNOT find the element:
// - Set notFound: true
// - Set x: 0, y: 0
// - Set confidence: 0
// - Set description to explain why it wasn't found
//
// If you CAN find the element:
// - Set notFound: false
// - Provide precise x,y coordinates for the element's center
// - Set confidence based on how sure you are
// - Describe what you found
//
// You can explain your reasoning before the <coordinates> tag, but the coordinates MUST be in valid JSON format inside the XML tags.`),
//           new HumanMessage({
//             content: [
//               {
//                 type: "text",
//                 text: `Find and click on: "${args.instruction}"
//
// Remember to provide the coordinates in <coordinates>JSON</coordinates> format.`,
//               },
//               { type: "image_url", image_url: { url: screenshot } },
//             ],
//           }),
//         ];
//
//         const response = await invokeWithRetry<any>(
//           llm,
//           messages,
//           3, // 3 retries, same as InteractionTool
//           { signal: context.abortSignal },
//         );
//
//         // Extract JSON from XML tags
//         const content =
//           typeof response.content === "string"
//             ? response.content
//             : JSON.stringify(response.content);
//         const coordinatesMatch = content.match(
//           /<coordinates>([\s\S]*?)<\/coordinates>/,
//         );
//
//         if (!coordinatesMatch) {
//           return JSON.stringify({
//             ok: false,
//             error: `Failed to extract coordinates from response. LLM did not provide <coordinates> tags.`,
//           });
//         }
//
//         let result: VisualClickCoordinate;
//         try {
//           result = JSON.parse(
//             coordinatesMatch[1].trim(),
//           ) as VisualClickCoordinate;
//         } catch (parseError) {
//           return JSON.stringify({
//             ok: false,
//             error: `Failed to parse coordinates JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
//           });
//         }
//
//         // Check if element was found
//         if (result.notFound) {
//           return JSON.stringify({
//             ok: false,
//             error: `Element not found: "${args.instruction}". ${result.description}`,
//           });
//         }
//
//         // Check confidence
//         if (result.confidence < 0.3) {
//           return JSON.stringify({
//             ok: false,
//             error: `Cannot find "${args.instruction}" with sufficient confidence (${result.confidence}). ${result.description}`,
//           });
//         }
//
//         // Adjust coordinates for viewport
//         const x = Math.round(result.x * (viewport.width / 1024));
//         const y = Math.round(result.y * (viewport.height / 768));
//
//         // Place crosshair
//         await page.executeJavaScript(`
//           (function() {
//             const existing = document.getElementById('ai-crosshair');
//             if (existing) existing.remove();
//
//             const crosshair = document.createElement('div');
//             crosshair.id = 'ai-crosshair';
//             crosshair.style.cssText = \`
//               position: fixed;
//               left: ${x - 15}px;
//               top: ${y - 15}px;
//               width: 30px;
//               height: 30px;
//               border: 3px solid red;
//               border-radius: 50%;
//               background: rgba(255, 0, 0, 0.2);
//               z-index: 999999;
//               pointer-events: none;
//             \`;
//             document.body.appendChild(crosshair);
//
//             setTimeout(() => {
//               const el = document.getElementById('ai-crosshair');
//               if (el) el.remove();
//             }, 30000);
//           })();
//         `);
//
//         // Small delay for visual feedback
//         await new Promise((resolve) => setTimeout(resolve, 200));
//
//         // Click using synthetic events
//         const clickResult = await page.executeJavaScript(`
//           (function() {
//             const x = ${x};
//             const y = ${y};
//             const element = document.elementFromPoint(x, y);
//
//             if (!element) {
//               return { clicked: false, error: 'No element at coordinates' };
//             }
//
//             // Dispatch mouse events
//             const events = ['mousedown', 'mouseup', 'click'];
//             events.forEach(eventType => {
//               const event = new MouseEvent(eventType, {
//                 view: window,
//                 bubbles: true,
//                 cancelable: true,
//                 clientX: x,
//                 clientY: y
//               });
//               element.dispatchEvent(event);
//             });
//
//             // Also try native click
//             if (element.click) element.click();
//
//             return {
//               clicked: true,
//               element: element.tagName.toLowerCase()
//             };
//           })();
//         `);
//
//         await page.waitForStability();
//
//         if (!clickResult.clicked) {
//           return JSON.stringify({
//             ok: false,
//             error: clickResult.error || "Click failed",
//           });
//         }
//
//         return JSON.stringify({
//           ok: true,
//           output: {
//             coordinates: { x, y },
//             confidence: result.confidence,
//             description: result.description,
//             element: clickResult.element,
//           },
//         });
//       } catch (error) {
//         context.incrementMetric("errors");
//         return JSON.stringify({
//           ok: false,
//           error: `Visual click failed: ${error instanceof Error ? error.message : String(error)}`,
//         });
//       }
//     },
//   });
// }
