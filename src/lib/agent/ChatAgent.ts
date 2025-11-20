import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager, LLMMessageType } from '@/lib/runtime/MessageManager'
import { ToolManager } from '@/lib/tools/ToolManager'
import { ScrollTool, ScreenshotTool, PdfExtractTool } from '@/lib/tools'
import { generateSystemPrompt, generatePageContextMessage, generateTaskPrompt } from './ChatAgent.prompt'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'
import { PubSub } from '@/lib/pubsub'
import { PubSubChannel } from '@/lib/pubsub/PubSubChannel'
import { AbortError, isUserCancellation } from '@/lib/utils/Abortable'
import { Logging } from '@/lib/utils/Logging'

// Type definitions
interface ExtractedPageContext {
  tabs: Array<{
    id: number
    url: string
    title: string
    text: string
  }>
  isSingleTab: boolean
}

/**
 * ChatAgent - Lightweight agent for Q&A interactions with web pages
 * Direct streaming answers without planning or complex tool orchestration
 */
export class ChatAgent {
  // Constants
  private static readonly MAX_TURNS = 20
  private static readonly TOOLS = ['screenshot_tool', 'scroll_tool', 'pdf_extract']
  private static readonly INCLUDE_LINKS = true
  
  private readonly executionContext: ExecutionContext
  private readonly toolManager: ToolManager
  
  // State tracking for tab context caching
  private lastExtractedTabIds: Set<number> | null = null

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
    this.toolManager = new ToolManager(executionContext)
    this._registerTools()
  }

  // Getters for context components
  private get messageManager(): MessageManager {
    return this.executionContext.messageManager
  }

  private get pubsub(): PubSubChannel {
    return this.executionContext.getPubSub()
  }

  /**
   * Register only the minimal tools needed for Q&A
   */
  private _registerTools(): void {
    // Only register the essential tools for Q&A + PDF support
    this.toolManager.register(ScreenshotTool(this.executionContext))
    this.toolManager.register(ScrollTool(this.executionContext))
    this.toolManager.register(PdfExtractTool(this.executionContext))
    
    Logging.log('ChatAgent', `Registered ${this.toolManager.getAll().length} tools for Q&A mode`)
  }

  /**
   * Check abort signal and throw if aborted
   */
  private _checkAborted(): void {
    if (this.executionContext.abortSignal.aborted) {
      throw new AbortError()
    }
  }

  /**
   * Cleanup method (currently unused but kept for interface compatibility)
   */
  public cleanup(): void {
    // No cleanup needed currently
  }

  /**
   * Main execution entry point - streamlined for Q&A
   */
  async execute(query: string): Promise<void> {
    try {
      this._checkAborted()
      
      // Check if this is a fresh conversation (chat mode just started and message manager is empty)
      const isFreshConversation = this._isFreshConversation()
      
      // Get current tab IDs
      const currentTabIds = await this._getCurrentTabIds()
      
      // Check if we need to extract content
      const needsExtraction = isFreshConversation || this._hasTabsChanged(currentTabIds)
      
      // Need to re-extract web page
      if (needsExtraction) {
        // Extract page context
        const pageContext = await this._extractPageContext()
        
        // If also is a fresh conversation, add system prompt
        if (isFreshConversation) {
          // Fresh conversation: Clear and add simple system prompt once
          this.messageManager.clear()

          // Simple system prompt - just sets the role
          const systemPrompt = generateSystemPrompt()
          this.messageManager.addSystem(systemPrompt)

          // Add page context as browser state message (only if tabs exist)
          const contextMessage = generatePageContextMessage(pageContext, false)
          if (contextMessage) {
            this.messageManager.addBrowserState(contextMessage)
          }
        } else {
          // Tabs changed: replace browser state to remove old page content
          const contextMessage = generatePageContextMessage(pageContext, true)
          if (contextMessage) {
            this.messageManager.addBrowserState(contextMessage)
          } else {
            // No tabs - remove browser state entirely to enable general knowledge mode
            this.messageManager.removeMessagesByType(LLMMessageType.BROWSER_STATE)
          }
        }
        
        // Update tracked tab IDs
        this.lastExtractedTabIds = currentTabIds
      }
      
      // Add user query with instruction to refer to context
      const queryWithInstruction = generateTaskPrompt(query, needsExtraction)
      this.messageManager.addHuman(queryWithInstruction)
      
      // Stream LLM response
      await this._streamLLM({ tools: false })
      
      Logging.log('ChatAgent', 'Q&A response completed')
      
    } catch (error) {
      // Check if this is a user cancellation - handle silently
      if (isUserCancellation(error) || this.executionContext.isUserCancellation()) {
        // User-initiated cancellation - don't rethrow, let execution end gracefully
        Logging.log('ChatAgent', 'Execution cancelled by user')
        return  // Don't rethrow
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorType = error instanceof Error ? error.name : 'UnknownError'
        
        // Log error metric with details
        Logging.logMetric('execution_error', {
          error: errorMessage,
          error_type: errorType,
          query: query.substring(0, 200), // Truncate long queries
          mode: 'chat',
          agent: 'ChatAgent'
        })
        
        Logging.log('ChatAgent', `Execution failed: ${errorMessage}`, 'error')
        this.pubsub.publishMessage(PubSub.createMessage(`Error: ${errorMessage}`, 'error'))
        throw error
      }
    }
  }

  /**
   * Check if this is a fresh conversation (chat mode just started)
   */
  private _isFreshConversation(): boolean {
    const messages = this.messageManager.getMessages()
    return messages.length === 0
  }
  
  /**
   * Get current active/selected tab IDs as a Set
   */
  private async _getCurrentTabIds(): Promise<Set<number>> {
    const selectedTabIds = this.executionContext.getSelectedTabIds()

    // If null or empty array, user deselected all tabs - return empty Set
    if (!selectedTabIds || selectedTabIds.length === 0) {
      return new Set()
    }

    // Check if user has explicitly selected multiple tabs (using "@" selector)
    const hasExplicitSelection = selectedTabIds.length > 1

    if (hasExplicitSelection) {
      // User explicitly selected multiple tabs - use those
      return new Set(selectedTabIds)
    }

    // Single tab selected - use it directly (don't auto-detect current page)
    return new Set([selectedTabIds[0]])
  }
  
  /**
   * Check if tabs have changed since last extraction
   */
  private _hasTabsChanged(currentTabIds: Set<number>): boolean {
    if (!this.lastExtractedTabIds) return true
    
    // Compare Set sizes
    if (this.lastExtractedTabIds.size !== currentTabIds.size) return true
    
    // Check if all current tabs were in the last extraction
    for (const tabId of currentTabIds) {
      if (!this.lastExtractedTabIds.has(tabId)) return true
    }
    
    return false
  }

  /**
   * Extract page context from selected tabs
   */
  private async _extractPageContext(): Promise<ExtractedPageContext> {
    // Get selected tab IDs from execution context
    const selectedTabIds = this.executionContext.getSelectedTabIds()

    // If explicitly null, user removed all tabs - return empty context
    if (selectedTabIds === null) {
      return {
        tabs: [],
        isSingleTab: false
      }
    }

    const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0)

    // Get browser pages
    const pages = await this.executionContext.browserContext.getPages(
      hasUserSelectedTabs && selectedTabIds ? selectedTabIds : undefined
    )

    if (pages.length === 0) {
      throw new Error('No tabs available for context extraction')
    }
    
    // Extract content from each tab using helper methods that handle both old and new formats
    const tabs = await Promise.all(
      pages.map(async page => {
        // Use unified methods that handle both snapshot formats
        const text = await page.getTextSnapshotString() || 'No content found'

        let linksBlock = ''
        if (ChatAgent.INCLUDE_LINKS) {
          const linksText = await page.getLinksSnapshotString()
          const linkLines = linksText
            .split('\n')
            .map((line: string) => line.trim())
            .filter((line: string) => line.length > 0)
          if (linkLines.length > 0) {
            linksBlock = ['Links:', linkLines.join('\n')].join('\n')
          }
        }

        const combined = [text, linksBlock].filter(Boolean).join('\n\n')

        return {
          id: page.tabId,
          url: page.url(),
          title: await page.title(),
          text: combined
        }
      })
    )
    
    return {
      tabs,
      isSingleTab: tabs.length === 1
    }
  }


  /**
   * Stream LLM response with or without tools
   */
  private async _streamLLM(opts: { tools: boolean }): Promise<void> {
    const llm = await this.executionContext.getLLM({ temperature: 0.3, intelligence: 'high' })
    
    // Only bind tools in Pass 2
    const llmToUse = opts.tools && llm.bindTools
      ? llm.bindTools(this.toolManager.getAll())
      : llm
    
    // Get current messages
    const messages = this.messageManager.getMessages()
    
    // Start streaming message
    const streamMsgId = PubSub.generateId('chat_stream')
    
    // Stream the response
    const stream = await llmToUse.stream(messages)
    
    // Accumulate chunks for final message
    const chunks: AIMessageChunk[] = []
    let fullContent = ''
    
    // Stream directly to UI without "thinking" state
    for await (const chunk of stream) {
      this._checkAborted()
      chunks.push(chunk)
      
      // Direct streaming to UI
      if (chunk.content) {
        fullContent += chunk.content
        // Stream chunk to UI
        this.pubsub.publishMessage(PubSub.createMessageWithId(streamMsgId, fullContent, 'assistant'))
      }
    }
    
    // Accumulate final message for history
    const finalMessage = this._accumulateMessage(chunks)
    
    // Final message with complete content
    this.pubsub.publishMessage(PubSub.createMessageWithId(streamMsgId, fullContent, 'assistant'))
    
    // Add to message history
    this.messageManager.addAI(finalMessage.content as string || '')
  }

  /**
   * Accumulate message chunks into a single AIMessage
   */
  private _accumulateMessage(chunks: AIMessageChunk[]): AIMessage {
    const content = chunks
      .map(c => c.content)
      .filter(Boolean)
      .join('')
    
    const toolCalls = chunks
      .flatMap(c => c.tool_calls || [])
      .filter(tc => tc.name) // Filter out incomplete tool calls
    
    return new AIMessage({ 
      content, 
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined 
    })
  }

}
