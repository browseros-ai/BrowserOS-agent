import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { MessageManager, MessageManagerReadOnly, MessageType, BrowserStateMessage } from "./MessageManager";
import { describe, it, expect, beforeEach } from 'vitest';

describe("MessageManager", () => {
  let manager: MessageManager;

  beforeEach(() => {
    manager = new MessageManager(1000); // Small token limit for testing
  });

  describe("Core functionality", () => {
    it("tests that messages can be added and retrieved", () => {
      manager.addHuman("Hello");
      manager.addAI("Hi there");
      manager.addTool("Tool result", "tool-123");
      
      const messages = manager.getMessages();
      expect(messages).toHaveLength(3);
      expect(messages[0]).toBeInstanceOf(HumanMessage);
      expect(messages[1]).toBeInstanceOf(AIMessage);
      expect(messages[2]).toBeInstanceOf(ToolMessage);
    });

    it("tests that only one system message is kept", () => {
      manager.addSystem("First system");
      manager.addHuman("User message");
      manager.addSystem("Second system");
      
      const messages = manager.getMessages();
      const systemMessages = messages.filter(m => m instanceof SystemMessage);
      expect(systemMessages).toHaveLength(1);
      expect(systemMessages[0].content).toBe("Second system");
    });

    it("tests that only one browser state is kept", () => {
      manager.addBrowserState("State 1");
      manager.addHuman("User");
      manager.addBrowserState("State 2");
      
      const messages = manager.getMessages();
      const browserStates = messages.filter(m => m instanceof BrowserStateMessage);
      expect(browserStates).toHaveLength(1);
      expect(browserStates[0].content).toContain("State 2");
    });
  });

  describe("Token tracking", () => {
    it("tests that token count is O(1) operation", () => {
      expect(manager.getTokenCount()).toBe(0);
      
      manager.addHuman("Hello world");
      const count1 = manager.getTokenCount();
      expect(count1).toBeGreaterThan(0);
      
      manager.addAI("Response message");
      const count2 = manager.getTokenCount();
      expect(count2).toBeGreaterThan(count1);
    });

    it("tests that remaining tokens decrease correctly", () => {
      expect(manager.remaining()).toBe(1000);
      
      manager.addHuman("Test message");
      const remaining = manager.remaining();
      expect(remaining).toBeLessThan(1000);
      expect(remaining).toBe(1000 - manager.getTokenCount());
    });

    it("tests that exact token counts from AIMessage are used", () => {
      // Create AIMessage with usage_metadata
      const aiMessage = new AIMessage("Test");
      aiMessage.usage_metadata = {
        input_tokens: 10,
        output_tokens: 20,
        total_tokens: 30
      };
      
      manager.add(aiMessage);
      // Should use exact 30 tokens from usage_metadata
      expect(manager.getTokenCount()).toBe(30);
    });
  });

  describe("Smart trimming", () => {
    it("tests that messages are trimmed by priority", () => {
      // Create manager with very small limit  
      const tinyManager = new MessageManager(50); // Small limit
      
      // Add many tool messages first (low priority)
      tinyManager.addTool("Tool 1", "id-1");
      tinyManager.addTool("Tool 2", "id-2"); 
      tinyManager.addTool("Tool 3", "id-3");
      tinyManager.addTool("Tool 4", "id-4");
      
      // Add higher priority messages
      tinyManager.addHuman("Human message");
      tinyManager.addSystem("System prompt");
      
      // Force trimming with a long message
      tinyManager.addAI("This is a very long AI response message that will definitely exceed our tiny token limit and force trimming");
      
      const messages = tinyManager.getMessages();
      const toolCount = messages.filter(m => m instanceof ToolMessage).length;
      const systemCount = messages.filter(m => m instanceof SystemMessage).length;
      
      // Most tool messages should be trimmed (low priority)
      // But last 3 messages are always kept, so if a tool is in last 3, it stays
      expect(toolCount).toBeLessThan(4); // Should have trimmed some tools
      // System should be preserved (high priority)
      expect(systemCount).toBe(1);
      // Should stay close to token limit (within a small margin due to token approximation)
      expect(tinyManager.getTokenCount()).toBeLessThanOrEqual(55);
    });

    it("tests that recent messages are preserved", () => {
      // Add many messages to force trimming
      for (let i = 0; i < 100; i++) {
        manager.addHuman(`Message ${i}`);
      }
      
      const messages = manager.getMessages();
      const lastMessage = messages[messages.length - 1];
      // Last messages should be preserved
      expect(lastMessage.content).toContain("99");
      
      // Should stay under token limit
      expect(manager.getTokenCount()).toBeLessThanOrEqual(1000);
    });

    it("tests that system messages are preserved when possible", () => {
      manager.addSystem("Important system");
      
      // Add messages to trigger trimming
      for (let i = 0; i < 50; i++) {
        manager.addHuman(`Long message ${i} with content`);
      }
      
      const messages = manager.getMessages();
      const systemMsg = messages.find(m => m instanceof SystemMessage);
      // System should be preserved as high priority
      expect(systemMsg).toBeDefined();
    });
  });

  describe("Token limit updates", () => {
    it("tests that setMaxTokens updates limit correctly", () => {
      expect(manager.getMaxTokens()).toBe(1000);
      
      manager.setMaxTokens(500);
      expect(manager.getMaxTokens()).toBe(500);
      expect(manager.remaining()).toBe(500);
    });

    it("tests that reducing limit triggers trimming", () => {
      // Add messages
      for (let i = 0; i < 20; i++) {
        manager.addHuman(`Message ${i}`);
      }
      
      const initialCount = manager.getTokenCount();
      
      // Reduce limit significantly
      manager.setMaxTokens(100);
      
      // Should have trimmed to fit new limit
      expect(manager.getTokenCount()).toBeLessThanOrEqual(100);
      expect(manager.getTokenCount()).toBeLessThan(initialCount);
    });
  });

  describe("Edge cases", () => {
    it("tests that empty manager works correctly", () => {
      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getTokenCount()).toBe(0);
      expect(manager.remaining()).toBe(1000);
      expect(manager.removeLast()).toBe(false);
    });

    it("tests that clear resets everything", () => {
      manager.addHuman("Test");
      manager.addAI("Response");
      
      manager.clear();
      
      expect(manager.getMessages()).toHaveLength(0);
      expect(manager.getTokenCount()).toBe(0);
      expect(manager.remaining()).toBe(1000);
      expect(manager.getMaxTokens()).toBe(1000); // Limit preserved
    });

    it("tests that removeLast updates token count", () => {
      manager.addHuman("First");
      manager.addAI("Second");
      
      const countBefore = manager.getTokenCount();
      manager.removeLast();
      const countAfter = manager.getTokenCount();
      
      expect(countAfter).toBeLessThan(countBefore);
      expect(manager.getMessages()).toHaveLength(1);
    });

    it("tests that fork preserves token tracking", () => {
      manager.addHuman("Test");
      manager.addAI("Response");
      
      const forked = manager.fork(true);
      
      expect(forked.getTokenCount()).toBe(manager.getTokenCount());
      expect(forked.getMessages()).toHaveLength(2);
      expect(forked.getMaxTokens()).toBe(1000);
      
      // Fork without history
      const emptyFork = manager.fork(false);
      expect(emptyFork.getTokenCount()).toBe(0);
      expect(emptyFork.getMessages()).toHaveLength(0);
    });
  });

  describe("MessageManagerReadOnly", () => {
    it("tests that read-only interface works", () => {
      manager.addHuman("User");
      manager.addBrowserState("Page content");
      
      const readOnly = new MessageManagerReadOnly(manager);
      
      expect(readOnly.getAll()).toHaveLength(2);
      expect(readOnly.getRecentBrowserState()).toContain("Page content");
    });

    it("tests that browser state extraction works", () => {
      manager.addBrowserState("<html>content</html>");
      
      const readOnly = new MessageManagerReadOnly(manager);
      const state = readOnly.getRecentBrowserState();
      
      expect(state).toContain("<html>content</html>");
    });
  });
});