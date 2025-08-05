import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { LangChainProvider, getLLM } from './LangChainProvider'
import { z } from 'zod'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

/**
 * Integration tests for LangChainProvider
 * 
 * To run the full integration test with API calls:
 * 1. Set the LITELLM_API_KEY environment variable
 * 2. Run: LITELLM_API_KEY=your-key npm test -- LangChainProvider.integration.test.ts
 */
describe('LangChainProvider Integration Test', () => {
  let provider: LangChainProvider
  
  beforeAll(() => {
    // Get the singleton instance
    provider = LangChainProvider.getInstance()
    provider.clearCache()
  })
  
  afterAll(() => {
    // Clean up
    provider.clearCache()
  })
  
  it('should successfully create Nxtscape LLM instance', async () => {
    // Note: This test validates the LLM instance creation
    // The internal configuration (proxy URL, API key) is handled by LangChain
    
    // Create a direct config for Nxtscape provider
    const config = {
      provider: 'nxtscape' as const,
      model: 'gpt-4o-mini',
      temperature: 0,
      streaming: false,
      apiKey: process.env.LITELLM_API_KEY || 'nokey',
      baseURL: 'http://llm.nxtscape.ai'
    }
    
    // Create LLM instance
    const llm = provider.createLLMFromConfig(config)
    
    // Verify instance is created correctly
    expect(llm).toBeDefined()
    expect(llm.constructor.name).toBe('ChatOpenAI')
    
    // Verify basic configuration that we can access
    const chatModel = llm as any
    expect(chatModel.modelName).toBe('gpt-4o-mini')
    expect(chatModel.temperature).toBe(0)
    expect(chatModel.streaming).toBe(false)
    
    console.log('✓ Nxtscape LLM instance created successfully')
    console.log(`  - Provider: Nxtscape (using LiteLLM proxy)`)
    console.log(`  - Model: ${chatModel.modelName}`)
    console.log(`  - Temperature: ${chatModel.temperature}`)
    console.log(`  - Streaming: ${chatModel.streaming}`)
  })
  
  it.skipIf(!process.env.LITELLM_API_KEY || process.env.LITELLM_API_KEY === 'nokey')(
    'should successfully invoke Nxtscape LLM via LiteLLM proxy (requires LITELLM_API_KEY)',
    async () => {
      // This test only runs if LITELLM_API_KEY is properly configured
      const config = {
        provider: 'nxtscape' as const,
        model: 'gpt-4o-mini',
        temperature: 0,
        streaming: true,
        maxTokens: 50,
        apiKey: process.env.LITELLM_API_KEY || 'nokey',
        baseURL: 'http://llm.nxtscape.ai'
      }
      
      const llm = provider.createLLMFromConfig(config)
      
      // Test with a simple prompt
      const response = await llm.invoke('Say "Hello from Nxtscape!" and nothing else.')
      
      // Verify response
      expect(response).toBeDefined()
      expect(response.content).toBeDefined()
      expect(typeof response.content).toBe('string')
      
      // The response should contain our expected text
      const responseText = response.content.toString().toLowerCase()
      expect(responseText).toContain('hello')
      
      console.log('✓ Integration test successful! Response:', response.content)
    }, 
    30000
  )
  
  it('should test getLLM with withStructuredOutput (mimics tools)', async () => {
    // This test mimics exactly what PlannerTool does
    
    // Step 1: Get LLM using the same method as ExecutionContext
    const llm = await getLLM()
    
    
    // Step 2: Define a simple schema like PlannerTool
    const TestSchema = z.object({
      steps: z.array(z.object({
        action: z.string(),
        reasoning: z.string()
      }))
    })
    
    // Step 3: Check if withStructuredOutput exists
    expect(llm.withStructuredOutput).toBeDefined()
    expect(typeof llm.withStructuredOutput).toBe('function')
    
    // Step 4: Try to create structured LLM
    let structuredLLM
    try {
      structuredLLM = llm.withStructuredOutput(TestSchema)
    } catch (error) {
      console.error('Failed to create structured LLM:', error)
      throw error
    }
    
    // Step 5: Test invoke with simple prompt (only if API key is available)
    if (process.env.LITELLM_API_KEY && process.env.LITELLM_API_KEY !== 'nokey') {
      const systemPrompt = 'You are a helpful assistant that creates action plans.'
      const userPrompt = 'Create a simple 2-step plan to make coffee. Respond with JSON.'
      
      try {
        const result = await structuredLLM.invoke([
          new SystemMessage(systemPrompt),
          new HumanMessage(userPrompt)
        ])
        
        // Verify the response matches our schema
        expect(result).toBeDefined()
        expect(result.steps).toBeDefined()
        expect(Array.isArray(result.steps)).toBe(true)
        expect(result.steps.length).toBeGreaterThan(0)
        
        result.steps.forEach((step: any) => {
          expect(step.action).toBeDefined()
          expect(step.reasoning).toBeDefined()
          expect(typeof step.action).toBe('string')
          expect(typeof step.reasoning).toBe('string')
        })
      } catch (error) {
        console.error('Structured LLM invoke failed:', error)
        throw error
      }
    }
  }, 30000)
  
  it('should test direct withStructuredOutput on created LLM', async () => {
    // Test using createLLMFromConfig directly
    const config = {
      provider: 'nxtscape' as const,
      model: 'gpt-4o-mini',
      temperature: 0,
      streaming: false,
      apiKey: process.env.LITELLM_API_KEY || 'nokey',
      baseURL: 'http://llm.nxtscape.ai'
    }
    
    const llm = provider.createLLMFromConfig(config)
    
    // Simple schema
    const SimpleSchema = z.object({
      message: z.string()
    })
    
    
    // Check method exists
    expect(llm.withStructuredOutput).toBeDefined()
    
    // Try to create structured version
    try {
      const structuredLLM = llm.withStructuredOutput(SimpleSchema)
      
      // Only test actual invoke if we have an API key
      if (process.env.LITELLM_API_KEY && process.env.LITELLM_API_KEY !== 'nokey') {
        const result = await structuredLLM.invoke('Say hello in JSON format with a "message" field.')
        expect(result.message).toBeDefined()
      }
    } catch (error) {
      console.error('withStructuredOutput failed:', error)
      throw error
    }
  }, 30000)

  it('should successfully create LMStudio LLM instance', async () => {
    const config = {
      provider: 'lmstudio' as const,
      model: 'lmstudio-default-model',
      temperature: 0,
      streaming: true,
      apiKey: 'nokey',
      maxTokens: 50,
      baseURL: 'http://localhost:1234/v1'
    };

    const llm = provider.createLLMFromConfig(config);
    expect(llm).toBeDefined();

    const chatModel = llm as any;
    expect(chatModel.modelName).toBe('lmstudio-default-model');
    expect(chatModel.streaming).toBe(true);
    console.log('✓ LMStudio LLM instance created');
  });

  it(
    'should successfully create and invoke OpenRouter LLM',
    async () => {
      const config = {
        provider: 'openrouter' as const,
        model: 'openrouter/horizon-beta',
        temperature: 0.7,
        streaming: true,
        maxTokens: 50,
        apiKey: 'TBD',
        baseURL: 'https://openrouter.ai/api/v1'
      };
      console.log('[DEBUG] OPENROUTER_API_KEY =', 'TBD');

      const llm = provider.createLLMFromConfig(config);
      const response = await llm.invoke('Say "Hello from OpenRouter!"');

      expect(response).toBeDefined();

      // Normalize content
      let content = '';
      if (typeof response.content === 'string') {
        content = response.content;
      } else if (Array.isArray(response.content)) {
        content = response.content
          .map(chunk =>
            'type' in chunk && chunk.type === 'text' && typeof chunk.text === 'string'
              ? chunk.text
              : ''
          )
          .join('');
      } else {
        content = String(response.content);
      }

      expect(content.toLowerCase()).toContain('hello');
      console.log('✓ OpenRouter LLM response:', content);
    },
    30000
  );


})
