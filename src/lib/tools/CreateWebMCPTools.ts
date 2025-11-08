import { DynamicStructuredTool } from "@langchain/core/tools";
import { WebsiteTool } from "../browser/WebsiteToolsDiscovery";
import { ExecutionContext } from "../runtime/ExecutionContext";
import { Logging } from "@/lib/utils/Logging"
import { z } from "zod";

interface WebMCPToolInput {
    toolName: string;
    args: Record<string, any>;
}


async function createTools(executionContext: ExecutionContext, args: WebMCPToolInput) {
    try {
        executionContext.incrementMetric("toolCalls");
        executionContext.incrementMetric("websiteToolCalls");
        
        const page = await executionContext.browserContext.getCurrentPage();
        const tabId = page.tabId;

        const {
            toolName,
            ...toolArgs
        } = args as WebMCPToolInput & Record<string, any>;

        const eventName = toolName;
        const eventData = {
            tool: toolName,
            args: toolArgs,
            timestamp: Date.now(),
            source: 'browser-agent'
        }

        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                args: [eventName, eventData],
                func: (eventName: string, eventData: any) => {
                    document.dispatchEvent(new CustomEvent(eventName, {
                        detail: eventData,
                        bubbles: true,
                        cancelable: true
                    }));
                    
                    window.dispatchEvent(new CustomEvent(eventName, {
                        detail: eventData,
                        bubbles: false,
                        cancelable: true
                    }));
                    
                    return { success: true, eventDispatched: true };
                }
            });


        await new Promise(resolve => setTimeout(resolve, 100));

        Logging.log("WebsiteMCPTool", `Dispatched event ${eventName} with data ${JSON.stringify(eventData)}`);

        return JSON.stringify({
            ok: true,
            output: `Successfully executed "${toolName}" - event dispatched to website`,
            tool: toolName,
            args: toolArgs
        });

        } catch (error) {
        executionContext.incrementMetric("errors");
        return JSON.stringify({
            ok: false,
            error: `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`
        });
        }

    } catch (error) {
        executionContext.incrementMetric("errors");
        return JSON.stringify({
            ok: false,
            error: `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`
        });
    }
}

export function createWebsiteMCPTools(
  executionContext: ExecutionContext,
  tool: WebsiteTool
): DynamicStructuredTool {
  const schema = z.object({
    toolName: z.string(),
  }).passthrough();

  return new DynamicStructuredTool({
    name: tool.name,
    description: tool.description,
    schema: schema as any, // prevent infinite expansion
    func: async (args: unknown) => {
      return await createTools(
        executionContext,
        args as WebMCPToolInput
      );
    },
  });
}