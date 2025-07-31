import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, chatSelectors } from './chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.getState().reset()
  })

  it('tests that messages can be added', () => {
    const { addMessage } = useChatStore.getState()
    
    addMessage({
      role: 'user',
      content: 'Hello world'
    })
    
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].content).toBe('Hello world')
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].id).toBeDefined()
    expect(state.messages[0].timestamp).toBeInstanceOf(Date)
  })

  it('tests that messages can be updated', () => {
    const { addMessage, updateMessage } = useChatStore.getState()
    
    addMessage({
      role: 'assistant',
      content: 'Initial content'
    })
    
    const messageId = useChatStore.getState().messages[0].id
    updateMessage(messageId, 'Updated content')
    
    const state = useChatStore.getState()
    expect(state.messages[0].content).toBe('Updated content')
  })

  it('tests that store can be reset', () => {
    const { addMessage, setProcessing, setError, reset } = useChatStore.getState()
    
    // Add some state
    addMessage({ role: 'user', content: 'Test' })
    setProcessing(true)
    setError('Test error')
    
    // Reset
    reset()
    
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(0)
    expect(state.isProcessing).toBe(false)
    expect(state.error).toBeNull()
  })

  it('tests that selectors work correctly', () => {
    const { addMessage } = useChatStore.getState()
    
    addMessage({ role: 'user', content: 'First' })
    addMessage({ role: 'assistant', content: 'Second' })
    
    const state = useChatStore.getState()
    
    expect(chatSelectors.hasMessages(state)).toBe(true)
    expect(chatSelectors.getLastMessage(state)?.content).toBe('Second')
    
    const firstMessage = state.messages[0]
    expect(chatSelectors.getMessageById(state, firstMessage.id)).toBe(firstMessage)
  })
})