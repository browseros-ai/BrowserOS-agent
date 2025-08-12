import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LangChainProvider } from './LangChainProvider'
import { LLMSettingsReader } from '@/lib/llm/settings/LLMSettingsReader'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'

// Mock the dependencies
vi.mock('@/lib/llm/settings/LLMSettingsReader')
vi.mock('@langchain/openai')
vi.mock('@langchain/anthropic')

describe('LangChainProvider', () => {
  let provider: LangChainProvider

  beforeEach(() => {
    // Clear cache before each test
    provider = LangChainProvider.getInstance()
    provider.clearCache()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getLLM', () => {
    it('tests that LLM provider creates and caches OpenAI model based on settings', async () => {
      // Mock settings
      const mockSettings = {
        defaultProvider: 'openai',
        openai: {
          model: 'gpt-4',
          apiKey: 'test-key'
        }
      }
      vi.mocked(LLMSettingsReader.read).mockResolvedValue(mockSettings as any)

      // First call - should create new instance
      const llm1 = await provider.getLLM()
      
      // Verify OpenAI was instantiated with correct config
      expect(ChatOpenAI).toHaveBeenCalledWith({
        modelName: 'gpt-4',
        temperature: 0.7,
        streaming: true,
        maxTokens: undefined,
        openAIApiKey: 'test-key',
        configuration: {
          dangerouslyAllowBrowser: true
        }
      })

      // Second call - should return cached instance
      const llm2 = await provider.getLLM()
      
      // Should be the same instance (cached)
      expect(llm1).toBe(llm2)
      
      // ChatOpenAI should only be called once due to caching
      expect(ChatOpenAI).toHaveBeenCalledTimes(1)
    })

    it('tests that LLM provider creates different instances for different temperatures', async () => {
      // Mock settings
      const mockSettings = {
        defaultProvider: 'anthropic',
        anthropic: {
          model: 'claude-3-opus-20240229',
          apiKey: 'test-anthropic-key'
        }
      }
      vi.mocked(LLMSettingsReader.read).mockResolvedValue(mockSettings as any)

      // Create with default temperature
      const llm1 = await provider.getLLM()
      
      // Create with different temperature
      const llm2 = await provider.getLLM({ temperature: 0.5 })
      
      // Should create two different instances
      expect(ChatAnthropic).toHaveBeenCalledTimes(2)
      
      // First call with default temperature
      expect(ChatAnthropic).toHaveBeenNthCalledWith(1, {
        modelName: 'claude-3-opus-20240229',
        temperature: 0.7,
        streaming: true,
        anthropicApiKey: 'test-anthropic-key',
        anthropicApiUrl: undefined
      })
      
      // Second call with custom temperature
      expect(ChatAnthropic).toHaveBeenNthCalledWith(2, {
        modelName: 'claude-3-opus-20240229',
        temperature: 0.5,
        streaming: true,
        anthropicApiKey: 'test-anthropic-key',
        anthropicApiUrl: undefined
      })
    })
  })
})