import { describe, it, expect } from 'vitest'
import { MessageManager, TRIM_THRESHOLD } from './MessageManager'

describe('MessageManager trimming at threshold', () => {
  it('tests that messages are trimmed at configured threshold not at max capacity', () => {
    const manager = new MessageManager(100)  // Small limit for easier testing
    
    // Add messages until close to threshold
    for (let i = 0; i < 5; i++) {
      manager.addHuman(`msg${i}`)
    }
    
    const tokensBefore = manager.getTokenCount()
    
    // Add a large message that should push us well over threshold
    const largeMsg = 'x'.repeat(100)  // Large enough to definitely trigger trimming
    manager.addHuman(largeMsg)
    
    const tokensAfter = manager.getTokenCount()
    
    // Should have trimmed to stay at or below threshold
    expect(tokensAfter).toBeLessThanOrEqual(100 * TRIM_THRESHOLD)
    
    // Tokens should not exceed the threshold
    expect(tokensAfter).toBeLessThan(tokensBefore + 100)  // Shouldn't just add all tokens
  })

  it('tests that some messages are preserved during trimming', () => {
    const manager = new MessageManager(100)
    
    // Add many messages to fill up space
    for (let i = 0; i < 20; i++) {
      manager.addHuman(`Message ${i}`)
    }
    
    // Force trimming with a large message
    manager.add(manager.getMessages()[0])  // Re-add to trigger trim
    
    // Should still have some messages (not everything deleted)
    const remaining = manager.getMessages().length
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThan(20)
  })

  it('tests that token count stays within threshold after operations', () => {
    const manager = new MessageManager(200)
    
    // Do various operations
    manager.addSystem('System prompt')
    manager.addHuman('User question')
    manager.addAI('AI response')
    manager.addTool('Tool output', 'tool-1')
    
    // Add more messages to trigger trimming
    for (let i = 0; i < 10; i++) {
      manager.addHuman(`Additional message ${i}`)
    }
    
    // Final token count should respect threshold
    const finalTokens = manager.getTokenCount()
    const maxAllowed = manager.getMaxTokens() * TRIM_THRESHOLD
    
    expect(finalTokens).toBeLessThanOrEqual(maxAllowed)
  })
})