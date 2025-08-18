import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore, chatSelectors } from './chatStore'

describe('chatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.getState().reset()
  })

  it('tests that messages can be added via upsert', () => {
    const { upsertMessage } = useChatStore.getState()
    
    upsertMessage({
      msgId: 'test_msg_1',
      role: 'user',
      content: 'Hello world',
      ts: Date.now()
    })
    
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1)
    expect(state.messages[0].content).toBe('Hello world')
    expect(state.messages[0].role).toBe('user')
    expect(state.messages[0].msgId).toBe('test_msg_1')
    expect(state.messages[0].timestamp).toBeInstanceOf(Date)
  })

  it('tests that messages can be updated via upsert', () => {
    const { upsertMessage } = useChatStore.getState()
    
    // Add initial message
    upsertMessage({
      msgId: 'test_msg_2',
      role: 'thinking',
      content: 'Initial content',
      ts: Date.now()
    })
    
    // Update via upsert with same msgId
    upsertMessage({
      msgId: 'test_msg_2',
      role: 'thinking',
      content: 'Updated content',
      ts: Date.now()
    })
    
    const state = useChatStore.getState()
    expect(state.messages).toHaveLength(1) // Should still be 1 message
    expect(state.messages[0].content).toBe('Updated content')
    expect(state.messages[0].msgId).toBe('test_msg_2')
  })

  it('tests that store can be reset', () => {
    const { upsertMessage, setProcessing, setError, reset } = useChatStore.getState()
    
    // Add some state
    upsertMessage({ msgId: 'test_msg_3', role: 'user', content: 'Test', ts: Date.now() })
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
    const { upsertMessage } = useChatStore.getState()
    
    upsertMessage({ msgId: 'test_1', role: 'user', content: 'First', ts: Date.now() })
    upsertMessage({ msgId: 'test_2', role: 'thinking', content: 'Second', ts: Date.now() })
    
    const state = useChatStore.getState()
    
    expect(chatSelectors.hasMessages(state)).toBe(true)
    expect(chatSelectors.getLastMessage(state)?.content).toBe('Second')
    
    const firstMessage = state.messages[0]
    expect(chatSelectors.getMessageByMsgId(state, firstMessage.msgId)).toBe(firstMessage)
  })
})