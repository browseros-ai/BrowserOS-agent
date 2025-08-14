import { ExecutionContext } from '@/lib/runtime/ExecutionContext'
import { MessageManager } from '@/lib/runtime/MessageManager'
import { ToolManager } from '@/lib/tools/ToolManager'
import { createScreenshotTool } from '@/lib/tools/utils/ScreenshotTool'
import { createScrollTool } from '@/lib/tools/navigation/ScrollTool'
import { createRefreshStateTool } from '@/lib/tools/navigation/RefreshStateTool'
import { generateChatSystemPrompt } from './ChatAgent.prompt'
import { AIMessage, AIMessageChunk } from '@langchain/core/messages'
import { PubSub } from '@/lib/pubsub'
import { AbortError } from '@/lib/utils/Abortable'
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
  private static readonly TOOLS = ['screenshot_tool', 'scroll_tool', 'refresh_browser_state_tool']
  private static readonly INCLUDE_LINKS = true
  
  private readonly executionContext: ExecutionContext
  private readonly toolManager: ToolManager

  constructor(executionContext: ExecutionContext) {
    this.executionContext = executionContext
    this.toolManager = new ToolManager(executionContext)
    this._registerTools()
  }

  // Getters for context components
  private get messageManager(): MessageManager {
    return this.executionContext.messageManager
  }

  private get pubsub(): PubSub {
    return this.executionContext.getPubSub()
  }

  /**
   * Register only the minimal tools needed for Q&A
   */
  private _registerTools(): void {
    // Only register the 3 essential tools for Q&A
    this.toolManager.register(createScreenshotTool(this.executionContext))
    this.toolManager.register(createScrollTool(this.executionContext))
    this.toolManager.register(createRefreshStateTool(this.executionContext))
    
    Logging.log('ChatAgent', `Registered ${this.toolManager.getAll().length} tools for Q&A mode`)
  }

  /**
   * Check abort signal and throw if aborted
   */
  private _checkAborted(): void {
    if (this.executionContext.abortController.signal.aborted) {
      throw new AbortError()
    }
  }

  /**
   * Main execution entry point - streamlined for Q&A
   */
  async execute(query: string): Promise<void> {
    try {
      this._checkAborted()
      
      // ChatAgent uses direct streaming without thinking UI
      
      // Extract page context once
      const pageContext = await this._extractPageContext()
      
      // Generate minimal system prompt
      const systemPrompt = generateChatSystemPrompt(pageContext)
      
      // Initialize chat with system prompt and query
      this._initializeChat(systemPrompt, query)
      
      // Stream direct answer without tools
      await this._streamLLM({ tools: false })
      
      Logging.log('ChatAgent', 'Q&A response completed')
      
    } catch (error) {
      if (error instanceof AbortError) {
        Logging.log('ChatAgent', 'Execution aborted by user')
        this.pubsub.publishMessage(PubSub.createMessage('Execution cancelled', 'thinking'))
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logging.log('ChatAgent', `Execution failed: ${errorMessage}`, 'error')
        this.pubsub.publishMessage(PubSub.createMessage(`Error: ${errorMessage}`, 'thinking'))
      }
      throw error
    }
  }

  /**
   * Extract page context from selected tabs
   */
  private async _extractPageContext(): Promise<ExtractedPageContext> {
    // Get selected tab IDs from execution context
    const selectedTabIds = this.executionContext.getSelectedTabIds()
    const hasUserSelectedTabs = Boolean(selectedTabIds && selectedTabIds.length > 0)
    
    // Get browser pages
    const pages = await this.executionContext.browserContext.getPages(
      hasUserSelectedTabs && selectedTabIds ? selectedTabIds : undefined
    )
    
    if (pages.length === 0) {
      throw new Error('No tabs available for context extraction')
    }
    
    // Extract content from each tab
    const tabs = await Promise.all(
      pages.map(async page => {
        const textSnapshot = await page.getTextSnapshot()
        const textSections = (textSnapshot.sections || [])
          .map((section: any) => {
            if (section?.textResult?.text && typeof section.textResult.text === 'string') return section.textResult.text
            if (typeof section.text === 'string') return section.text
            if (typeof section.content === 'string') return section.content
            return ''
          })
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 0)
        const text = textSections.join('\n') || 'No content found'

        let linksBlock = ''
        if (ChatAgent.INCLUDE_LINKS) {
          const linksSnapshot = await page.getLinksSnapshot()
          const linkLines = (linksSnapshot.sections || [])
            .flatMap((section: any) => Array.isArray(section?.linksResult?.links) ? section.linksResult.links : [])
            .map((link: any) => {
              const url = link?.href || link?.url || ''
              const label = typeof link?.text === 'string' ? link.text.trim() : ''
              const parts = [label, url].filter((p: string) => p && p.length > 0)
              return parts.join(' - ')
            })
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
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
   * Initialize chat session with system prompt and user query
   */
  private _initializeChat(systemPrompt: string, query: string): void {
    // Clear any previous messages
    this.messageManager.clear()
    
    // Add system prompt
    this.messageManager.addSystem(systemPrompt)
    
    // Add user query
    this.messageManager.addHuman(query)
    
    Logging.log('ChatAgent', 'Chat session initialized')
  }

  /**
   * Stream LLM response with or without tools
   */
  private async _streamLLM(opts: { tools: boolean }): Promise<void> {
    const llm = await this.executionContext.getLLM({ temperature: 0.3 })
    
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
        this.pubsub.publishMessage(PubSub.createMessageWithId(streamMsgId, fullContent, 'thinking'))
      }
    }
    
    // Accumulate final message for history
    const finalMessage = this._accumulateMessage(chunks)
    
    // Final message with complete content
    this.pubsub.publishMessage(PubSub.createMessageWithId(streamMsgId, fullContent, 'thinking'))
    
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
