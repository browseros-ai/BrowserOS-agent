import React, { useState, useEffect, useRef } from "react";
import { z } from "zod";
import { SidePanel } from "../components/SidePanel";
import { useAppStore } from "../store/appStore";
import { useTabsStore } from "../store/tabsStore";
import { useSidePanelPortMessaging } from "../hooks";
import { MessageType } from "@/lib/types/messaging";
import { Message as StreamMessage } from "../components/StreamingMessageDisplay";

// Zod schema for side panel page state
const SidePanelPageStateSchema = z.object({
  isVisible: z.boolean(), // Whether the side panel is visible
  hasUnreadNotifications: z.boolean(), // Whether there are unread notifications
  lastActivity: z.date().optional(), // Last activity timestamp
  isProcessing: z.boolean(), // Whether currently processing
  messages: z.array(z.any()), // Chat messages
  currentSegmentId: z.number(), // Current segment ID for streaming
});

export type SidePanelPageState = z.infer<typeof SidePanelPageStateSchema>;

interface SidePanelPageProps {
  onClose?: () => void;
}

/**
 * Main side panel page component that integrates with the Nxtscape browser agent.
 * Uses segment-based streaming approach for beautiful message display.
 */
export function SidePanelPage({ onClose }: SidePanelPageProps): JSX.Element {
  const {
    taskInput,
    setTaskInput,
    addLog,
    startExecution,
    executionResult,
    setExecutionResult,
  } = useAppStore();

  const { connected, sendMessage, addMessageListener, removeMessageListener } =
    useSidePanelPortMessaging();

  const [pageState, setPageState] = useState<SidePanelPageState>({
    isVisible: true,
    hasUnreadNotifications: false,
    isProcessing: false,
    messages: [],
    currentSegmentId: 0,
  });

  const messageIdCounter = useRef(0);
  
  // Chunk buffer for debouncing streaming updates
  const chunkBufferRef = useRef<{
    messageId: string;
    content: string;
    timer: NodeJS.Timeout | null;
  }>({ messageId: '', content: '', timer: null });

  // Helper to generate unique message IDs
  const generateMessageId = () =>
    `msg-${Date.now()}-${++messageIdCounter.current}`;
    
  // Helper function to flush buffered chunks
  const flushChunkBuffer = () => {
    if (!chunkBufferRef.current.content || !chunkBufferRef.current.messageId) return;
    
    const bufferedMessageId = chunkBufferRef.current.messageId;
    const bufferedContent = chunkBufferRef.current.content;
    
    setPageState((prev) => {
      const messages = [...prev.messages];
      const messageIndex = messages.findIndex(
        (m) => m.id === bufferedMessageId && m.type === "streaming-llm"
      );
      
      if (messageIndex !== -1) {
        messages[messageIndex] = {
          ...messages[messageIndex],
          content: messages[messageIndex].content + bufferedContent,
        };
      }
      
      return { ...prev, messages };
    });
    
    // Reset buffer
    chunkBufferRef.current = { messageId: '', content: '', timer: null };
  };

  // Listen for agent stream updates
  useEffect(() => {
    const handleStreamUpdate = (payload: any): void => {
      const { step, action, details } = payload;

      // Skip empty or repetitive system messages
      if (
        details?.messageType === "SystemMessage" &&
        (!details.content ||
          details.content.includes("🚀 Initializing browser agent..."))
      ) {
        return;
      }

      // Handle different types of updates based on the details
      if (details?.messageType === "SystemMessage") {
        // Add system message
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "system",
          content: details.content || action,
          isComplete: true,
          timestamp: new Date(),
        };

        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
        }));
      } else if (details?.messageType === "NewSegment") {
        // Create a new streaming LLM message
        const newMessage: StreamMessage = {
          id: details.messageId || generateMessageId(),
          type: "streaming-llm",
          content: "",
          isComplete: false,
          timestamp: new Date(),
        };
        
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
        }));
      } else if (details?.messageType === "StreamingChunk") {
        // Buffer chunks to reduce re-renders
        if (chunkBufferRef.current.messageId === details.messageId) {
          // Same message, accumulate content
          chunkBufferRef.current.content += details.content;
        } else {
          // Different message, flush previous buffer first
          flushChunkBuffer();
          chunkBufferRef.current = {
            messageId: details.messageId,
            content: details.content,
            timer: null
          };
        }
        
        // Clear existing timer
        if (chunkBufferRef.current.timer) {
          clearTimeout(chunkBufferRef.current.timer);
        }
        
        // Set new timer to flush after 50ms of no new chunks
        chunkBufferRef.current.timer = setTimeout(() => {
          flushChunkBuffer();
        }, 50);
      } else if (details?.messageType === "FinalizeSegment") {
        // Flush any remaining buffered chunks before finalizing
        flushChunkBuffer();
        
        // Convert streaming message to final LLM message
        setPageState((prev) => {
          const messages = [...prev.messages];
          const messageIndex = messages.findIndex(
            (m) => m.id === details.messageId && m.type === "streaming-llm"
          );
          
          if (messageIndex !== -1) {
            const streamingMessage = messages[messageIndex];
            const finalContent = details.content || streamingMessage.content;
            
            // Only update if there's actual content
            if (finalContent && finalContent.trim()) {
              // Replace with final message
              messages[messageIndex] = {
                ...streamingMessage,
                type: "llm",
                content: finalContent,
                isComplete: true,
              };
            } else {
              // Remove empty message
              messages.splice(messageIndex, 1);
            }
          } else if (details.content && details.content.trim()) {
            // If we didn't find a streaming message, create a new complete one only if there's content
            messages.push({
              id: details.messageId || generateMessageId(),
              type: "llm",
              content: details.content,
              isComplete: true,
              timestamp: new Date(),
            });
          }
          
          return { ...prev, messages };
        });
      } else if (details?.messageType === "ToolStart") {
        // Disabled - tool.start events are only shown in debug mode
        // Tool results are shown via ToolResult events instead
      } else if (details?.messageType === "ToolStream") {
        // Disabled - tool streaming is only shown in debug mode
      } else if (details?.messageType === "ToolEnd") {
        // Disabled - tool.end events are only shown in debug mode
      } else if (details?.messageType === "ToolResult") {
        // Add tool result message (always shown)
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "tool",
          content: details.content || "",
          toolName: details.toolName,
          isComplete: true,
          timestamp: new Date(),
        };
        
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages, newMessage],
        }));
      } else if (details?.messageType === "LLMResponse") {
        // Legacy handler - shouldn't be used with new streaming
      } else if (details?.messageType === "ErrorMessage") {
        console.log("❌ [SidePanel] Error message received:", details.error);
        
        // Add error message
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "system",
          content: `❌ ${details.error || details.content || 'An error occurred'}`,
          isComplete: true,
          timestamp: new Date(),
        };
        
        // Set processing to false and add error message
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
          isProcessing: false,
        }));
      } else if (details?.messageType === "DebugMessage") {
        console.log("🐛 [SidePanel] Debug message received:", details.content, details.data);
        
        // Format debug content with JSON data if present
        let debugContent = details.content || '';
        if (details.data) {
          debugContent += `\n\`\`\`json\n${JSON.stringify(details.data, null, 2)}\n\`\`\``;
        }
        
        // Add debug message as a system message with special formatting
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "system",
          content: `🐞 **Debug**: ${debugContent}`,
          isComplete: true,
          timestamp: new Date(),
        };
        
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
        }));
      } else if (details?.messageType === "CancelMessage") {
        console.log("✋ [SidePanel] Cancel message received:", details.content);
        
        // Add cancellation message
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "system",
          content: details.content || '✋ Task paused',
          isComplete: true,
          timestamp: new Date(),
        };
        
        // Set processing to false and add cancel message
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
          isProcessing: false,
        }));
      } else if (details?.messageType === "TaskResult") {
        console.log("📊 [SidePanel] Task result message received:", details.content);
        
        // Add task result message
        const newMessage: StreamMessage = {
          id: generateMessageId(),
          type: "system",
          content: details.content || '',
          isComplete: true,
          timestamp: new Date(),
        };
        
        // Add task result message and set isProcessing to false
        setPageState((prev) => ({
          ...prev,
          messages: [...prev.messages.filter(m => m.type !== "thinking"), newMessage],
          isProcessing: false,
        }));
      } else if (details?.messageType === "ThinkingMessage") {
        console.log("🤔 [SidePanel] Thinking message received:", details.content);
        
        // Find and replace the last thinking message with the same category
        setPageState((prev) => {
          const messages = [...prev.messages];
          const category = details.data?.category;
          
          // Filter out existing thinking messages with the same category (or any thinking message if no category)
          const filteredMessages = messages.filter((msg) => {
            if (msg.type === "thinking") {
              return category ? (msg as any).category !== category : false;
            }
            return true;
          });
          
          const newMessage: StreamMessage & { category?: string } = {
            id: generateMessageId(),
            type: "thinking" as any,
            content: `💭 ${details.content}`,
            isComplete: true,
            timestamp: new Date(),
            category: category,
          };
          
          // Always add the new thinking message at the end
          return {
            ...prev,
            messages: [...filteredMessages, newMessage],
          };
        });
      } else {
        console.log(
          "🎯 [SidePanel] Unhandled update type:",
          details?.messageType,
          payload,
        );
      }
    };

    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate);
    return () => {
      // Clean up chunk buffer timer
      if (chunkBufferRef.current.timer) {
        clearTimeout(chunkBufferRef.current.timer);
        flushChunkBuffer();  // Flush any remaining content
      }
      removeMessageListener(
        MessageType.AGENT_STREAM_UPDATE,
        handleStreamUpdate,
      );
    };
  }, [addMessageListener, removeMessageListener]);

  // Listen for workflow status updates
  useEffect(() => {
    const handleWorkflowStatus = (payload: {
      status?: string;
      message?: string;
      error?: string;
      result?: Record<string, unknown>;
      cancelled?: boolean;
      cancelledQuery?: string;
    }): void => {
      setExecutionResult({
        status: payload.status || (payload.error ? "failed" : "completed"),
        message: payload.message,
        error: payload.error,
        result: payload.result,
      });

      // Handle completion/error
      if (
        payload.status === "completed" ||
        payload.status === "failed" ||
        payload.cancelled
      ) {
        // Finalize any streaming content
        setPageState((prev) => {
          const finalMessages = [...prev.messages];

          // Add completion/error message
          if (payload.cancelled) {
            // For cancelled tasks, only show the helpful message, not any errors
            finalMessages.push({
              id: generateMessageId(),
              type: "system",
              content: payload.message || '✋ Task paused. To continue this task, just type your next request OR use 🔄 to start a new task!',
              isComplete: true,
              timestamp: new Date(),
            });
          } else if (payload.error && !payload.cancelled) {
            // Only show error if it's not a cancellation
            finalMessages.push({
              id: generateMessageId(),
              type: "error",
              content: payload.error,
              isComplete: true,
              timestamp: new Date(),
            });
          }

          return {
            ...prev,
            messages: finalMessages,
            isProcessing: false,
          };
        });
      }

      // Log the status update
      addLog({
        source: "SidePanelPage",
        message: `Task ${payload.status || "completed"}: ${payload.message || "No message"}`,
        level: payload.error && !payload.cancelled ? "error" : "info",
        timestamp: new Date().toISOString(),
      });
    };

    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus);
    return () =>
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus);
  }, [
    addMessageListener,
    removeMessageListener,
    setExecutionResult,
    addLog,
    taskInput,
  ]);

  // Listen for close panel messages
  useEffect(() => {
    const handleClosePanel = (payload: { reason?: string }): void => {
      console.log(
        `[SidePanel] Received close panel message: ${payload.reason || "No reason provided"}`,
      );

      // Close the window
      window.close();
    };

    addMessageListener(MessageType.CLOSE_PANEL, handleClosePanel);
    return () =>
      removeMessageListener(MessageType.CLOSE_PANEL, handleClosePanel);
  }, [addMessageListener, removeMessageListener]);

  // Listen for intent prediction updates
  const { updateIntentPredictions } = useTabsStore();
  useEffect(() => {
    const handleIntentPredictions = (payload: {
      tabId: number;
      url: string;
      intents: string[];
      confidence?: number;
      timestamp: number;
      error?: string;
    }): void => {
      if (payload.error) {
        console.error(`[SidePanel] Intent prediction failed for tab ${payload.tabId}: ${payload.error}`);
      }
      
      // Update the store
      updateIntentPredictions({
        tabId: payload.tabId,
        url: payload.url,
        intents: payload.intents,
        confidence: payload.confidence,
        timestamp: payload.timestamp,
        error: payload.error
      });
    };

    addMessageListener(MessageType.INTENT_PREDICTION_UPDATED, handleIntentPredictions);
    return () =>
      removeMessageListener(MessageType.INTENT_PREDICTION_UPDATED, handleIntentPredictions);
  }, [addMessageListener, removeMessageListener, updateIntentPredictions]);
  
  // State to trigger intent bubble click from external source
  const [externalIntent, setExternalIntent] = useState<string | null>(null);
  
  // Listen for intent bubble clicks from content script
  useEffect(() => {
    const handleIntentBubbleClick = (payload: { intent: string }): void => {
      console.log(`[SidePanel] Intent bubble clicked from web page: ${payload.intent}`);
      setExternalIntent(payload.intent);
    };

    addMessageListener(MessageType.INTENT_BUBBLE_CLICKED, handleIntentBubbleClick);
    return () =>
      removeMessageListener(MessageType.INTENT_BUBBLE_CLICKED, handleIntentBubbleClick);
  }, [addMessageListener, removeMessageListener]);

  /**
   * Handle new task submission from the side panel
   */
  const handleNewTask = async (taskDescription: string, tabIds?: number[]): Promise<void> => {
    if (!taskDescription.trim() || !connected) return;

    // Create enhanced user message with tab context
    let enhancedContent = taskDescription;

    try {
      // Update the main task input
      setTaskInput(taskDescription);
      startExecution();

      // Prepare new messages to add
      const newMessages: StreamMessage[] = [];
      
      // Add tab context if tabs are selected
      if (tabIds && tabIds.length > 0) {
        // Get tab information for display
        try {
          const tabs = await chrome.tabs.query({});
          const selectedTabs = tabs.filter(tab => tabIds.includes(tab.id!));
          
          if (selectedTabs.length === 1) {
            // Single tab selected
            const tab = selectedTabs[0];
            enhancedContent = `${taskDescription}\n\n📍 *Operating on: ${tab.title || 'Untitled'}*`;
          } else if (selectedTabs.length > 1) {
            // Multiple tabs selected
            enhancedContent = `${taskDescription}\n\n📑 *Operating on ${selectedTabs.length} selected tabs:*\n`;
            selectedTabs.forEach((tab, index) => {
              enhancedContent += `${index + 1}. ${tab.title || 'Untitled'}\n`;
            });
          }
        } catch (error) {
          // If we can't get tab info, just show count
          enhancedContent = `${taskDescription}\n\n📑 *Operating on ${tabIds.length} selected tab${tabIds.length > 1 ? 's' : ''}*`;
        }
      }

      // Always add user message with enhanced content
      newMessages.push({
        id: generateMessageId(),
        type: "user",
        content: enhancedContent,
        isComplete: true,
        timestamp: new Date(),
      });

      // Add messages and start processing (preserve existing conversation)
      setPageState((prev) => {
        const isFirstTask = prev.messages.length === 0;

        return {
          ...prev,
          isProcessing: true,
          messages: [...prev.messages, ...newMessages],
          currentSegmentId: 0,
          lastActivity: new Date(),
        };
      });

      addLog({
        source: "SidePanelPage",
        message: `Processing task: "${taskDescription}"${tabIds ? ` with ${tabIds.length} selected tabs` : ''}`,
        level: "info",
        timestamp: new Date().toISOString(),
      });

      // Send message to background script
      const messageId = `sidepanel-task-${Date.now()}`;
      const success = sendMessage(
        MessageType.EXECUTE_QUERY,
        {
          query: taskDescription,
          source: "sidepanel",
          tabIds: tabIds,  // Include selected tab IDs
          // Removed mode - using unified classification in backend
        },
        messageId,
      );

      if (!success) {
        throw new Error("Failed to send message to background script");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Add user message and error message to preserve conversation flow
      const userMessage: StreamMessage = {
        id: generateMessageId(),
        type: "user",
        content: enhancedContent,
        isComplete: true,
        timestamp: new Date(),
      };

      const errorMessage: StreamMessage = {
        id: generateMessageId(),
        type: "error",
        content: `Error: ${message}`,
        isComplete: true,
        timestamp: new Date(),
      };

      setPageState((prev) => ({
        ...prev,
        isProcessing: false,
        messages: [...prev.messages, userMessage, errorMessage],
      }));

      addLog({
        source: "SidePanelPage",
        message: `Error starting task: ${message}`,
        level: "error",
        timestamp: new Date().toISOString(),
      });

      setExecutionResult({
        status: "failed",
        error: message,
      });
    }
  };

  /**
   * Handle side panel close
   */
  const handleClose = (): void => {
    setPageState((prev) => ({ ...prev, isVisible: false }));
    onClose?.();
  };

  /**
   * Handle task cancellation
   */
  const handleCancelTask = (): void => {
    // Immediately update state to show cancellation in progress
    setPageState((prev) => ({
      ...prev,
      isProcessing: false,
    }));

    // Send cancellation message to background script
    const messageId = `cancel-task-${Date.now()}`;
    const success = sendMessage(
      MessageType.CANCEL_TASK,
      {
        reason: "User requested cancellation from sidepanel",
        source: "sidepanel",
      },
      messageId,
    );

    if (success) {
      addLog({
        source: "SidePanelPage",
        message: `Cancellation request sent to background script`,
        level: "info",
        timestamp: new Date().toISOString(),
      });

      // Don't add message here - it will come from background broadcast
    } else {
      addLog({
        source: "SidePanelPage",
        message: "Failed to send cancellation request",
        level: "warning",
        timestamp: new Date().toISOString(),
      });
      
      // Still add a message even if the request failed
      setPageState((prev) => ({
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: generateMessageId(),
            type: "error",
            content: "Failed to cancel task. The task may still be running.",
            isComplete: true,
            timestamp: new Date(),
          },
        ],
      }));
    }

    setExecutionResult({
      status: "cancelled",
      message: "Task cancellation requested",
    });

    addLog({
      source: "SidePanelPage",
      message: "Task cancellation completed",
      level: "info",
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Handle reset - clear all messages and state
   */
  const handleReset = (): void => {
    // First, cancel any running task to prevent race conditions
    if (pageState.isProcessing) {
      handleCancelTask();
    }

    // Reset page state first (this will trigger auto-scroll reset in SidePanel)
    setPageState((prev) => ({
      ...prev,
      messages: [],
      isProcessing: false,
      currentSegmentId: 0,
    }));

    // Clear execution result
    setExecutionResult(null);

    // Clear task input
    setTaskInput("");

    // Send reset message to background script to clear conversation history
    const messageId = `reset-conversation-${Date.now()}`;
    const success = sendMessage(
      MessageType.RESET_CONVERSATION,
      {
        source: "sidepanel",
      },
      messageId,
    );

    if (success) {
      addLog({
        source: "SidePanelPage",
        message: "Reset request sent to background script - clearing conversation history",
        level: "info",
        timestamp: new Date().toISOString(),
      });
    } else {
      addLog({
        source: "SidePanelPage",
        message: "Failed to send reset request",
        level: "warning",
        timestamp: new Date().toISOString(),
      });
    }

    addLog({
      source: "SidePanelPage",
      message: "Conversation reset completed",
      level: "info",
      timestamp: new Date().toISOString(),
    });
  };

  /**
   * Handle panel focus/visibility change
   */
  const handlePanelFocus = (): void => {
    setPageState((prev) => ({
      ...prev,
      isVisible: true,
      hasUnreadNotifications: false,
    }));
  };

  return (
    <div
      className="w-full h-full"
      onFocus={handlePanelFocus}
      onClick={handlePanelFocus}
    >
      <SidePanel
        onNewTask={handleNewTask}
        onCancelTask={handleCancelTask}
        onReset={handleReset}
        onClose={handleClose}
        isConnected={connected}
        isProcessing={pageState.isProcessing}
        messages={pageState.messages}
        externalIntent={externalIntent}
        onExternalIntentHandled={() => setExternalIntent(null)}
        className="h-full"
      />
    </div>
  );
}
