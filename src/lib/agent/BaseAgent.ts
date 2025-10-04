import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager, MessageType } from '@/lib/runtime/MessageManager'
import { ToolManager } from '@/lib/tools/ToolManager'
import { AIMessage, AIMessageChunk, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { Runnable } from '@langchain/core/runnables'
import { BaseLanguageModelInput } from '@langchain/core/language_models/base'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { HumanInputResponse, PubSubEvent } from '@/lib/pubsub/types'
import { Logging } from '@/lib/utils/Logging'
import { AbortError } from '@/lib/utils/Abortable'
import { jsonParseToolOutput } from '@/lib/utils/utils'
import { isDevelopmentMode } from '@/config'
import { wrapToolForMetrics } from '@/evals2/EvalToolWrapper'
import { ENABLE_EVALS2 } from '@/config'
import { type ScreenshotSizeKey } from '@/lib/browser/BrowserOSAdapter'
import { TokenCounter } from '@/lib/utils/TokenCounter'
import { getLLM } from '@/lib/llm/LangChainProvider'
import {
  ClickTool,
  TypeTool,
  ClearTool,
  ScrollTool,
  NavigateTool,
  KeyTool,
  WaitTool,
  TabsTool,
  TabOpenTool,
  TabFocusTool,
  TabCloseTool,
  ExtractTool,
  HumanInputTool,
  DoneTool,
  MoondreamVisualClickTool,
  MoondreamVisualTypeTool,
  GroupTabsTool,
  BrowserOSInfoTool,
  GetSelectedTabsTool,
  DateTool,
  MCPTool,
  GrepElementsTool,
  CelebrationTool,
} from '@/lib/tools'
import { GlowAnimationService } from '@/lib/services/GlowAnimationService'

// Human input constants
const HUMAN_INPUT_TIMEOUT = 600000  // 10 minutes
const HUMAN_INPUT_CHECK_INTERVAL = 500  // Check every 500ms

// Common result types
export interface SingleTurnResult {
  doneToolCalled: boolean
  requirePlanningCalled: boolean
  requiresHumanInput: boolean
}

/**
 * Abstract base class for all agents
 * Provides shared functionality for tool management, LLM streaming, and tool execution
 */
export abstract class BaseAgent {
  // Tools that trigger glow animation when executed
  protected static readonly GLOW_ENABLED_TOOLS = new Set([
    'click',
    'type',
    'clear',
    'moondream_visual_click',
    'moondream_visual_type',
    'scroll',
    'navigate',
    'key',
    'tab_open',
    'tab_focus',
    'tab_close',
    'extract'
  ])

  // Core dependencies
  protected readonly executionContext: ExecutionContext
  protected readonly toolManager: ToolManager
  protected readonly glowService: GlowAnimationService
  protected readonly agentName: string

  // Execution state
  protected executorLlmWithTools: Runnable<BaseLanguageModelInput, AIMessageChunk> | null = null
  protected iterations: number = 0

  constructor(executionContext: ExecutionContext, agentName: string) {
    this.executionContext = executionContext
    this.toolManager = new ToolManager(executionContext)
    this.glowService = GlowAnimationService.getInstance()
    this.agentName = agentName
    Logging.log(this.agentName, 'Agent instance created', 'info')
  }

  // Getters
  protected get executorMessageManager(): MessageManager {
    return this.executionContext.messageManager
  }

  protected get pubsub(): PubSubChannel {
    return this.executionContext.getPubSub()
  }

  // ============================================
  // Abstract methods (must be implemented by subclasses)
  // ============================================

  /**
   * Main execution entry point - must be implemented by each agent
   */
  abstract execute(...args: any[]): Promise<void>

  // ============================================
  // Message Publishing (can be overridden by subclasses)
  // ============================================

  /**
   * Emit a thinking/processing message to the UI
   * @param msgId - Unique message ID for updates
   * @param content - Message content
   */
  protected _emitThinking(msgId: string, content: string): void {
    this.pubsub.publishMessage(
      PubSub.createMessageWithId(msgId, content, 'thinking')
    )
  }

  /**
   * Emit a final message to the UI
   * @param content - Message content
   * @param type - Message type
   */
  protected _emitMessage(content: string, type: 'thinking' | 'assistant' | 'error'): void {
    this.pubsub.publishMessage(PubSub.createMessage(content, type as any))
  }

  /**
   * Emit debug information (only in development mode)
   * @param action - Action description
   * @param details - Additional details
   * @param maxLength - Maximum length for details truncation
   */
  protected _emitDebug(action: string, details?: any, maxLength: number = 60): void {
    if (isDevelopmentMode()) {
      let message = action
      if (details) {
        const truncated = details.length > maxLength
          ? details.substring(0, maxLength) + '...'
          : details
        message = `${action}: ${truncated}`
      }
      this.pubsub.publishMessage(
        PubSub.createMessage(`[DEV MODE] ${message}`, 'thinking')
      )
    }
  }

  // ============================================
  // Tool Registration
  // ============================================

  /**
   * Register standard tools used by most agents
   * Subclasses can override to customize the tool set
   */
  protected async _registerStandardTools(): Promise<void> {
    // Core interaction tools
    this.toolManager.register(ClickTool(this.executionContext))
    this.toolManager.register(TypeTool(this.executionContext))
    this.toolManager.register(ClearTool(this.executionContext))

    // Visual fallback tools (Moondream-powered)
    this.toolManager.register(MoondreamVisualClickTool(this.executionContext))
    this.toolManager.register(MoondreamVisualTypeTool(this.executionContext))

    // Navigation and utility tools
    this.toolManager.register(ScrollTool(this.executionContext))
    this.toolManager.register(NavigateTool(this.executionContext))
    this.toolManager.register(KeyTool(this.executionContext))
    this.toolManager.register(WaitTool(this.executionContext))

    // Tab management tools
    this.toolManager.register(TabsTool(this.executionContext))
    this.toolManager.register(TabOpenTool(this.executionContext))
    this.toolManager.register(TabFocusTool(this.executionContext))
    this.toolManager.register(TabCloseTool(this.executionContext))
    this.toolManager.register(GroupTabsTool(this.executionContext))
    this.toolManager.register(GetSelectedTabsTool(this.executionContext))

    // Utility tools
    this.toolManager.register(ExtractTool(this.executionContext))
    this.toolManager.register(HumanInputTool(this.executionContext))
    this.toolManager.register(DateTool(this.executionContext))
    this.toolManager.register(BrowserOSInfoTool(this.executionContext))
    this.toolManager.register(CelebrationTool(this.executionContext))

    // External integration tools
    this.toolManager.register(MCPTool(this.executionContext))

    // Limited context mode tools - only register when in limited context mode
    if (this.executionContext.isLimitedContextMode()) {
      this.toolManager.register(GrepElementsTool(this.executionContext))
    }

    // Completion tool
    this.toolManager.register(DoneTool(this.executionContext))

    Logging.log(
      this.agentName,
      `Registered ${this.toolManager.getAll().length} standard tools`,
      'info'
    )
  }

  /**
   * Initialize the agent - register tools and bind LLM with tools
   */
  protected async _initialize(): Promise<void> {
    // Register tools FIRST (before binding)
    await this._registerStandardTools()

    // Create LLM with consistent temperature
    const llm = await getLLM({
      temperature: 0.2,
      maxTokens: 4096,
    })

    // Validate LLM supports tool binding
    if (!llm.bindTools || typeof llm.bindTools !== 'function') {
      throw new Error('This LLM does not support tool binding')
    }

    // Bind tools ONCE and store the bound LLM
    this.executorLlmWithTools = llm.bindTools(this.toolManager.getAll())

    // Reset state
    this.iterations = 0

    Logging.log(
      this.agentName,
      `Initialization complete with ${this.toolManager.getAll().length} tools bound`,
      'info'
    )
  }

  // ============================================
  // LLM Streaming (Shared Logic)
  // ============================================

  /**
   * Invoke LLM with streaming support
   * Handles prohibited tag filtering and real-time UI updates
   */
  protected async _invokeLLMWithStreaming(
    messageManager: MessageManager
  ): Promise<AIMessage> {
    // check if executorLlmWithTools is null
    if (!this.executorLlmWithTools) {
      throw new Error('Executor LLM with tools is not initialized')
    }

    const mm = messageManager

    // Tags that should never be output to users
    const PROHIBITED_TAGS = [
      '<browser-state>',
      '<system-reminder>',
      '</browser-state>',
      '</system-reminder>'
    ]

    const message_history = mm.getMessages()

    const stream = await this.executorLlmWithTools.stream(message_history, {
      signal: this.executionContext.abortSignal,
    })

    let accumulatedChunk: AIMessageChunk | undefined
    let accumulatedText = ''
    let hasStartedThinking = false
    let currentMsgId: string | null = null
    let hasProhibitedContent = false

    for await (const chunk of stream) {
      this.checkIfAborted()

      if (chunk.content && typeof chunk.content === 'string') {
        // Accumulate text first
        accumulatedText += chunk.content

        // Check for prohibited tags if not already detected
        if (!hasProhibitedContent) {
          const detectedTag = PROHIBITED_TAGS.find(tag => accumulatedText.includes(tag))
          if (detectedTag) {
            hasProhibitedContent = true

            if (currentMsgId) {
              this._emitThinking(currentMsgId, 'Processing...')
            }

            mm.queueSystemReminder(
              'I will never output <browser-state> or <system-reminder> tags or their contents. These are for my internal reference only. If I have completed all actions, I will complete the task and call \'done\' tool.'
            )

            Logging.log(
              this.agentName,
              'LLM output contained prohibited tags, streaming stopped',
              'warning'
            )

            this.executionContext.incrementMetric('errors')
          }
        }

        // Only stream to UI if no prohibited content detected
        if (!hasProhibitedContent) {
          if (!hasStartedThinking) {
            hasStartedThinking = true
            currentMsgId = PubSub.generateId('msg_assistant')
          }

          if (currentMsgId) {
            this._emitThinking(currentMsgId, accumulatedText)
          }
        }
      }

      // Always accumulate chunks for final AIMessage (even with prohibited content)
      accumulatedChunk = !accumulatedChunk
        ? chunk
        : accumulatedChunk.concat(chunk)
    }

    // Only finish thinking if we started, have clean content, and have a message ID
    if (hasStartedThinking && !hasProhibitedContent && accumulatedText.trim() && currentMsgId) {
      this._emitThinking(currentMsgId, accumulatedText)
    }

    if (!accumulatedChunk) return new AIMessage({ content: '' })

    return new AIMessage({
      content: accumulatedChunk.content,
      tool_calls: accumulatedChunk.tool_calls,
    })
  }

  // ============================================
  // Tool Call Processing (Shared Logic)
  // ============================================

  /**
   * Process tool calls from LLM response
   * Executes each tool and handles errors, human input, and completion
   */
  protected async _processToolCalls(
    toolCalls: any[]
  ): Promise<{
    result: SingleTurnResult
    toolResults: Array<{
    toolName: string
    toolResult: string
    toolCallId: string
  }> }> {
    const result: SingleTurnResult = {
      doneToolCalled: false,
      requirePlanningCalled: false,
      requiresHumanInput: false,
    }

    const toolResults: Array<{
      toolName: string
      toolResult: string
      toolCallId: string
    }> = []

    for (const toolCall of toolCalls) {
      this.checkIfAborted()

      const { name: toolName, args, id: toolCallId } = toolCall

      this._emitDebug(`Calling tool ${toolName} with args`, JSON.stringify(args))

      // Start glow animation for visual tools
      await this._maybeStartGlowAnimation(toolName)

      const tool = this.toolManager.get(toolName)

      let toolResult: string
      if (!tool) {
        Logging.log(this.agentName, `Unknown tool: ${toolName}`, 'warning')
        const errorMsg = `Unknown tool: ${toolName}`
        toolResult = JSON.stringify({
          ok: false,
          error: errorMsg,
        })

        this._emitDebug('Error', errorMsg)
      } else {
        try {
          // Execute tool (wrap for evals2 metrics if enabled)
          let toolFunc = tool.func
          if (ENABLE_EVALS2) {
            const wrapped = wrapToolForMetrics(tool, this.executionContext, toolCallId)
            toolFunc = wrapped.func
          }
          toolResult = await toolFunc(args)
          toolResults.push({
            toolName,
            toolResult,
            toolCallId,
          })
        } catch (error) {
          const errorMsg = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
          toolResult = JSON.stringify({
            ok: false,
            error: errorMsg,
          })

          this.executionContext.incrementMetric('errors')

          Logging.log(
            this.agentName,
            `Tool ${toolName} execution failed: ${error}`,
            'error',
          )

          this._emitDebug(`Error executing ${toolName}`, errorMsg)
        }
      }

      // Parse result to check for special flags
      const parsedResult = jsonParseToolOutput(toolResult)

      // Check for special tool outcomes
      if (toolName === 'done' && parsedResult.ok) {
        result.doneToolCalled = true
      }

      if (
        toolName === 'human_input' &&
        parsedResult.ok &&
        parsedResult.requiresHumanInput
      ) {
        result.requiresHumanInput = true
      }
    }

    return {
      result,
      toolResults,
    }
  }

  // ============================================
  // Browser State Management
  // ============================================

  /**
   * Get browser state message with optional screenshot
   * Handles token limits and truncation automatically
   */
  protected async _getBrowserStateMessage(
    includeScreenshot: boolean,
    simplified: boolean = true,
    screenshotSize: ScreenshotSizeKey = "large",
    includeBrowserState: boolean = true,
    browserStateTokensLimit: number = 50000
  ): Promise<HumanMessage> {
    let browserStateString: string | null = null

    if (includeBrowserState) {
      browserStateString = await this.executionContext.browserContext.getBrowserStateString(
        simplified,
      )

      // Check if browser state string exceed token limit
      const tokens = TokenCounter.countMessage(new HumanMessage(browserStateString))
      if (tokens > browserStateTokensLimit) {
        // If it exceeds, first remove Hidden Elements from browser state string
        browserStateString = await this.executionContext.browserContext.getBrowserStateString(
          simplified,
          true // hide hidden elements
        )
        // Then again check if it still exceeds, if it does, truncate the string
        const tokens = TokenCounter.countMessage(new HumanMessage(browserStateString))
        if (tokens > browserStateTokensLimit) {
          // Calculate the ratio to truncate by
          const truncationRatio = browserStateTokensLimit / tokens

          // Truncate the string (rough approximation based on character length)
          const targetLength = Math.floor(browserStateString.length * truncationRatio)
          browserStateString = browserStateString.substring(0, targetLength)

          // Add truncation indicator
          browserStateString += "\n\n-- IMPORTANT: TRUNCATED DUE TO TOKEN LIMIT, USE GREP ELEMENTS TOOL TO SEARCH FOR ELEMENTS IF NEEDED --\n"
        }
      }
    }

    if (includeScreenshot && this.executionContext.supportsVision()) {
      // Get current page and take screenshot
      const page = await this.executionContext.browserContext.getCurrentPage()
      const screenshot = await page.takeScreenshot(screenshotSize, includeBrowserState)

      if (screenshot) {
        // Build content array based on what is included
        const content: any[] = []
        if (includeBrowserState && browserStateString !== null) {
          content.push({ type: "text", text: `<browser-state>${browserStateString}</browser-state>` })
        }
        content.push({ type: "image_url", image_url: { url: screenshot } })

        const message = new HumanMessage({
          content,
        })
        // Tag this as a browser state message for proper handling in MessageManager
        message.additional_kwargs = { messageType: MessageType.BROWSER_STATE }
        return message
      }
    }

    // If only browser state is requested or screenshot failed/unavailable
    if (includeBrowserState && browserStateString !== null) {
      const message = new HumanMessage(`<browser-state>${browserStateString}</browser-state>`)
      message.additional_kwargs = { messageType: MessageType.BROWSER_STATE }
      return message
    }

    // If neither browser state nor screenshot is included, return a minimal message
    const message = new HumanMessage("")
    message.additional_kwargs = { messageType: MessageType.BROWSER_STATE }
    return message
  }

  // ============================================
  // Common Utilities
  // ============================================

  /**
   * Check if execution has been aborted
   */
  protected checkIfAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError()
    }
  }

  /**
   * Handle glow animation for tools that interact with the browser
   */
  protected async _maybeStartGlowAnimation(toolName: string): Promise<boolean> {
    if (!BaseAgent.GLOW_ENABLED_TOOLS.has(toolName)) {
      return false
    }

    try {
      const currentPage = await this.executionContext.browserContext.getCurrentPage()
      const tabId = currentPage.tabId

      if (tabId && !this.glowService.isGlowActive(tabId)) {
        await this.glowService.startGlow(tabId)
        return true
      }
      return false
    } catch (error) {
      console.error(`Could not manage glow for tool ${toolName}: ${error}`)
      return false
    }
  }

  /**
   * Wait for human input with timeout
   */
  protected async _waitForHumanInput(): Promise<'done' | 'abort' | 'timeout'> {
    const startTime = Date.now()
    const requestId = this.executionContext.getHumanInputRequestId()

    if (!requestId) {
      console.error('No human input request ID found')
      return 'abort'
    }

    // Subscribe to human input responses
    const subscription = this.pubsub.subscribe((event: PubSubEvent) => {
      if (event.type === 'human-input-response') {
        const response = event.payload as HumanInputResponse
        if (response.requestId === requestId) {
          this.executionContext.setHumanInputResponse(response)
        }
      }
    })

    try {
      // Poll for response or timeout
      while (!this.executionContext.shouldAbort()) {
        const response = this.executionContext.getHumanInputResponse()
        if (response) {
          return response.action
        }

        if (Date.now() - startTime > HUMAN_INPUT_TIMEOUT) {
          this._emitMessage('⏱️ Human input timed out after 10 minutes', 'error')
          return 'timeout'
        }

        await new Promise(resolve => setTimeout(resolve, HUMAN_INPUT_CHECK_INTERVAL))
      }

      return 'abort'

    } finally {
      subscription.unsubscribe()
    }
  }

  /**
   * Handle execution errors
   */
  protected _handleExecutionError(error: unknown): void {
    if (error instanceof AbortError) {
      Logging.log(this.agentName, 'Execution aborted by user', 'info')
      return
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    Logging.log(this.agentName, `Execution error: ${errorMessage}`, 'error')

    this._emitMessage(`Error: ${errorMessage}`, 'error')
  }

  /**
   * Log execution metrics
   */
  protected _logMetrics(): void {
    const metrics = this.executionContext.getExecutionMetrics()
    const duration = metrics.endTime - metrics.startTime
    const successRate =
      metrics.toolCalls > 0
        ? (
            ((metrics.toolCalls - metrics.errors) / metrics.toolCalls) *
            100
          ).toFixed(1)
        : '0'

    // Convert tool frequency Map to object for logging
    const toolFrequency: Record<string, number> = {}
    metrics.toolFrequency.forEach((count, toolName) => {
      toolFrequency[toolName] = count
    })

    Logging.log(
      this.agentName,
      `Execution complete: ${this.iterations} iterations, ${metrics.toolCalls} tool calls, ` +
        `${metrics.observations} observations, ${metrics.errors} errors, ` +
        `${successRate}% success rate, ${duration}ms duration`,
      'info',
    )

    if (metrics.toolCalls > 0) {
      Logging.log(
        this.agentName,
        `Tool frequency: ${JSON.stringify(toolFrequency)}`,
        'info',
      )
    }

    Logging.logMetric(`${this.agentName.toLowerCase()}.execution`, {
      iterations: this.iterations,
      toolCalls: metrics.toolCalls,
      observations: metrics.observations,
      errors: metrics.errors,
      duration,
      successRate: parseFloat(successRate),
      toolFrequency,
    })
  }

  /**
   * Cleanup resources
   */
  protected _cleanup(): void {
    this.iterations = 0
    Logging.log(this.agentName, 'Cleanup complete', 'info')
  }

  /**
   * Stop all glow animations
   */
  protected async _stopAllGlowAnimations(): Promise<void> {
    try {
      const activeGlows = await this.glowService.getAllActiveGlows()
      for (const tabId of activeGlows) {
        await this.glowService.stopGlow(tabId)
      }
    } catch (error) {
      console.error(`Could not stop glow animation: ${error}`)
    }
  }
}
