import { ExecutionContext } from "@/lib/runtime/ExecutionContext";
import { PubSub } from "@/lib/pubsub";
import { AbortError } from "@/lib/utils/Abortable";
import { ExecutionMetadata } from "@/lib/types/messaging";
import { Logging } from "@/lib/utils/Logging";
import { WS_AGENT_CONFIG } from "@/lib/agent/websocket/config";

/**
 * WebSocket-based agent that connects to remote server
 * Server handles all planning, reasoning, and tool execution
 * Client sends query with browser context and streams events to PubSub
 */
export class WebSocketAgent {
  private readonly executionContext: ExecutionContext;
  private readonly wsUrl: string;

  // WebSocket state
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isConnected = false;
  private isCompleted = false;
  private lastEventTime = 0;  // Track last event for timeout

  constructor(
    executionContext: ExecutionContext,
    wsUrl: string = WS_AGENT_CONFIG.url
  ) {
    this.executionContext = executionContext;
    this.wsUrl = wsUrl;
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
   * Main execution entry point
   */
  async execute(task: string, metadata?: ExecutionMetadata): Promise<void> {
    try {
      this.executionContext.setCurrentTask(task);
      this.executionContext.setExecutionMetrics({
        ...this.executionContext.getExecutionMetrics(),
        startTime: Date.now(),
      });

      Logging.log("WebSocketAgent", "Starting execution", "info");

      // Connect to WebSocket server
      await this._connect();

      // Send query with browser context
      await this._sendQuery(task);

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
    }
  }

  /**
   * Connect to WebSocket server and wait for connection event
   */
  private async _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.checkIfAborted();

      this._publishMessage('🔗 Connecting to reasoning server...', 'thinking');
      Logging.log("WebSocketAgent", `Connecting to ${this.wsUrl}`, "info");

      // Create WebSocket
      try {
        this.ws = new WebSocket(this.wsUrl);
      } catch (error) {
        Logging.log("WebSocketAgent", `Failed to create WebSocket: ${error}`, "error");
        reject(error);
        return;
      }

      // Connection timeout - don't publish, let _handleExecutionError do it
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${WS_AGENT_CONFIG.connectionTimeout}ms`));
        this.ws?.close();
      }, WS_AGENT_CONFIG.connectionTimeout);

      // WebSocket opened
      this.ws.onopen = () => {
        Logging.log("WebSocketAgent", "WebSocket connection opened", "info");
        this._publishMessage('✅ WebSocket opened, waiting for server...', 'thinking');
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

              this._publishMessage('✅ Connected to reasoning server', 'thinking');

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
      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        Logging.log("WebSocketAgent", "WebSocket error", "error");
        reject(new Error('WebSocket connection failed'));
      };

      // WebSocket closed
      this.ws.onclose = (event) => {
        Logging.log("WebSocketAgent", "WebSocket connection closed", "info");

        // Only publish if we were actually connected (not a connection failure)
        // Connection failures are handled by onerror + _handleExecutionError
        if (this.isConnected && !this.isCompleted) {
          this.isCompleted = true;

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
   * Send query to server with browser context
   */
  private async _sendQuery(task: string): Promise<void> {
    this.checkIfAborted();

    if (!this.ws || !this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    // Add user message to history (UI already showed it optimistically)
    this.executionContext.messageManager.addHuman(task);

    // Gather browser context and append to task
    const browserContext = await this._getBrowserContext();
    const tabInfoStr = browserContext && browserContext.url
      ? `\nContext: Current user's open tab: Title: ${browserContext.title} URL: ${browserContext.url}`
      : '';

    const taskWithContext = task + tabInfoStr;

    // Send message to server
    const message = {
      type: 'message',
      content: taskWithContext
    };

    try {
      this.ws.send(JSON.stringify(message));
      Logging.log("WebSocketAgent", "Query sent to server", "info");

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
      const url = await currentPage.url();
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

      // Route based on message type
      if (data.type === 'connection') {
        // Already handled in _connect
        return;
      }

      if (data.type === 'completion') {
        this._handleCompletion(data);
        return;
      }

      if (data.type === 'error') {
        this._handleError(data);
        return;
      }

      // For all other types (response, tool_use, thinking, etc), publish content
      if (data.content) {
        this._publishMessage(data.content, 'thinking');
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
    this.isCompleted = true;

    Logging.log("WebSocketAgent", "Task completed", "info");

    // Publish final answer
    this.pubsub.publishMessage(
      PubSub.createMessage(finalAnswer, 'assistant')
    );

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
    Logging.log("WebSocketAgent", `Server error: ${errorMsg}`, "error");

    // this._publishMessage(`❌ Server error: ${errorMsg}`, 'error');

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
   * Handle execution errors
   */
  private _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log("WebSocketAgent", "Execution aborted by user", "info");
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    Logging.log("WebSocketAgent", `Execution error: ${errorMessage}`, "error");

    // Publish error if not already completed
    if (!this.isCompleted) {
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

    Logging.log("WebSocketAgent", "Cleanup complete", "info");
  }
}
