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
        const expectedUrl = page.url();

        const {
            toolName,
            ...toolArgs
        } = args as WebMCPToolInput & Record<string, any>;

        // Log detailed information about the tool call
        Logging.log("WebsiteMCPTool", `[TOOL CALL] Tool: ${toolName} | Expected URL: ${expectedUrl} | Args: ${JSON.stringify(toolArgs)}`, 'info');
        
        // Verify we're on the right page before dispatching
        const urlCheck = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            world: 'MAIN',
            func: () => window.location.href
        });
        
        const actualUrl = urlCheck?.[0]?.result;
        if (actualUrl && actualUrl !== expectedUrl) {
            Logging.log("WebsiteMCPTool", `[WARNING] URL mismatch! Expected: ${expectedUrl}, Actual: ${actualUrl}`, 'warning');
            Logging.log("WebsiteMCPTool", `[WARNING] Page may not have fully loaded. Waiting for stability...`, 'warning');
            
            // Wait for page to stabilize
            await page.waitForStability();
            
            // Re-check URL after waiting
            const recheckUrl = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                func: () => window.location.href
            });
            
            const finalUrl = recheckUrl?.[0]?.result;
            Logging.log("WebsiteMCPTool", `[URL CHECK] After wait: ${finalUrl}`, 'info');
            
            if (finalUrl && finalUrl !== expectedUrl) {
                return JSON.stringify({
                    ok: false,
                    error: `URL mismatch: Tool expects ${expectedUrl} but page is at ${finalUrl}. Navigation may have failed.`
                });
            }
        }

        const eventName = toolName;
        const eventData = {
            tool: toolName,
            args: toolArgs,
            timestamp: Date.now(),
            source: 'browser-agent'
        }

        try {
            const result = await chrome.scripting.executeScript({
                target: { tabId: tabId },
                world: 'MAIN',
                args: [eventName, eventData],
                func: (eventName: string, eventData: any) => {
                    // Check if there are any listeners for this event
                    const hasDocumentListener = (document as any)._hasEventListener?.(eventName);
                    const hasWindowListener = (window as any)._hasEventListener?.(eventName);
                    
                    // Dispatch to document
                    const docEvent = document.dispatchEvent(new CustomEvent(eventName, {
                        detail: eventData,
                        bubbles: true,
                        cancelable: true
                    }));
                    
                    // Dispatch to window
                    const winEvent = window.dispatchEvent(new CustomEvent(eventName, {
                        detail: eventData,
                        bubbles: false,
                        cancelable: true
                    }));
                    
                    return { 
                        success: true, 
                        eventDispatched: true,
                        docDispatched: docEvent,
                        winDispatched: winEvent,
                        currentUrl: window.location.href,
                        hasListeners: {
                            document: hasDocumentListener,
                            window: hasWindowListener
                        }
                    };
                }
            });

            // Log the result from the page
            if (result && result[0]?.result) {
                Logging.log("WebsiteMCPTool", `[DISPATCH RESULT] ${JSON.stringify(result[0].result)}`, 'info');
            }

            // Wait a bit longer for the event to be processed
            await new Promise(resolve => setTimeout(resolve, 200));

            Logging.log("WebsiteMCPTool", `[SUCCESS] Dispatched event ${eventName} on ${expectedUrl}`, 'info');

            // Verify the event was dispatched to the correct page
            const dispatchedUrl = result[0]?.result?.currentUrl;
            if (dispatchedUrl && dispatchedUrl !== expectedUrl) {
                Logging.log("WebsiteMCPTool", `[ERROR] Event dispatched to wrong page! Expected: ${expectedUrl}, Got: ${dispatchedUrl}`, 'error');
                return JSON.stringify({
                    ok: false,
                    error: `Event was dispatched to ${dispatchedUrl} instead of ${expectedUrl}. The page may not have fully loaded. Please wait or navigate again.`,
                    tool: toolName,
                    expectedUrl: expectedUrl,
                    actualUrl: dispatchedUrl
                });
            }
            
            return JSON.stringify({
                ok: true,
                output: `Successfully executed "${toolName}" - event dispatched to website at ${expectedUrl}`,
                tool: toolName,
                args: toolArgs,
                pageUrl: expectedUrl,
                verified: dispatchedUrl === expectedUrl
            });

        } catch (error) {
            executionContext.incrementMetric("errors");
            Logging.log("WebsiteMCPTool", `[ERROR] Failed to dispatch event ${eventName}: ${error instanceof Error ? error.message : String(error)}`, 'error');
            return JSON.stringify({
                ok: false,
                error: `Failed to execute tool: ${error instanceof Error ? error.message : String(error)}`
            });
        }

    } catch (error) {
        executionContext.incrementMetric("errors");
        Logging.log("WebsiteMCPTool", `[ERROR] Tool execution failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
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