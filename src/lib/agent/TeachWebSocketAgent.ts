import { ExecutionContext, WS_AGENT_CONFIG, WS_CONNECTION_TIMEOUT } from "@/lib/runtime/ExecutionContext";
import { PubSub } from "@/lib/pubsub";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import { AbortError } from "@/lib/utils/Abortable";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { TeachModeEventPayload } from "@/lib/pubsub/types";
import { Logging } from "@/lib/utils/Logging";
import { type SemanticWorkflow } from "@/lib/teach-mode/types";
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { isDevelopmentMode } from '@/config';

interface PredefinedPlan {
  agentId: string;
  name?: string;  // Optional to match ExecutionMetadata schema
  goal: string;
  steps: string[];
}

/**
 * WebSocket-based agent for teach mode that connects to remote server
 * Server handles all planning, reasoning, and tool execution
 * Client sends query with workflow context and streams events via teach-mode pubsub
 */
export class TeachWebSocketAgent {
  private readonly executionContext: ExecutionContext;
  private readonly mainPubsub: PubSubChannel;  // Main channel for teach-mode events
  private readonly glowService: GlowAnimationService;

  // WebSocket state
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private isCompleted = false;
  private lastEventTime = 0;  // Track last event for timeout

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.mainPubsub = PubSub.getChannel('main');  // Get main channel for teach-mode events
    this.glowService = GlowAnimationService.getInstance();
    Logging.log("TeachWebSocketAgent", "Agent instance created", "info");
  }

  // Helper method to emit teach-mode events
  private _emitTeachModeEvent(
    eventType: TeachModeEventPayload['eventType'],
    data: any
  ): void {
    this.mainPubsub.publishTeachModeEvent({
      eventType,
      sessionId: this.executionContext.executionId,
      data
    });
  }

  // Helper method to emit thinking events with stable msgId
  private _emitThinking(msgId: string, content: string): void {
    this._emitTeachModeEvent('execution_thinking', {
      msgId,
      content,
      timestamp: Date.now()
    });
  }

  private checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError();
    }
  }

  /**
   * Check if task is a special predefined task and return its metadata
   * @param task - The original task string
   * @returns Metadata with predefined plan or null if not a special task
   */
  private _getSpecialTaskMetadata(task: string): {task: string, metadata: ExecutionMetadata} | null {
    const taskLower = task.toLowerCase();

    // BrowserOS Launch Upvote Task
    if (taskLower === "read about our vision and upvote ❤️") {
      return {
        task: "Read about our vision and upvote",
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'browseros-launch-upvoter',
            name: "BrowserOS Launch Upvoter",
            goal: "Navigate to BrowserOS launch page and upvote it",
            steps: [
              "Navigate to https://dub.sh/browseros-launch",
              "Find and click the upvote button on the page using visual_click",
              "Use celebration tool to show confetti animation"
            ]
          }
        }
      };
    }

    // GitHub Star Task
    if (taskLower === "support browseros on github ⭐") {
      return {
        task: "Support BrowserOS on GitHub",
        metadata: {
          executionMode: 'predefined' as const,
          predefinedPlan: {
            agentId: 'github-star-browseros',
            name: "GitHub Repository Star",
            goal: "Navigate to BrowserOS GitHub repo and star it",
            steps: [
              "Navigate to https://git.new/browserOS",
              "Check if the star button indicates already starred (filled star icon)",
              "If not starred (outline star icon), click the star button to star the repository",
              "Use celebration_tool to show confetti animation"
            ]
          }
        }
      };
    }

    return null;
  }

  /**
   * Format workflow into userTrajectory string for context
   * Matches TeachAgent's approach (lines 567-573)
   */
  private _formatWorkflowAsUserTrajectory(workflow: SemanticWorkflow): string {
    // Extract intent and action from workflow steps (excluding beforeSnapshot/afterSnapshot)
    const userTrajectorySteps = workflow.steps.map(step => {
      return {
        intent: step.intent,
        action: step.action,
      };
    });

    const description = workflow.metadata?.description || '';
    const goal = workflow.metadata?.goal || '';

    return `USER TRAJECTORY (for reference):
Description: ${description}
Goal: ${goal}

Steps demonstrated by user:
${JSON.stringify(userTrajectorySteps, null, 2)}`;
  }

  /**
   * Main execution entry point
   */
  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    // Check for special tasks and get their predefined plans
    const specialTaskMetadata = this._getSpecialTaskMetadata(task);

    let _task = task;
    let _metadata = metadata;

    if (specialTaskMetadata) {
      _task = specialTaskMetadata.task;
      _metadata = { ...metadata, ...specialTaskMetadata.metadata };
      Logging.log("TeachWebSocketAgent", `Special task detected: ${specialTaskMetadata.metadata.predefinedPlan?.name}`, "info");
    }

    const workflow = _metadata?.workflow as SemanticWorkflow | undefined;

    try {
      this.executionContext.setCurrentTask(_task);
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("TeachWebSocketAgent", "Starting execution", "info");

      // Publish execution started event like TeachAgent
      this._emitTeachModeEvent('execution_started', {
        workflowId: workflow?.metadata?.recordingId || '',
        goal: workflow?.metadata?.goal || _task,
        totalSteps: workflow?.steps?.length || 0
      });

      // Start glow animation
      this._maybeStartGlow();

      // Connect to WebSocket server
      await this._connect();

      // Send query with browser context, predefined plan, and workflow if available
      await this._sendQuery(
        _task,
        _metadata?.predefinedPlan,
        workflow
      );

      // Wait for completion with abort and timeout checks
      await this._waitForCompletion();

    } catch (error) {
      this._handleExecutionError(error);
      throw error;
    } finally {
      this._cleanup();
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        endTime: Date.now(),
      });
      this._logMetrics();

      // Stop glow animation
      try {
        const activeGlows = this.glowService.getAllActiveGlows();
        for (const tabId of activeGlows) {
          await this.glowService.stopGlow(tabId);
        }
      } catch (error) {
        Logging.log("TeachWebSocketAgent", `Could not stop glow animation: ${error}`, "warning");
      }
    }
  }

  /**
   * Connect to WebSocket server and wait for connection event
   */
  private async _connect(): Promise<void> {
    this.checkIfAborted();

    // Get WebSocket URL from ExecutionContext
    const wsUrl = await this.executionContext.getAgentServerUrl();

    return new Promise((resolve, reject) => {
      const connectMsgId = PubSub.generateId('teach_ws_connect');
      this._emitThinking(connectMsgId, 'Getting ready...');
      Logging.log("TeachWebSocketAgent", `Connecting to ${wsUrl}`, "info");

      // Create WebSocket
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error) {
        Logging.log("TeachWebSocketAgent", `Failed to create WebSocket: ${error}`, "error");
        reject(error);
        return;
      }

      // Connection timeout - don't publish, let _handleExecutionError do it
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${WS_CONNECTION_TIMEOUT}ms`));
        this.ws?.close();
      }, WS_CONNECTION_TIMEOUT);

      // WebSocket opened
      this.ws.onopen = () => {
        Logging.log("TeachWebSocketAgent", "WebSocket connection opened", "info");
      };

      // WebSocket message received
      this.ws.onmessage = (event) => {
        // First message should be connection event
        if (!this.isConnected) {
          try {
            const data = JSON.parse(event.data as string);

            if (data.type === 'connection') {
              clearTimeout(timeout);
              this.sessionId = data.data?.sessionId;
              this.isConnected = true;

              if (this.sessionId) {
                Logging.log(
                  "TeachWebSocketAgent",
                  `Session established: ${this.sessionId.substring(0, 16)}...`,
                  "info"
                );
              }

              resolve();
            }
          } catch (err) {
            Logging.log("TeachWebSocketAgent", `Failed to parse connection message: ${err}`, "error");
          }
        }

        // Handle all subsequent messages
        this._handleMessage(event.data as string);
      };

      // WebSocket error - don't publish, let _handleExecutionError do it
      this.ws.onerror = (_error) => {
        clearTimeout(timeout);
        Logging.log("TeachWebSocketAgent", "WebSocket error", "error");
        reject(new Error('WebSocket connection failed'));
      };

      // WebSocket closed
      this.ws.onclose = (_event) => {
        Logging.log("TeachWebSocketAgent", "WebSocket connection closed", "info");

        // Only publish if we were actually connected (not a connection failure)
        // Connection failures are handled by onerror + _handleExecutionError
        if (this.isConnected && !this.isCompleted) {
          this.isCompleted = true;

          // Publish execution completed/failed event
          if (this.executionContext.abortSignal.aborted) {
            const cancelMsgId = PubSub.generateId('teach_ws_cancel');
            this._emitThinking(cancelMsgId, '✅ Task cancelled');
          } else {
            this._emitTeachModeEvent('execution_failed', {
              error: 'Connection closed unexpectedly'
            });
          }
        }

        this.isConnected = false;
      };
    });
  }

  /**
   * Send query to server with browser context
   */
  private async _sendQuery(
    task: string,
    predefinedPlan?: PredefinedPlan,
    workflow?: SemanticWorkflow
  ): Promise<void> {
    this.checkIfAborted();

    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Add user message to history (UI already showed it optimistically)
    this.executionContext.messageManager.addHuman(task);

    // Build message content starting with task
    let messageContent = task;

    // If workflow exists, add userTrajectory context first
    if (workflow) {
      const userTrajectory = this._formatWorkflowAsUserTrajectory(workflow);
      messageContent = `${userTrajectory}

TASK: ${task}`;

      Logging.log("TeachWebSocketAgent", `Sending workflow context: ${workflow.metadata?.goal}`, "info");
    }

    // If predefined plan exists, format steps into message
    if (predefinedPlan) {
      const formattedSteps = predefinedPlan.steps
        .map((step, i) => `${i + 1}. ${step}`)
        .join('\n');

      messageContent += `

PREDEFINED PLAN: ${predefinedPlan.name}
Goal: ${predefinedPlan.goal}

Steps to execute:
${formattedSteps}`;

      Logging.log("TeachWebSocketAgent", `Sending predefined plan: ${predefinedPlan.name}`, "info");
    }

    // Gather browser context and append
    const browserContext = await this._getBrowserContext();
    const tabInfoStr = browserContext && browserContext.url
      ? `\n\nContext: Current user's open tab: Title: ${browserContext.title} URL: ${browserContext.url}`
      : '';

    messageContent += tabInfoStr;

    // Send message to server
    const message = {
      type: 'message',
      content: messageContent
    };

    try {
      this.ws.send(JSON.stringify(message));
      Logging.log("TeachWebSocketAgent", "Query sent to server", "info");

      // Initialize event timeout tracking
      this.lastEventTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Get browser context (current tab info)
   */
  private async _getBrowserContext(): Promise<any> {
    try {
      const currentPage = await this.executionContext.browserContext.getCurrentPage();
      const url = currentPage.url();
      const title = await currentPage.title();
      const selectedTabIds = this.executionContext.getSelectedTabIds();

      return {
        tabId: currentPage.tabId,
        url,
        title,
        selectedTabIds: selectedTabIds || []
      };
    } catch (error) {
      Logging.log("TeachWebSocketAgent", `Failed to get browser context: ${error}`, "warning");
      return {};
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private _handleMessage(rawData: string): void {
    try {
      const data = JSON.parse(rawData);

      // Update last event time for timeout tracking
      this.lastEventTime = Date.now();

      this._maybeStartGlow();

      // Route based on message type
      const isDev = isDevelopmentMode();

      switch (data.type) {
        case 'connection':
          // Already handled in _connect
          break;

        case 'completion':
          this._handleCompletion(data);
          break;

        case 'error':
          this._handleError(data);
          break;

        case 'init':
          if (isDev && data.content) {
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
          break;

        case 'thinking':
          if (data.content) {
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
          break;

        case 'tool_use':
          if (data.content) {
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
          break;

        case 'tool_result':
          if (isDev && data.content) {
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
          break;

        case 'response':
          if (data.content) {
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
          break;

        default:
          if (isDev && data.content) {
            Logging.log("TeachWebSocketAgent", `Unknown message type: ${data.type}`, "warning");
            const msgId = PubSub.generateId('teach_ws_server');
            this._emitThinking(msgId, data.content);
          }
      }

    } catch (error) {
      Logging.log(
        "TeachWebSocketAgent",
        `Failed to parse message: ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
    }
  }

  /**
   * Handle task completion from server
   */
  private _handleCompletion(event: any): void {
    const finalAnswer = event.content || event.finalAnswer || 'Task completed';
    this.isCompleted = true;

    Logging.log("TeachWebSocketAgent", "Task completed", "info");

    // Publish execution completed event like TeachAgent
    this._emitTeachModeEvent('execution_completed', {
      workflowId: '',
      success: true,
      message: finalAnswer
    });

    // Add to message history
    this.executionContext.messageManager.addAI(finalAnswer);

    // Close connection
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Handle error from server
   */
  private _handleError(event: any): void {
    const errorMsg = event.content || event.error || 'Unknown error';

    this.isCompleted = true;
    this.executionContext.incrementMetric('errors');
    Logging.log("TeachWebSocketAgent", `Server error: ${errorMsg}`, "error");

    // Publish execution failed event
    this._emitTeachModeEvent('execution_failed', {
      error: errorMsg
    });

    throw new Error(errorMsg);
  }

  /**
   * Wait for task completion with abort and timeout checks
   * Client-side safety timeout matching server's EVENT_GAP_TIMEOUT_MS (60s)
   */
  private async _waitForCompletion(): Promise<void> {
    while (!this.isCompleted) {
      // Check if user cancelled
      if (this.executionContext.abortSignal.aborted) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
        this.isCompleted = true;
        throw new AbortError();
      }

      // Check event gap timeout (client-side safety net)
      const timeSinceLastEvent = Date.now() - this.lastEventTime;
      if (timeSinceLastEvent > WS_AGENT_CONFIG.eventGapTimeout) {
        const errorMsg = `Agent timeout: No events received for ${WS_AGENT_CONFIG.eventGapTimeout / 1000}s`;
        this.isCompleted = true;
        Logging.log("TeachWebSocketAgent", errorMsg, "error");

        // Publish execution failed event
        this._emitTeachModeEvent('execution_failed', {
          error: errorMsg,
          reason: 'timeout'
        });

        throw new Error(errorMsg);
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Handle execution errors
   */
  private _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("TeachWebSocketAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("TeachWebSocketAgent", `Execution error: ${errorMessage}`, "error");

    // Publish execution failed event if not already completed
    if (!this.isCompleted) {
      this._emitTeachModeEvent('execution_failed', {
        error: errorMessage
      });
    }
  }

  /**
   * Start glow animation (fire and forget)
   */
  private _maybeStartGlow(): void {
    this.executionContext.browserContext.getCurrentPage()
      .then(page => {
        if (page?.tabId && !this.glowService.isGlowActive(page.tabId)) {
          return this.glowService.startGlow(page.tabId);
        }
      })
      .catch(error => {
        Logging.log("TeachWebSocketAgent", `Could not start glow: ${error}`, "warning");
      });
  }

  /**
   * Log execution metrics
   */
  private _logMetrics(): void {
    const metrics = this.executionContext.getExecutionMetrics();
    const duration = metrics.endTime - metrics.startTime;

    Logging.log(
      "TeachWebSocketAgent",
      `Execution complete: ${duration}ms duration`,
      "info"
    );

    Logging.logMetric("teach_wsagent.execution", {
      duration,
      sessionId: this.sessionId,
      success: this.isCompleted
    });
  }

  /**
   * Cleanup resources
   */
  private _cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.sessionId = null;
    this.lastEventTime = 0;

    Logging.log("TeachWebSocketAgent", "Cleanup complete", "info");
  }
}
