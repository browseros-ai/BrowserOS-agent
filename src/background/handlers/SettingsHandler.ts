import { PortMessage } from '@/lib/runtime/PortMessaging'
import { MessageType } from '@/lib/types/messaging'
import { Logging } from '@/lib/utils/Logging'

export class SettingsHandler {
  async handleGetPref(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { name } = message.payload as { name: string }

    // Try chrome.browserOS.getPref first (for BrowserOS browser)
    if ((chrome as any)?.browserOS?.getPref) {
      try {
        (chrome as any).browserOS.getPref(name, (pref: any) => {
          if (chrome.runtime.lastError) {
            Logging.log('SettingsHandler', `BrowserOS getPref error for ${name}: ${chrome.runtime.lastError.message}`, 'error')
            port.postMessage({
              type: MessageType.ERROR,
              payload: { error: `Failed to get preference: ${chrome.runtime.lastError.message}` },
              id: message.id
            })
          } else {
            port.postMessage({
              type: MessageType.SETTINGS_GET_PREF_RESPONSE,
              payload: { name, value: pref?.value || null },
              id: message.id
            })
          }
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error getting pref via browserOS ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to get preference: ${error}` },
          id: message.id
        })
      }
    } else {
      // Fallback to chrome.storage.local (for development/other browsers)
      try {
        chrome.storage.local.get(name, (result) => {
          port.postMessage({
            type: MessageType.SETTINGS_GET_PREF_RESPONSE,
            payload: { name, value: result[name] || null },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error getting pref from storage ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to get preference: ${error}` },
          id: message.id
        })
      }
    }
  }

  async handleSetPref(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { name, value } = message.payload as { name: string; value: string }

    // Try chrome.browserOS.setPref first (for BrowserOS browser)
    if ((chrome as any)?.browserOS?.setPref) {
      try {
        (chrome as any).browserOS.setPref(name, value, undefined, (success: boolean) => {
          if (!success) {
            Logging.log('SettingsHandler', `BrowserOS setPref failed for ${name}`, 'error')
          }
          port.postMessage({
            type: MessageType.SETTINGS_SET_PREF_RESPONSE,
            payload: { name, success },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error setting pref via browserOS ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to set preference: ${error}` },
          id: message.id
        })
      }
    } else {
      // Fallback to chrome.storage.local (for development/other browsers)
      try {
        chrome.storage.local.set({ [name]: value }, () => {
          const success = !chrome.runtime.lastError
          if (!success) {
            Logging.log('SettingsHandler', `Storage error for ${name}: ${chrome.runtime.lastError?.message}`, 'error')
          }
          port.postMessage({
            type: MessageType.SETTINGS_SET_PREF_RESPONSE,
            payload: { name, success },
            id: message.id
          })
        })
      } catch (error) {
        Logging.log('SettingsHandler', `Error setting pref in storage ${name}: ${error}`, 'error')
        port.postMessage({
          type: MessageType.ERROR,
          payload: { error: `Failed to set preference: ${error}` },
          id: message.id
        })
      }
    }
  }

  async handleGetAllPrefs(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    // ONLY use chrome.storage.local - we're an extension, not browser settings
    try {
      chrome.storage.local.get(null, (items) => {
        port.postMessage({
          type: MessageType.SETTINGS_GET_ALL_PREFS_RESPONSE,
          payload: { prefs: items },
          id: message.id
        })
      })
    } catch (error) {
      Logging.log('SettingsHandler', `Error getting all prefs from storage: ${error}`, 'error')
      port.postMessage({
        type: MessageType.ERROR,
        payload: { error: `Failed to get all preferences: ${error}` },
        id: message.id
      })
    }
  }

  async handleTestProvider(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { provider } = message.payload as { provider: any }

    try {
      const { ChatOpenAI } = await import('@langchain/openai')
      const { ChatAnthropic } = await import('@langchain/anthropic')
      const { ChatOllama } = await import('@langchain/ollama')
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai')
      const { HumanMessage } = await import('@langchain/core/messages')

      const startTime = performance.now()

      try {
        let llm: any

        switch (provider.type) {
          case 'openai':
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey,
              modelName: provider.modelId || 'gpt-4o-mini',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false
            })
            break

          case 'anthropic':
            llm = new ChatAnthropic({
              anthropicApiKey: provider.apiKey,
              modelName: provider.modelId || 'claude-3-5-sonnet-latest',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false
            })
            break

          case 'google_gemini':
            if (!provider.apiKey) {
              throw new Error('API key required for Google Gemini')
            }
            llm = new ChatGoogleGenerativeAI({
              model: provider.modelId || 'gemini-2.0-flash',
              temperature: 0.7,
              maxOutputTokens: 100,
              apiKey: provider.apiKey,
              convertSystemMessageToHumanContent: true
            })
            break

          case 'ollama':
            // Replace localhost with 127.0.0.1 for better compatibility
            let baseUrl = provider.baseUrl || 'http://localhost:11434'
            if (baseUrl.includes('localhost')) {
              baseUrl = baseUrl.replace('localhost', '127.0.0.1')
            }
            llm = new ChatOllama({
              baseUrl,
              model: provider.modelId || 'qwen3:4b',
              temperature: 0.7,
              numPredict: 100
            })
            break

          case 'openrouter':
            if (!provider.apiKey) {
              throw new Error('API key required for OpenRouter')
            }
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey,
              modelName: provider.modelId || 'auto',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: provider.baseUrl || 'https://openrouter.ai/api/v1'
              }
            })
            break

          case 'openai_compatible':
          case 'custom':
            if (!provider.baseUrl) {
              throw new Error('Base URL required for OpenAI Compatible provider')
            }
            llm = new ChatOpenAI({
              openAIApiKey: provider.apiKey || 'dummy-key',
              modelName: provider.modelId || 'default',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: provider.baseUrl
              }
            })
            break

          case 'browseros':
            llm = new ChatOpenAI({
              openAIApiKey: 'browseros-key',
              modelName: 'default-llm',
              temperature: 0.7,
              maxTokens: 100,
              streaming: false,
              configuration: {
                baseURL: 'https://llm.browseros.com/default/'
              }
            })
            break

          default:
            throw new Error(`Unsupported provider type: ${provider.type}`)
        }

        const testMessage = new HumanMessage('Hello! Please respond with "Hello World" to confirm you are working.')
        const response = await llm.invoke([testMessage])
        const latency = performance.now() - startTime

        port.postMessage({
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: {
            success: true,
            latency,
            response: response.content as string,
            timestamp: new Date().toISOString()
          },
          id: message.id
        })
      } catch (testError) {
        const latency = performance.now() - startTime

        port.postMessage({
          type: MessageType.SETTINGS_TEST_PROVIDER_RESPONSE,
          payload: {
            success: false,
            latency,
            error: testError instanceof Error ? testError.message : 'Unknown error',
            timestamp: new Date().toISOString()
          },
          id: message.id
        })
      }
    } catch (error) {
      Logging.log('SettingsHandler', `Error testing provider: ${error}`, 'error')
      port.postMessage({
        type: MessageType.ERROR,
        payload: { error: `Failed to test provider: ${error}` },
        id: message.id
      })
    }
  }

  async handleBenchmarkProvider(message: PortMessage, port: chrome.runtime.Port): Promise<void> {
    const { provider } = message.payload as { provider: any }

    Logging.log('SettingsHandler', `Starting comprehensive benchmark for ${provider.name} (${provider.type})`)

    try {
      const { ChatOpenAI } = await import('@langchain/openai')
      const { ChatAnthropic } = await import('@langchain/anthropic')
      const { ChatOllama } = await import('@langchain/ollama')
      const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai')
      const { HumanMessage, SystemMessage } = await import('@langchain/core/messages')

      const benchmarkTasks = [
        // Category 1: Instruction Following (25% weight)
        {
          name: 'simple_instruction',
          category: 'instruction_following',
          prompt: 'Click the login button on the page',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['login', 'button', 'click'],
          weight: 0.08
        },
        {
          name: 'multi_step_instruction',
          category: 'instruction_following',
          prompt: 'First navigate to github.com, then click on the Sign In button',
          expectedActions: ['navigate', 'find_element', 'click'],
          expectedKeywords: ['github.com', 'sign in', 'navigate', 'click'],
          weight: 0.10
        },
        {
          name: 'conditional_instruction',
          category: 'instruction_following',
          prompt: 'If you see a cookie banner, click Accept. Otherwise, proceed to click the main search button',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['cookie', 'banner', 'accept', 'search', 'conditional'],
          weight: 0.07
        },

        // Category 2: Context Understanding (20% weight)
        {
          name: 'vague_description',
          category: 'context_understanding',
          prompt: 'Find the article about artificial intelligence and open it',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['article', 'artificial intelligence', 'find', 'open'],
          weight: 0.10
        },
        {
          name: 'element_disambiguation',
          category: 'context_understanding',
          prompt: 'Click on the second "Read More" button in the news section',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['second', 'read more', 'news', 'specific'],
          weight: 0.10
        },

        // Category 3: Tool Selection & Usage (20% weight)
        {
          name: 'tool_selection',
          category: 'tool_usage',
          prompt: 'Search for "machine learning tutorials" on the website',
          expectedActions: ['find_element', 'type_text', 'click'],
          expectedKeywords: ['search', 'type', 'machine learning tutorials'],
          weight: 0.10
        },
        {
          name: 'tool_sequence',
          category: 'tool_usage',
          prompt: 'Fill out the contact form with name "John Doe" and email "john@example.com" then submit',
          expectedActions: ['find_element', 'type_text', 'click'],
          expectedKeywords: ['form', 'fill', 'name', 'email', 'submit'],
          weight: 0.10
        },

        // Category 4: Planning & Reasoning (15% weight)
        {
          name: 'complex_task',
          category: 'planning',
          prompt: 'Go to amazon.com, search for "wireless headphones", filter by 4+ stars, and add the first result to cart',
          expectedActions: ['navigate', 'find_element', 'type_text', 'click'],
          expectedKeywords: ['amazon', 'search', 'filter', '4+ stars', 'add to cart', 'steps'],
          weight: 0.10
        },
        {
          name: 'dependent_steps',
          category: 'planning',
          prompt: 'Login to the account, navigate to settings, and change the notification preferences',
          expectedActions: ['find_element', 'type_text', 'click', 'navigate'],
          expectedKeywords: ['login', 'settings', 'notification', 'preferences', 'sequence'],
          weight: 0.05
        },

        // Category 5: Error Recovery (10% weight)
        {
          name: 'missing_element',
          category: 'error_recovery',
          prompt: 'Click the "Subscribe" button. If it is not found, try finding "Sign up for newsletter" instead',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['subscribe', 'not found', 'alternative', 'sign up', 'newsletter'],
          weight: 0.05
        },
        {
          name: 'error_handling',
          category: 'error_recovery',
          prompt: 'Try to submit the form. If there are validation errors, fix them and retry',
          expectedActions: ['click', 'find_element', 'type_text'],
          expectedKeywords: ['submit', 'validation', 'errors', 'fix', 'retry'],
          weight: 0.05
        },

        // Category 6: Performance (10% weight) - tracked via latency
        {
          name: 'quick_action',
          category: 'performance',
          prompt: 'Click the menu button',
          expectedActions: ['find_element', 'click'],
          expectedKeywords: ['menu', 'button', 'click'],
          weight: 0.10
        }
      ]

      const startTime = performance.now()
      const taskResults: any[] = []
      const systemPrompt = new SystemMessage(
        'You are a browser automation assistant. Analyze the task and provide the exact actions needed.\n' +
        'Available actions: navigate(url), find_element(selector), type_text(text), click(selector), wait(ms).\n' +
        'Respond with a JSON array: [{"action": "navigate", "params": {"url": "..."}}, ...]\n' +
        'Be specific about selectors and think through each step carefully.'
      )

      try {
        const llm = this.createLLMInstance(provider)

        // Test the LLM connection first with a simple test
        try {
          const testMessage = new HumanMessage('Say "test"')
          const testResponse = await llm.invoke([testMessage])
          if (!testResponse) {
            throw new Error('Provider did not respond to test message')
          }
        } catch (testError) {
          const errorMessage = testError instanceof Error ? testError.message : 'Unknown error'

          // Check for specific error types
          if (errorMessage.includes('401') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.toLowerCase().includes('api')) {
            throw new Error('Invalid API key or unauthorized access')
          } else if (errorMessage.includes('404')) {
            throw new Error('Model not found')
          } else if (errorMessage.includes('429')) {
            throw new Error('Rate limit exceeded')
          } else {
            throw new Error(`Provider test failed: ${errorMessage}`)
          }
        }

        // Run benchmark tasks
        for (let i = 0; i < benchmarkTasks.length; i++) {
          const task = benchmarkTasks[i]
          const taskStartTime = performance.now()

          // Send progress update
          try {
            port.postMessage({
              type: MessageType.SETTINGS_BENCHMARK_PROGRESS,
              payload: {
                current: i + 1,
                total: benchmarkTasks.length,
                taskName: task.name,
                category: task.category,
                message: `Running ${task.category} test: ${task.name} (${i + 1}/${benchmarkTasks.length})`
              },
              id: `${message.id}_progress`
            })
          } catch (err) {
            // Port might be disconnected
            Logging.log('SettingsHandler', `Failed to send progress: ${err}`, 'warning')
          }

          try {
            const userPrompt = new HumanMessage(task.prompt)
            const response = await llm.invoke([systemPrompt, userPrompt])
            const taskLatency = performance.now() - taskStartTime

            const content = typeof response.content === 'string' ? response.content : ''
            const { usedTools, parsedActions } = this.extractActions(content)
            const accuracy = this.calculateTaskAccuracy(task, content, usedTools)

            taskResults.push({
              name: task.name,
              category: task.category,
              success: usedTools.length > 0,
              latency: taskLatency,
              accuracy,
              toolsUsed: usedTools,
              parsedActions,
              weight: task.weight
            })
          } catch (taskError) {
            taskResults.push({
              name: task.name,
              category: task.category,
              success: false,
              latency: performance.now() - taskStartTime,
              accuracy: 0,
              error: taskError instanceof Error ? taskError.message : 'Task failed',
              weight: task.weight
            })
          }
        }

        const totalLatency = performance.now() - startTime

        // Check if any tasks actually succeeded
        const successfulTasks = taskResults.filter(task => task.success).length
        const totalTasks = taskResults.length

        // If less than 20% of tasks succeeded, consider it a failure
        if (successfulTasks < totalTasks * 0.2) {
          // Extract the first error message from failed tasks
          const firstError = taskResults.find(task => task.error)?.error || 'Benchmark failed - API key may be invalid or provider is not responding correctly'

          Logging.log('SettingsHandler', `Benchmark failed - Only ${successfulTasks}/${totalTasks} tasks succeeded`, 'error')

          port.postMessage({
            type: MessageType.ERROR,
            payload: {
              error: firstError
            },
            id: message.id
          })
          return
        }

        const scores = this.calculateCategoryScores(taskResults, provider)
        const recommendation = this.getModelRecommendation(provider, scores)

        Logging.log('SettingsHandler', `Benchmark complete - Overall: ${scores.overall}/10, Recommendation: ${recommendation.useCase}`)

        port.postMessage({
          type: MessageType.SETTINGS_BENCHMARK_PROVIDER_RESPONSE,
          payload: {
            success: true,
            latency: totalLatency,
            scores,
            recommendation,
            taskResults,
            timestamp: new Date().toISOString()
          },
          id: message.id
        })
      } catch (benchmarkError) {
        const latency = performance.now() - startTime
        // Don't send any scores when benchmark fails - only send error
        port.postMessage({
          type: MessageType.ERROR,
          payload: {
            error: benchmarkError instanceof Error ? benchmarkError.message : 'Benchmark failed'
          },
          id: message.id
        })
      }
    } catch (error) {
      Logging.log('SettingsHandler', `Error benchmarking provider: ${error}`, 'error')
      port.postMessage({
        type: MessageType.ERROR,
        payload: { error: `Failed to benchmark provider: ${error}` },
        id: message.id
      })
    }
  }

  private createLLMInstance(provider: any): any {
    const { ChatOpenAI } = require('@langchain/openai')
    const { ChatAnthropic } = require('@langchain/anthropic')
    const { ChatOllama } = require('@langchain/ollama')
    const { ChatGoogleGenerativeAI } = require('@langchain/google-genai')

    switch (provider.type) {
      case 'openai':
        return new ChatOpenAI({
          openAIApiKey: provider.apiKey,
          modelName: provider.modelId || 'gpt-4o-mini',
          temperature: 0.2,
          maxTokens: 600,
          streaming: false
        })

      case 'anthropic':
        return new ChatAnthropic({
          anthropicApiKey: provider.apiKey,
          modelName: provider.modelId || 'claude-3-5-sonnet-latest',
          temperature: 0.2,
          maxTokens: 600,
          streaming: false
        })

      case 'google_gemini':
        if (!provider.apiKey) throw new Error('API key required for Google Gemini')
        return new ChatGoogleGenerativeAI({
          model: provider.modelId || 'gemini-2.0-flash',
          temperature: 0.2,
          maxOutputTokens: 600,
          apiKey: provider.apiKey,
          convertSystemMessageToHumanContent: true
        })

      case 'ollama':
        let baseUrl = provider.baseUrl || 'http://localhost:11434'
        if (baseUrl.includes('localhost')) {
          baseUrl = baseUrl.replace('localhost', '127.0.0.1')
        }
        return new ChatOllama({
          baseUrl,
          model: provider.modelId || 'qwen3:4b',
          temperature: 0.2,
          numPredict: 600
        })

      case 'openrouter':
        if (!provider.apiKey) throw new Error('API key required for OpenRouter')
        return new ChatOpenAI({
          openAIApiKey: provider.apiKey,
          modelName: provider.modelId || 'auto',
          temperature: 0.2,
          maxTokens: 600,
          streaming: false,
          configuration: { baseURL: provider.baseUrl || 'https://openrouter.ai/api/v1' }
        })

      case 'openai_compatible':
      case 'custom':
        if (!provider.baseUrl) throw new Error('Base URL required for OpenAI Compatible provider')
        return new ChatOpenAI({
          openAIApiKey: provider.apiKey || 'dummy-key',
          modelName: provider.modelId || 'default',
          temperature: 0.2,
          maxTokens: 600,
          streaming: false,
          configuration: { baseURL: provider.baseUrl }
        })

      case 'browseros':
        return new ChatOpenAI({
          openAIApiKey: 'browseros-key',
          modelName: 'default-llm',
          temperature: 0.2,
          maxTokens: 600,
          streaming: false,
          configuration: { baseURL: 'https://llm.browseros.com/default/' }
        })

      default:
        throw new Error(`Unsupported provider type: ${provider.type}`)
    }
  }

  private extractActions(content: string): { usedTools: string[], parsedActions: any[] } {
    const usedTools: string[] = []
    let parsedActions: any[] = []

    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        parsedActions = JSON.parse(jsonMatch[0])
        usedTools.push(...parsedActions.map((a: any) => a.action || ''))
      }
    } catch (parseError) {
      const lower = content.toLowerCase()
      if (lower.includes('navigate')) usedTools.push('navigate')
      if (lower.includes('find') || lower.includes('locate')) usedTools.push('find_element')
      if (lower.includes('type') || lower.includes('enter') || lower.includes('input')) usedTools.push('type_text')
      if (lower.includes('click')) usedTools.push('click')
      if (lower.includes('wait')) usedTools.push('wait')
    }

    return { usedTools, parsedActions }
  }

  private calculateTaskAccuracy(task: any, content: string, usedTools: string[]): number {
    const lower = content.toLowerCase()
    let score = 0
    let maxScore = 0

    // Check expected actions
    if (task.expectedActions) {
      maxScore += task.expectedActions.length
      const expectedSet = new Set<string>(task.expectedActions)
      const actualSet = new Set(usedTools.map((t: string) => t.split('_')[0]))
      const expectedArray = Array.from(expectedSet)
      score += expectedArray.filter(a => actualSet.has(a) || actualSet.has(`${a}_element`) || actualSet.has(`${a}_text`)).length
    }

    // Check expected keywords
    if (task.expectedKeywords) {
      maxScore += task.expectedKeywords.length
      score += task.expectedKeywords.filter((k: string) => lower.includes(k.toLowerCase())).length
    }

    return maxScore > 0 ? Math.min(score / maxScore, 1) : 0
  }

  private calculateCategoryScores(taskResults: any[], provider: any): any {
    const categories = ['instruction_following', 'context_understanding', 'tool_usage', 'planning', 'error_recovery', 'performance']
    const categoryScores: any = {}

    categories.forEach(category => {
      const tasks = taskResults.filter(r => r.category === category)
      if (tasks.length === 0) {
        categoryScores[category] = 5
        return
      }

      const weightedScore = tasks.reduce((sum, task) => {
        const taskScore = task.success ? task.accuracy * 10 : 0
        return sum + (taskScore * task.weight)
      }, 0)

      const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0)
      categoryScores[category] = Math.max(1, Math.min(10, Math.round(weightedScore / totalWeight)))
    })

    // Performance score based on latency
    const avgLatency = taskResults.reduce((sum, r) => sum + r.latency, 0) / taskResults.length
    categoryScores.performance = this.calculateLatencyScore(avgLatency)

    // Calculate overall score
    const overall = Math.round(
      (categoryScores.instruction_following * 0.25) +
      (categoryScores.context_understanding * 0.20) +
      (categoryScores.tool_usage * 0.20) +
      (categoryScores.planning * 0.15) +
      (categoryScores.error_recovery * 0.10) +
      (categoryScores.performance * 0.10)
    )

    return {
      instructionFollowing: categoryScores.instruction_following,
      contextUnderstanding: categoryScores.context_understanding,
      toolUsage: categoryScores.tool_usage,
      planning: categoryScores.planning,
      errorRecovery: categoryScores.error_recovery,
      performance: categoryScores.performance,
      overall: Math.max(1, Math.min(10, overall))
    }
  }

  private getModelRecommendation(provider: any, scores: any): any {
    const modelId = (provider.modelId || '').toLowerCase()
    const providerType = provider.type

    // Check if suitable for agent tasks (needs high planning, tool usage, error recovery)
    const agentScore = (scores.planning * 0.4) + (scores.toolUsage * 0.35) + (scores.errorRecovery * 0.25)
    const chatScore = (scores.instructionFollowing * 0.4) + (scores.contextUnderstanding * 0.6)
    const quickActionScore = (scores.performance * 0.6) + (scores.instructionFollowing * 0.4)

    const suitability: string[] = []
    let useCase = 'general'
    let description = ''

    // Agent suitability
    if (agentScore >= 7) {
      suitability.push('agent')
      useCase = 'agent'
      description = 'Excellent for complex browser automation and agent workflows'
    } else if (agentScore >= 5) {
      suitability.push('simple_agent')
    }

    // Chat suitability
    if (chatScore >= 7) {
      suitability.push('chat')
      if (useCase === 'general') {
        useCase = 'chat'
        description = 'Best suited for conversational interactions and simple tasks'
      }
    }

    // Quick actions
    if (quickActionScore >= 7) {
      suitability.push('quick_actions')
    }

    // Model-specific recommendations
    if (providerType === 'ollama') {
      if (modelId.includes('qwen') && modelId.includes('7b')) {
        description = 'Good for agent tasks with solid planning. Recommended for local automation.'
      } else if (modelId.includes('phi')) {
        description = 'Strong reasoning capabilities. Excellent for complex planning tasks.'
      } else if (modelId.includes('llama') && (modelId.includes('1b') || modelId.includes('3b'))) {
        description = 'Fast and lightweight. Best for simple chat and quick actions, not recommended for complex agents.'
      }
    } else if (providerType === 'openai') {
      if (modelId.includes('gpt-4')) {
        description = 'Premium model with excellent agent capabilities and reasoning.'
      } else if (modelId.includes('gpt-3.5')) {
        description = 'Fast and cost-effective for chat. Limited for complex agent workflows.'
      }
    } else if (providerType === 'anthropic') {
      if (modelId.includes('sonnet')) {
        description = 'Superior planning and reasoning. Highly recommended for agent tasks.'
      } else if (modelId.includes('haiku')) {
        description = 'Fast responses with good accuracy. Suitable for simple automation.'
      }
    }

    if (!description) {
      if (scores.overall >= 8) {
        description = 'High-performing model suitable for most tasks'
      } else if (scores.overall >= 6) {
        description = 'Capable model for general-purpose use'
      } else {
        description = 'Consider using for simple tasks only'
      }
    }

    return {
      useCase,
      description,
      suitability,
      agentScore: Math.round(agentScore),
      chatScore: Math.round(chatScore)
    }
  }

  private calculateLatencyScore(latency: number): number {
    if (latency < 500) return 10
    if (latency < 800) return 9
    if (latency < 1200) return 8
    if (latency < 1800) return 7
    if (latency < 2500) return 6
    if (latency < 3500) return 5
    if (latency < 5000) return 4
    if (latency < 7000) return 3
    if (latency < 10000) return 2
    return 1
  }

}