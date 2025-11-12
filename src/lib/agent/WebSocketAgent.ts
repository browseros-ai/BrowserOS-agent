import { ExecutionContext, WS_AGENT_CONFIG, WS_CONNECTION_TIMEOUT } from "@/lib/runtime/ExecutionContext";
import { PubSub } from "@/lib/pubsub";
import { AbortError } from "@/lib/utils/Abortable";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { Logging } from "@/lib/utils/Logging";
import { GlowAnimationService } from '@/lib/services/GlowAnimationService';
import { isDevelopmentMode } from '@/config';
import { getUserId } from '@/lib/utils/user-id';


interface PredefinedPlan {
  agentId: string;
  name?: string;  // Optional to match ExecutionMetadata schema
  goal: string;
  steps: string[];
}

/**
 * WebSocket-based agent that connects to remote server
 * Server handles all planning, reasoning, and tool execution
 * Client sends query with browser context and streams events to PubSub
 */
export class WebSocketAgent {
  private readonly executionContext: ExecutionContext;
  private readonly glowService: GlowAnimationService;

  // WebSocket state
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private isDisposed = false;  // Agent lifecycle (disposed = can't be reused)
  private currentMessageComplete = false;  // Current message completion (resets per message)
  private lastEventTime = 0;  // Track last event for timeout
  private isPendingCancellation = false;  // True when cancelled, waiting for server to stop

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext;
    this.glowService = GlowAnimationService.getInstance();
    Logging.log("WebSocketAgent", "Agent instance created", "info");
  }

  private get pubsub() {
    return this.executionContext.getPubSub();
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
      Logging.log("WebSocketAgent", `Special task detected: ${specialTaskMetadata.metadata.predefinedPlan?.name}`, "info");
    }

    try {
      // Reset per-message state
      this.currentMessageComplete = false;

      this.executionContext.setCurrentTask(_task);
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("WebSocketAgent", "Starting execution", "info");

      // Start glow animation
      this._maybeStartGlow();

      // Connect to WebSocket server (if not already connected)
      if (!this.isConnected) {
        await this._connect();
      }

      // Send message (extracted to helper for reuse)
      await this._sendMessage(_task, this.executionContext.abortSignal, _metadata?.predefinedPlan);

      // Wait for this message to complete
      await this._waitForMessageCompletion(this.executionContext.abortSignal);

    } catch (error) {
      this._handleExecutionError(error);
      throw error;
    } finally {
      // DON'T call _cleanup() - keep connection alive for follow-ups!
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
        Logging.log("WebSocketAgent", `Could not stop glow animation: ${error}`, "warning");
      }
    }
  }

  /**
   * Connect to WebSocket server and wait for connection event
   */
  private async _connect(): Promise<void> {
    this.checkIfAborted();

    // Get WebSocket URL and user ID
    const wsUrl = await this.executionContext.getAgentServerUrl();
    const userId = await getUserId();

    return new Promise((resolve, reject) => {
      this._publishMessage('Getting ready...', 'thinking');
      Logging.log("WebSocketAgent", `Connecting to ${wsUrl}`, "info");

      // Create WebSocket
      try {
        this.ws = new WebSocket(wsUrl);
      } catch (error) {
        Logging.log("WebSocketAgent", `Failed to create WebSocket: ${error}`, "error");
        reject(error);
        return;
      }

      // Connection timeout - don't publish, let _handleExecutionError do it
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${WS_CONNECTION_TIMEOUT}ms`));
        this.ws?.close();
      }, WS_CONNECTION_TIMEOUT);

      // WebSocket opened - send session.create with userId
      this.ws.onopen = () => {
        Logging.log("WebSocketAgent", "WebSocket connection opened", "info");

        // Send session.create message with userId for Klavis MCP integration
        try {
          const sessionCreateMessage = {
            type: 'session.create',
            userId: userId,
            agentType: 'codex-sdk'
          };

          this.ws?.send(JSON.stringify(sessionCreateMessage));
          Logging.log("WebSocketAgent", `Sent session.create with userId: ${userId.substring(0, 16)}...`, "info");
        } catch (error) {
          Logging.log("WebSocketAgent", `Failed to send session.create: ${error}`, "error");
          clearTimeout(timeout);
          reject(error);
        }
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
                  "WebSocketAgent",
                  `Session established: ${this.sessionId.substring(0, 16)}...`,
                  "info"
                );
              }

              resolve();
            }
          } catch (err) {
            Logging.log("WebSocketAgent", `Failed to parse connection message: ${err}`, "error");
          }
        }

        // Handle all subsequent messages
        this._handleMessage(event.data as string);
      };

      // WebSocket error - don't publish, let _handleExecutionError do it
      this.ws.onerror = (_error) => {
        clearTimeout(timeout);
        Logging.log("WebSocketAgent", "WebSocket error", "error");
        reject(new Error('WebSocket connection failed'));
      };

      // WebSocket closed
      this.ws.onclose = (_event) => {
        Logging.log("WebSocketAgent", "WebSocket connection closed", "info");

        // Only publish if we were actually connected (not a connection failure)
        // Connection failures are handled by onerror + _handleExecutionError
        if (this.isConnected && !this.isDisposed) {
          this.isDisposed = true;

          // Check if this was user-initiated cancellation
          if (this.executionContext.abortSignal.aborted) {
            this._publishMessage('✅ Task cancelled', 'assistant');
          } else {
            this._publishMessage('❌ Connection closed unexpectedly', 'error');
          }
        }

        this.isConnected = false;
      };
    });
  }

  /**
   * Send message to server with browser context
   * Generic helper used by both initial execute() and follow-up messages
   */
  private async _sendMessage(
    task: string,
    abortSignal: AbortSignal,
    predefinedPlan?: PredefinedPlan
  ): Promise<void> {
    // Check abort with provided signal (not stored one)
    if (abortSignal.aborted) {
      throw new AbortError();
    }

    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Clear pending cancellation flag (starting new message)
    this.isPendingCancellation = false;

    // Add user message to history (UI already showed it optimistically)
    this.executionContext.messageManager.addHuman(task);

    // Build message content starting with task
    let messageContent = task;

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

      Logging.log("WebSocketAgent", `Sending predefined plan: ${predefinedPlan.name}`, "info");
    }

    // Gather browser context and append
    const browserContext = await this._getBrowserContext();
    const userId = await getUserId();

    const tabInfoStr = browserContext && browserContext.url
      ? `\n\nContext: User ID: ${userId} (need for Klavis MCP tools), Current user's active tab: Tab ID: ${browserContext.tabId}, Title: ${browserContext.title}, URL: ${browserContext.url}${browserContext.selectedTabIds?.length > 0 ? `, Selected Tabs: ${browserContext.selectedTabIds.join(', ')}` : ''}`
      : '';

    messageContent += tabInfoStr;

    // Send message to server
    const message = {
      type: 'message',
      content: messageContent
    };

    try {
      this.ws.send(JSON.stringify(message));
      Logging.log("WebSocketAgent", "Message sent to server", "info");

      // Initialize event timeout tracking
      this.lastEventTime = Date.now();
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Send cancel message to server to stop current execution
   */
  private _sendCancelToServer(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      Logging.log("WebSocketAgent", "Cannot send cancel - WebSocket not open", "warning");
      return;
    }

    if (!this.sessionId) {
      Logging.log("WebSocketAgent", "Cannot send cancel - no sessionId", "warning");
      return;
    }

    try {
      const cancelMessage = {
        type: 'cancel',
        sessionId: this.sessionId
      };

      this.ws.send(JSON.stringify(cancelMessage));
      Logging.log("WebSocketAgent", "Sent cancel message to server", "info");
    } catch (error) {
      Logging.log("WebSocketAgent", `Failed to send cancel message: ${error}`, "error");
      // Don't throw - cancellation is best-effort, client-side filtering will handle it
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
      Logging.log("WebSocketAgent", `Failed to get browser context: ${error}`, "warning");
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

      // If we're in pending cancellation, ignore all events except cancelled ack
      if (this.isPendingCancellation) {
        if (data.type === 'cancelled') {
          Logging.log("WebSocketAgent", "Server acknowledged cancellation", "info");
          // Keep isPendingCancellation=true until next message
        }
        // Ignore all other events from the cancelled task
        return;
      }

      // Trigger glow
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
            this._publishMessage(data.content, 'thinking');
          }
          break;

        case 'thinking':
          if (data.content) {
            this._publishMessage(data.content, 'thinking');
          }
          break;

        case 'tool_use':
          if (data.content) {
            this._publishMessage(data.content, 'thinking');
          }
          break;

        case 'tool_result':
          if (isDev && data.content) {
            this._publishMessage(data.content, 'thinking');
          }
          break;

        case 'response':
          if (data.content) {
            this._publishMessage(data.content, 'thinking');
          }
          break;

        default:
          if (isDev && data.content) {
            Logging.log("WebSocketAgent", `Unknown message type: ${data.type}`, "warning");
            this._publishMessage(data.content, 'thinking');
          }
      }

    } catch (error) {
      Logging.log(
        "WebSocketAgent",
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

    // Mark current MESSAGE as complete (not agent!)
    this.currentMessageComplete = true;

    Logging.log("WebSocketAgent", "Message completed, ready for follow-up", "info");

    // Publish final answer
    this.pubsub.publishMessage(
      PubSub.createMessage(finalAnswer, 'assistant')
    );

    // Add to message history
    this.executionContext.messageManager.addAI(finalAnswer);

    // DON'T close connection - keep alive for follow-ups!
    // Connection will be closed explicitly via disconnect() or when agent is disposed
  }

  /**
   * Handle error from server
   */
  private _handleError(event: any): void {
    const errorMsg = event.content || event.error || 'Unknown error';

    this.isDisposed = true;  // Error = agent is done
    this.executionContext.incrementMetric('errors');
    Logging.log("WebSocketAgent", `Server error: ${errorMsg}`, "error");

    // this._publishMessage(`❌ Server error: ${errorMsg}`, 'error');

    throw new Error(errorMsg);
  }

  /**
   * Wait for current message completion with abort and timeout checks
   * Client-side safety timeout matching server's EVENT_GAP_TIMEOUT_MS (60s)
   */
  private async _waitForMessageCompletion(abortSignal: AbortSignal): Promise<void> {
    while (!this.currentMessageComplete && !this.isDisposed) {
      // Check if user cancelled
      if (abortSignal.aborted) {
        // Send cancel message to server so it stops processing
        this._sendCancelToServer();

        // Mark as pending cancellation (ignore subsequent events)
        this.isPendingCancellation = true;

        // Mark current message as complete (ready for next message)
        this.currentMessageComplete = true;

        Logging.log("WebSocketAgent", "Message cancelled, agent ready for follow-up", "info");
        throw new AbortError();
      }

      // Check event gap timeout (client-side safety net)
      const timeSinceLastEvent = Date.now() - this.lastEventTime;
      if (timeSinceLastEvent > WS_AGENT_CONFIG.eventGapTimeout) {
        const errorMsg = `Agent timeout: No events received for ${WS_AGENT_CONFIG.eventGapTimeout / 1000}s`;
        this.isDisposed = true;  // Timeout = agent is done
        Logging.log("WebSocketAgent", errorMsg, "error");
        // this._publishMessage(`❌ ${errorMsg}`, 'error');
        throw new Error(errorMsg);
      }

      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Publish message to PubSub for UI
   */
  private _publishMessage(
    content: string,
    type: 'thinking' | 'assistant' | 'error'
  ): void {
    this.pubsub.publishMessage(
      PubSub.createMessage(content, type as any)
    );
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
        Logging.log("WebSocketAgent", `Could not start glow: ${error}`, "warning");
      });
  }

  /**
   * Handle execution errors
   */
  private _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("WebSocketAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("WebSocketAgent", `Execution error: ${errorMessage}`, "error");

    // Publish error if not already disposed
    if (!this.isDisposed) {
    //   this._publishMessage(`❌ ${errorMessage}`, 'error');
    }
  }

  /**
   * Log execution metrics
   */
  private _logMetrics(): void {
    const metrics = this.executionContext.getExecutionMetrics();
    const duration = metrics.endTime - metrics.startTime;

    Logging.log(
      "WebSocketAgent",
      `Execution complete: ${duration}ms duration`,
      "info"
    );

    Logging.logMetric("wsagent.execution", {
      duration,
      sessionId: this.sessionId,
      success: this.currentMessageComplete
    });
  }

  /**
   * Check if agent is ready to accept follow-up messages
   * @returns true if agent can accept follow-ups, false otherwise
   */
  isReadyForFollowUp(): boolean {
    return this.isConnected && !this.isDisposed && this.currentMessageComplete;
  }

  /**
   * Send a follow-up message using the same WebSocket connection
   * Reuses existing session context for conversation continuity
   * @param message - The follow-up message to send
   * @param abortSignal - Fresh abort signal for this message
   */
  async sendFollowUpMessage(message: string, abortSignal: AbortSignal): Promise<void> {
    if (!this.isReadyForFollowUp()) {
      throw new Error('Agent is not ready for follow-up. Connection may be closed or message still in progress.');
    }

    try {
      // Reset per-message state
      this.currentMessageComplete = false;

      Logging.log("WebSocketAgent", "Sending follow-up message", "info");

      // Send message using existing connection
      await this._sendMessage(message, abortSignal);

      // Wait for this message to complete
      await this._waitForMessageCompletion(abortSignal);

    } catch (error) {
      this._handleExecutionError(error);
      throw error;
    }
  }

  /**
   * Explicitly disconnect the WebSocket agent
   * Closes connection and cleans up all resources
   * Call this when switching modes, resetting, or disposing
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected && !this.ws) {
      Logging.log("WebSocketAgent", "Already disconnected", "info");
      return;
    }

    Logging.log("WebSocketAgent", "Disconnecting WebSocket agent", "info");
    this._cleanup();
  }

  /**
   * Cleanup resources - closes connection and resets state
   * Called when agent is being disposed (not after each message)
   */
  private _cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isDisposed = true;
    this.currentMessageComplete = false;
    this.isPendingCancellation = false;  // Clear cancellation flag
    this.sessionId = null;  // Clear session on full cleanup
    this.lastEventTime = 0;

    Logging.log("WebSocketAgent", "Agent cleanup complete", "info");
  }
}
