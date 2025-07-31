# Sidepanel V2 Design Document

## 1. What Are We Trying to Do?

The Sidepanel V2 project aims to completely redesign and reimplement the Nxtscape browser extension's side panel interface. Our objectives are:

### Primary Goals
1. **Simplify the Architecture**: Reduce the codebase by ~60% while maintaining all essential functionality
2. **Improve Maintainability**: Create clear separation of concerns with focused, single-responsibility components
3. **Enhance Performance**: Eliminate unnecessary re-renders and complex state management
4. **Streamline User Experience**: Focus on core chat functionality without feature bloat

### Key Deliverables
- A new, clean implementation living alongside the existing code (no destructive changes)
- Unified state management replacing scattered state across multiple stores and components
- Modular component architecture that's easy to understand and extend
- Progressive migration path using feature flags

### Success Criteria
- Code reduction from ~3,500 lines to ~1,400 lines
- Component files under 400 lines each
- Single source of truth for all state
- Sub-100ms message rendering performance
- Zero regression in core functionality

## 2. Why Are We Doing This?

The current sidepanel implementation has grown organically over time, resulting in significant technical debt that impacts development velocity and code quality. Here are the key pain points:

### Component Complexity
- **SidePanelPage.tsx**: 780 lines mixing message routing, state management, and UI logic
- **SidePanel.tsx**: 955 lines handling everything from input to rendering to modal management
- Combined, these two files contain over 1,700 lines of intertwined logic

### State Management Issues
1. **Scattered State**: State is distributed across:
   - Local component state in SidePanelPage
   - Props drilling through multiple levels
   - Two separate Zustand stores (appStore, tabsStore)
   // NTN -- it is fine to have multiple Zustand stores if there is a reason and if each are doing different things.
   - Ref-based state for performance hacks
   
2. **Redundant State Tracking**: 
   - `isProcessing` tracked in 3 different places
   - Message state duplicated between component and store
   - Tab selection state split between store and local state

### Message Handling Complexity
The current message handling in SidePanelPage spans 360+ lines with:
- Complex buffering logic for streaming messages
- 11 different message types with inconsistent handling
- Debouncing and throttling logic mixed with business logic
- Manual DOM manipulation for scrolling

### Performance Issues
- Unnecessary re-renders due to poor state organization
- Complex streaming logic causing UI jank
- Large component trees re-rendering on every message

### Maintenance Challenges
- **Cognitive Load**: New developers need to understand 3,500+ lines to make changes
- **Testing Difficulty**: Components are too large and coupled to test effectively
- **Feature Additions**: Adding new features requires touching multiple files
- **Bug Fixing**: Side effects and dependencies make bugs hard to track down

### Unused Code
- Components never used: TabCard, AgentStreamDisplay, useSidePanelState
- Features with minimal value: Intent predictions, debug panel
- Over-engineered UI components for simple HTML elements

## 3. Current Structure and File Analysis

### 3.1 File Structure Overview

```
src/sidepanel/                      (Total: 3,565 lines)
├── index.tsx                       (14 lines)
├── pages/
│   └── SidePanelPage.tsx          (780 lines) ⚠️
├── components/
│   ├── index.ts                   (39 lines)
│   ├── SidePanel.tsx              (955 lines) ⚠️
│   ├── StreamingMessageDisplay.tsx (233 lines)
│   ├── TabSelector.tsx            (246 lines) ✅
│   ├── MarkdownContent.tsx        (134 lines) ✅
│   ├── HelpSection.tsx            (253 lines)
│   ├── IntentBubbles.tsx          (67 lines)
│   ├── AgentStreamDisplay.tsx     (94 lines) ❌ unused
│   ├── TabCard.tsx                (85 lines) ❌ unused
│   └── ui/
│       ├── button.tsx             (54 lines)
│       ├── card.tsx               (77 lines)
│       ├── badge.tsx              (40 lines)
│       ├── input.tsx              (23 lines)
│       ├── textarea.tsx           (22 lines)
│       └── separator.tsx          (29 lines)
├── hooks/
│   ├── index.ts                   (5 lines)
│   ├── useSidePanelPortMessaging.ts (76 lines) ✅
│   └── useSidePanelState.ts      (112 lines) ❌ unused
├── store/
│   ├── appStore.ts                (58 lines)
│   └── tabsStore.ts               (164 lines)
├── lib/
│   └── utils.ts                   (5 lines)
└── styles/                        (SCSS modules)
```

Legend: ⚠️ = problematic, ✅ = clean/reusable, ❌ = unused

### 3.2 File Responsibilities and Issues

#### Core Components

**index.tsx** (Entry Point)
- Simple React root render
- No issues, minimal code

**SidePanelPage.tsx** ⚠️ (Main Orchestrator)
- **Responsibilities**: Message routing, state management, port communication, UI orchestration
- **Major Issues**:
  - Handles 11 different message types in a 360+ line useEffect
  - Complex chunk buffering logic for streaming (90+ lines)
  - Mixes business logic with UI concerns
  - Direct DOM manipulation for scrolling
  - State management scattered across local state, refs, and props

**SidePanel.tsx** ⚠️ (UI Component)
- **Responsibilities**: Entire UI rendering, input handling, tab selection, help modal
- **Major Issues**:
  - 955 lines doing everything from keyboard shortcuts to LLM settings debug
  - Mixed concerns: UI, state, business logic, debugging
  - Complex conditional rendering throughout
  - Inline styles mixed with CSS modules
  - Feature flags and debug code in production component

#### Message & Display Components

**StreamingMessageDisplay.tsx** (Message Renderer)
- **Responsibilities**: Render different message types with streaming support
- **Issues**: Complex type handling, hacky error filtering, streaming state management

**MarkdownContent.tsx** ✅ (Markdown Renderer)
- **Responsibilities**: Clean markdown rendering with custom styling
- **No major issues**: Well-focused, reusable component

**TabSelector.tsx** ✅ (Tab Selection UI)
- **Responsibilities**: Display and select browser tabs with keyboard navigation
- **Minor issues**: Some complexity but generally well-implemented

**HelpSection.tsx** (Help Modal)
- **Responsibilities**: Display help content and examples
- **Issues**: 253 lines for a static modal, should be external documentation

#### Unused Components ❌

**AgentStreamDisplay.tsx** - Never imported, duplicates StreamingMessageDisplay functionality
**TabCard.tsx** - Never used, overlaps with TabSelector
**useSidePanelState.ts** - Implements different state model, never used

#### State Management

// NTN -- it is fine to have two stores. but clean up the logic.

**appStore.ts** (Global App State)
- **Responsibilities**: Task input, logs, execution state
- **Issues**: Minimal usage, execution state duplicated elsewhere

**tabsStore.ts** (Tab Management)
- **Responsibilities**: Browser tab state, selection, intent predictions
- **Issues**: Intent prediction feature adds complexity for minimal value

#### Utility Components

**UI Components** (button, card, badge, etc.)
- **Issues**: Over-engineered with class-variance-authority for simple HTML elements
- Could be replaced with native HTML + CSS

**useSidePanelPortMessaging.ts** ✅
- **Responsibilities**: Chrome extension port communication
- **No issues**: Clean, focused hook

### 3.3 Current Message Flow and State Management

#### Message Flow Architecture

// NTN -- earlier for different message types like systemmessage, toolstart, I woul dcreate a separate message card for showing it. NOW I WANT TO SHOW IT AS A SINGLE FLAT layer. So these message types can initially start out to have same UI thing. like for all types of messages except error, we just show same UI, like have switch case but UI is shared.
```
Background Script
    ↓ (Port Messages)
SidePanelPage (useSidePanelPortMessaging)
    ↓ (handleStreamUpdate - 360+ lines)
    ├─→ SystemMessage
    ├─→ NewSegment
    ├─→ StreamingChunk (buffered)
    ├─→ FinalizeSegment
    ├─→ ToolStart/Stream/End/Result
    ├─→ ErrorMessage
    ├─→ DebugMessage
    ├─→ CancelMessage
    ├─→ TaskResult
    └─→ ThinkingMessage
         ↓
    pageState (local state)
         ↓
    SidePanel (props)
         ↓
    StreamingMessageDisplay
```

#### State Management Chaos

**1. Message State**
- `pageState.messages` in SidePanelPage (local state)
- `chunkBufferRef` for streaming optimization (ref)
- `messageIdCounter` for ID generation (ref)
- No persistence, no single source of truth

**2. Processing State**
- `pageState.isProcessing` (local state in SidePanelPage)
- `isProcessing` prop passed to SidePanel
- `state.isProcessing` (local state in SidePanel)
- `hasActiveTask` computed from multiple sources
- `isExecuting` in appStore (rarely used)

**3. Tab State**
- `tabsStore` for tab management
- `selectedTabs` in tabsStore
- `state.selectedTabs` in SidePanel (local copy)
- Intent predictions in tabsStore (complex, rarely used)

**4. UI State**
- `showHelp`, `showTabSelector` in SidePanel local state
- `isUserScrolling` for auto-scroll behavior
- `examples` array regenerated on reset
- Debug panel state inline

#### Message Type Handling

The system handles 11 different message types with inconsistent patterns:
1. **SystemMessage** - Direct addition to messages
2. **NewSegment** - Creates streaming message
3. **StreamingChunk** - Complex buffering with debouncing
4. **FinalizeSegment** - Converts streaming to final
5. **Tool messages** - Multiple states (start/stream/end/result)
6. **Error/Debug/Cancel** - Special formatting
7. **ThinkingMessage** - Replaces previous thinking messages

Each type has its own logic path, making the code hard to follow and maintain.

## 4. New Structure Proposal

### 4.1 Directory Structure

```
src/sidepanel/
├── index.tsx                    # Existing entry with feature flag
├── v2/                          # New implementation (side-by-side)
│   ├── App.tsx                  # Clean root component (~50 lines)
│   ├── stores/ # NTN -- LETS DO IT as you say, let's just have one store that is chatStore 
│   │   └── chatStore.ts         # Unified state management (~150 lines)
│   ├── hooks/
│   │   ├── useMessageHandler.ts # Message processing logic (~200 lines)
│   │   ├── useAutoScroll.ts     # Scroll behavior (~50 lines)
│   │   └── useKeyboardShortcuts.ts # Keyboard handling (~80 lines)
│   ├── components/
│   │   ├── Chat.tsx             # Main chat container (~100 lines)
│   │   ├── Header.tsx           # Simple header (~80 lines)
│   │   ├── MessageList.tsx      # Message renderer (~150 lines)
│   │   ├── MessageItem.tsx      # Individual message (~100 lines)
│   │   ├── ChatInput.tsx        # Input with tab selector (~150 lines)
│   │   └── shared/
│   │       ├── TabSelector.tsx  # Copy from existing (clean)
│   │       └── Markdown.tsx     # Copy from existing (clean)
│   └── styles/
│       ├── variables.css        # CSS custom properties
│       ├── global.css           # Base styles
│       └── components/          # Component styles
│           ├── Chat.module.css
│           ├── Header.module.css
│           ├── MessageList.module.css
│           └── ChatInput.module.css
├── pages/                       # Existing (unchanged)
├── components/                  # Existing (unchanged)
├── hooks/                       # Existing (unchanged)
└── store/                       # Existing (unchanged)
```

**Total estimated lines**: ~1,400 (60% reduction)

### 4.2 Architectural Principles

#### 1. Single Responsibility
Each component/hook has ONE clear purpose:
- `App.tsx` - Orchestration only
- `useMessageHandler` - Message processing only
- `MessageList` - Rendering only
- `ChatInput` - Input handling only

#### 2. Unidirectional Data Flow
```
Port Messages → useMessageHandler → chatStore → Components
                                         ↑
User Actions ────────────────────────────┘
```

#### 3. State Centralization
All state lives in `chatStore`:
- Messages array
- Processing status
- Selected tabs
- UI flags (no local state for shared data)

#### 4. Composition Over Configuration
- Small, focused components
- Compose behavior through hooks
- No mega-components with 20+ props

#### 5. Performance First
- No unnecessary re-renders
- Simple message structure (no complex streaming state)
- Efficient scrolling without refs
- Minimal dependencies

#### 6. Progressive Enhancement
- Core chat works first
- Add features only when proven valuable
- Feature flags for gradual rollout
- Keep old code running in parallel

#### 7. Type Safety
- Zod schemas for all data structures
- No `any` types
- Strict TypeScript configuration
- Runtime validation at boundaries

#### 8. Testability
- Pure functions for business logic
- Hooks return testable values
- Components are presentation-focused
- No side effects in render

## 5. High-Level Design with Pseudo Code

### 5.1 Unified Chat Store

```typescript
// src/sidepanel/v2/stores/chatStore.ts

import { create } from 'zustand'
import { z } from 'zod'

// Simple message schema - no complex streaming states
const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
  timestamp: z.date(),
  metadata: z.object({
    toolName: z.string().optional(),
    error: z.boolean().optional()
  }).optional()
})

type Message = z.infer<typeof MessageSchema>

// Store state schema
const ChatStateSchema = z.object({
  messages: z.array(MessageSchema),
  isProcessing: z.boolean(),
  selectedTabIds: z.array(z.number()),
  error: z.string().nullable()
})

type ChatState = z.infer<typeof ChatStateSchema>

// Store actions
interface ChatActions {
  // Message management
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  updateMessage: (id: string, content: string) => void
  clearMessages: () => void
  
  // Processing state
  setProcessing: (processing: boolean) => void
  
  // Tab management
  setSelectedTabs: (tabIds: number[]) => void
  clearSelectedTabs: () => void
  
  // Error handling
  setError: (error: string | null) => void
  
  // Bulk operations
  reset: () => void
}

// Create store
export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  // Initial state
  messages: [],
  isProcessing: false,
  selectedTabIds: [],
  error: null,
  
  // Actions
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: `msg-${Date.now()}-${Math.random()}`,
      timestamp: new Date()
    }
    
    set(state => ({
      messages: [...state.messages, newMessage],
      error: null // Clear errors on new message
    }))
  },
  
  updateMessage: (id, content) => {
    set(state => ({
      messages: state.messages.map(msg =>
        msg.id === id ? { ...msg, content } : msg
      )
    }))
  },
  
  clearMessages: () => set({ messages: [] }),
  
  setProcessing: (processing) => set({ isProcessing: processing }),
  
  setSelectedTabs: (tabIds) => set({ selectedTabIds: tabIds }),
  clearSelectedTabs: () => set({ selectedTabIds: [] }),
  
  setError: (error) => set({ error }),
  
  reset: () => set({
    messages: [],
    isProcessing: false,
    selectedTabIds: [],
    error: null
  })
}))

// Selectors for common queries
export const chatSelectors = {
  getLastMessage: (state: ChatState) => 
    state.messages[state.messages.length - 1],
    
  hasMessages: (state: ChatState) => 
    state.messages.length > 0,
    
  getSelectedTabCount: (state: ChatState) => 
    state.selectedTabIds.length
}
```

### 5.2 Message Handler Hook

```typescript
// src/sidepanel/v2/hooks/useMessageHandler.ts

import { useEffect, useRef } from 'react'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'
import { useChatStore } from '../stores/chatStore'

export function useMessageHandler() {
  const { addMessage, updateMessage, setProcessing } = useChatStore()
  const { addMessageListener, removeMessageListener } = useSidePanelPortMessaging()
  
  // Track streaming messages
  const streamingMessages = useRef<Map<string, string>>(new Map())
  
  useEffect(() => {
    const handleStreamUpdate = (payload: any) => {
      const { details } = payload
      
      // Simplified message handling - no complex buffering
      switch (details?.messageType) {
        case 'SystemMessage':
          if (details.content) {
            addMessage({
              role: 'system',
              content: details.content
            })
          }
          break
          
        case 'NewSegment':
          // Start a new assistant message
          const messageId = details.messageId || `stream-${Date.now()}`
          streamingMessages.current.set(messageId, '')
          addMessage({
            role: 'assistant',
            content: '...' // Placeholder while streaming
          })
          break
          
        case 'StreamingChunk':
          // Append to existing message
          if (details.messageId) {
            const current = streamingMessages.current.get(details.messageId) || ''
            const updated = current + details.content
            streamingMessages.current.set(details.messageId, updated)
            
            // Update the last assistant message
            updateMessage(details.messageId, updated)
          }
          break
          
        case 'FinalizeSegment':
          // Finalize the message
          if (details.messageId) {
            const finalContent = details.content || 
              streamingMessages.current.get(details.messageId) || ''
            
            updateMessage(details.messageId, finalContent)
            streamingMessages.current.delete(details.messageId)
          }
          break
          
        case 'ToolResult':
          // Add tool result as a separate message
          addMessage({
            role: 'assistant',
            content: details.content || 'Tool executed',
            metadata: { toolName: details.toolName }
          })
          break
          
        case 'ErrorMessage':
          // Add error message
          addMessage({
            role: 'system',
            content: details.error || 'An error occurred',
            metadata: { error: true }
          })
          setProcessing(false)
          break
          
        case 'TaskResult':
          // Task completed
          setProcessing(false)
          if (details.content) {
            addMessage({
              role: 'system',
              content: details.content
            })
          }
          break
      }
    }
    
    // Listen for workflow status
    const handleWorkflowStatus = (payload: any) => {
      if (payload.status === 'completed' || payload.status === 'failed') {
        setProcessing(false)
      }
    }
    
    // Register listeners
    addMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
    addMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
    
    // Cleanup
    return () => {
      removeMessageListener(MessageType.AGENT_STREAM_UPDATE, handleStreamUpdate)
      removeMessageListener(MessageType.WORKFLOW_STATUS, handleWorkflowStatus)
      streamingMessages.current.clear()
    }
  }, [addMessage, updateMessage, setProcessing, addMessageListener, removeMessageListener])
}

// Additional hooks for other functionality

// src/sidepanel/v2/hooks/useAutoScroll.ts
export function useAutoScroll(ref: React.RefObject<HTMLDivElement>, dependencies: any[]) {
  useEffect(() => {
    if (ref.current) {
      const element = ref.current
      // Smooth scroll to bottom
      element.scrollTo({
        top: element.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, dependencies)
}

// src/sidepanel/v2/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(handlers: {
  onSubmit?: () => void
  onCancel?: () => void
  onNewline?: () => void
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to submit (without shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handlers.onSubmit?.()
      }
      
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        handlers.onCancel?.()
      }
      
      // Shift+Enter for newline (handled naturally by textarea)
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
```

### 5.3 Component Hierarchy and Interfaces

```typescript
// src/sidepanel/v2/app.tsx
import react from 'react'
import { chat } from './components/chat'
import { usemessagehandler } from './hooks/usemessagehandler'
import { usesidepanelportmessaging } from '@/sidepanel/hooks'

export function app() {
  // initialize message handling
  usemessagehandler()
  
  // get connection status
  const { connected } = usesidepanelportmessaging()
  
  return (
    <div classname="sidepanel-v2">
      <chat isconnected={connected} />
    </div>
  )
}

// src/sidepanel/v2/components/chat.tsx
import react from 'react'
import { header } from './header'
import { messagelist } from './messagelist'
import { chatinput } from './chatinput'
import { usechatstore } from '../stores/chatstore'

interface chatprops {
  isconnected: boolean
}

export function chat({ isconnected }: chatprops) {
  const { messages, isprocessing, reset } = usechatstore()
  
  return (
    <div classname="chat-container">
      <header 
        onreset={reset}
        showreset={messages.length > 0}
        isprocessing={isprocessing}
      />
      
      <messagelist messages={messages} />
      
      <chatinput 
        isconnected={isconnected}
        isprocessing={isprocessing}
      />
    </div>
  )
}

// src/sidepanel/v2/components/header.tsx
interface headerprops {
  onreset: () => void
  showreset: boolean
  isprocessing: boolean
}

export function header({ onreset, showreset, isprocessing }: headerprops) {
  return (
    <header classname="header">
      <h1>nxtscape assistant</h1>
      
      <div classname="header-actions">
        {isprocessing && (
          <button onclick={() => {/* cancel logic */}} classname="pause-btn">
            pause
          </button>
        )}
        
        {showreset && (
          <button onclick={onreset} classname="reset-btn">
            reset
          </button>
        )}
      </div>
    </header>
  )
}

// src/sidepanel/v2/components/messagelist.tsx
import react, { useref } from 'react'
import { messageitem } from './messageitem'
import { useautoscroll } from '../hooks/useautoscroll'
import type { message } from '../stores/chatstore'

interface messagelistprops {
  messages: message[]
}

export function messagelist({ messages }: messagelistprops) {
  const containerref = useref<htmldivelement>(null)
  
  // auto-scroll on new messages
  useautoscroll(containerref, [messages])
  
  if (messages.length === 0) {
    return (
      <div classname="empty-state">
        <h2>what can i help you with?</h2>
        <div classname="examples">
          <button>summarize this page</button>
          <button>find all links</button>
          <button>fill out this form</button>
        </div>
      </div>
    )
  }
  
  return (
    <div classname="message-list" ref={containerref}>
      {messages.map(message => (
        <messageitem key={message.id} message={message} />
      ))}
    </div>
  )
}

// src/sidepanel/v2/components/messageitem.tsx
import react from 'react'
import { markdown } from './shared/markdown'
import type { message } from '../stores/chatstore'

interface messageitemprops {
  message: message
}

// ntn -- NO NEED TO SHOW ICONS on the message thread. User message slots to the right and all the messagens from AI -- system and tool will be on the left 
export function MessageItem({ message }: MessageItemProps) {
  const getIcon = () => {
    switch (message.role) {
//      case 'user': return '👤'
  //    case 'assistant': return '🤖'
    //  case 'system': return '📋'
    }
  }
  
  return (
    <div className={`message message--${message.role}`}>
      <div className="message-icon">{getIcon()}</div>
      <div className="message-content">
        {message.role === 'user' ? (
          <span>{message.content}</span>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </div>
  )
}

// src/sidepanel/v2/components/ChatInput.tsx
import React, { useState, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { TabSelector } from './shared/TabSelector'
import { MessageType } from '@/lib/types/messaging'
import { useSidePanelPortMessaging } from '@/sidepanel/hooks'

interface ChatInputProps {
  isConnected: boolean
  isProcessing: boolean
}

export function ChatInput({ isConnected, isProcessing }: ChatInputProps) {
  const [input, setInput] = useState('')
  const [showTabSelector, setShowTabSelector] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  const { addMessage, setProcessing, selectedTabIds } = useChatStore()
  const { sendMessage } = useSidePanelPortMessaging()
  
  const handleSubmit = () => {
    if (!input.trim() || !isConnected) return
    
    // Add user message
    addMessage({
      role: 'user',
      content: input.trim()
    })
    
    // Send to background
    setProcessing(true)
    sendMessage(MessageType.EXECUTE_QUERY, {
      query: input.trim(),
      tabIds: selectedTabIds.length > 0 ? selectedTabIds : undefined
    })
    
    // Clear input
    setInput('')
  }
  
  const handleCancel = () => {
    sendMessage(MessageType.CANCEL_TASK, {
      reason: 'User requested cancellation'
    })
  }
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onSubmit: handleSubmit,
    onCancel: isProcessing ? handleCancel : undefined
  })
  
  return (
    <div className="chat-input">
      {showTabSelector && (
        <TabSelector 
          isOpen={showTabSelector}
          onClose={() => setShowTabSelector(false)}
        />
      )}
      
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            // Check for @ to show tab selector
            if (e.target.value.endsWith('@')) {
              setShowTabSelector(true)
            }
          }}
          placeholder={isProcessing ? "Interrupt with new task..." : "Ask me anything..."}
          disabled={!isConnected}
          rows={1}
        />
        
        <button type="submit" disabled={!isConnected || !input.trim()}>
          Send
        </button>
      </form>
      
      <div className="input-hint">
        {isProcessing 
          ? "Press Enter to interrupt • Esc to cancel"
          : "Press Enter to send • @ to select tabs"
        }
      </div>
    </div>
  )
}
```

## 6. Implementation Phases

### Phase 1: Foundation (Week 1)

This phase establishes the core architecture without touching existing code.

#### 1.1 Create Directory Structure
```bash
mkdir -p src/sidepanel/v2/{components,hooks,stores,styles}
mkdir -p src/sidepanel/v2/components/shared
mkdir -p src/sidepanel/v2/styles/components
```

#### 1.2 Implement Chat Store
**File**: `src/sidepanel/v2/stores/chatStore.ts`
- Copy the design from Section 5.1
- Add tests for all store actions
- Verify Zustand devtools integration

#### 1.3 Create Message Handler Hook
**File**: `src/sidepanel/v2/hooks/useMessageHandler.ts`
- Implement simplified message processing
- No buffering or debouncing initially
- Map all message types to simple add/update operations
- Test with mock port messages

#### 1.4 Build App.tsx Entry Point
**File**: `src/sidepanel/v2/App.tsx`
- Minimal component that initializes hooks
- Basic error boundary
- Connection status display
- Placeholder for Chat component

#### 1.5 Setup Feature Flag
**File**: `src/sidepanel/index.tsx`
```typescript
const USE_V2 = process.env.REACT_APP_SIDEPANEL_V2 === 'true' || 
               new URLSearchParams(window.location.search).has('v2')

root.render(
  <React.StrictMode>
    {USE_V2 ? <AppV2 /> : <SidePanelPage />}
  </React.StrictMode>
)
```

**Deliverables**:
- Working store with all actions
- Message handler processing real messages
- Feature flag switching between versions
- Basic smoke tests passing

### Phase 2: Core Components (Week 2)

Build the essential UI components with minimal features.

#### 2.1 Copy Shared Components
**Files to copy as-is**:
- `TabSelector.tsx` → `v2/components/shared/TabSelector.tsx`
- `MarkdownContent.tsx` → `v2/components/shared/Markdown.tsx`
- Update imports to use v2 paths

#### 2.2 Implement Chat Container
**File**: `src/sidepanel/v2/components/Chat.tsx`
- Basic layout with flexbox
- Wire up to chatStore
- Render child components
- Handle loading/error states

#### 2.3 Create Header Component  
**File**: `src/sidepanel/v2/components/Header.tsx`
- Simple title and action buttons
- Pause button only shows when processing
- Reset button only shows when messages exist
- No help modal, no debug panel

#### 2.4 Build Message List
**File**: `src/sidepanel/v2/components/MessageList.tsx`
- Empty state with example prompts
- Simple message rendering
- Auto-scroll behavior via hook
- No complex streaming animations

#### 2.5 Create Message Item
**File**: `src/sidepanel/v2/components/MessageItem.tsx`
- Role-based styling (user/assistant/system)
- Markdown rendering for assistant messages
- Plain text for user messages
- Tool metadata display

#### 2.6 Basic Styling
**Files**: `src/sidepanel/v2/styles/`
- CSS variables for theming
- Mobile-first responsive design
- Simple, clean aesthetics
- Dark mode support via CSS custom properties

**Deliverables**:
- All components rendering correctly
- Messages displaying with proper formatting
- Auto-scroll working smoothly
- Responsive layout on different screen sizes

### Phase 3: Input and Interaction (Week 3)

Complete the chat interface with input handling.

#### 3.1 Build Chat Input Component
**File**: `src/sidepanel/v2/components/ChatInput.tsx`
- Textarea with auto-resize
- Send button with disabled states
- Loading/processing indicators
- @ trigger for tab selector

#### 3.2 Integrate Tab Selection
- Wire up TabSelector to show on @ 
- Update store with selected tabs
- Display selected tabs as pills
- Include tab IDs in query messages

#### 3.3 Implement Keyboard Shortcuts
**File**: `src/sidepanel/v2/hooks/useKeyboardShortcuts.ts`
- Enter to send (without Shift)
- Shift+Enter for new line
- Escape to cancel processing
- Tab to navigate UI elements

#### 3.4 Add Cancel Functionality
- Send CANCEL_TASK message
- Update UI immediately
- Handle cancellation acknowledgment
- Clear processing state

#### 3.5 Polish Interactions
- Focus management
- Loading states
- Error handling
- Smooth transitions

**Deliverables**:
- Full chat loop working (send → process → display)
- Tab selection functional
- Keyboard shortcuts operational
- Cancel/interrupt working correctly

### Phase 4: Progressive Feature Addition (Week 4)

Selectively port valuable features based on usage data.

#### 4.1 Analyze Feature Usage
- Add analytics to old version
- Measure: help modal usage, intent predictions, debug panel
- Survey team for feature importance
- Create priority list

#### 4.2 Port High-Value Features Only
**Candidates for porting**:
- Reset conversation message to background
- Example prompt rotation
- Connection status indicators
- Basic error recovery

**Features to skip**:
- Intent prediction bubbles
- LLM settings debug panel
- Complex streaming animations
- Help modal (move to docs)

#### 4.3 Performance Optimization
- Implement message virtualization for long conversations
- Add lazy loading for TabSelector
- Optimize re-renders with React.memo
- Profile and fix any bottlenecks

#### 4.4 Accessibility Pass
- Keyboard navigation throughout
- Screen reader announcements
- Focus indicators
- ARIA labels where needed

#### 4.5 Error Boundaries
- Component-level error boundaries
- Graceful degradation
- User-friendly error messages
- Recovery actions

**Deliverables**:
- Only proven features ported
- Performance metrics improved
- Accessibility audit passed
- Error handling comprehensive

### Phase 5: Testing and Rollout (Week 5)

Ensure quality and plan gradual migration.

#### 5.1 Comprehensive Testing
**Unit Tests**:
- Store actions and selectors
- Hook behavior
- Component rendering
- Message processing logic

**Integration Tests**:
- Full chat flow
- Tab selection
- Message handling
- Error scenarios

**E2E Tests**:
- User journey from open to task completion
- Multi-tab scenarios
- Error recovery
- Performance benchmarks

#### 5.2 A/B Testing Setup
```typescript
// Feature flag with percentage rollout
const USE_V2 = (() => {
  // Force flag via query param or env
  if (new URLSearchParams(window.location.search).has('v2')) return true
  if (new URLSearchParams(window.location.search).has('v1')) return false
  if (process.env.REACT_APP_SIDEPANEL_V2 === 'true') return true
  
  // Percentage rollout
  const userId = getUserId() // From storage
  const hash = simpleHash(userId)
  const percentage = getFeatureFlagPercentage('sidepanel-v2') // From remote config
  
  return (hash % 100) < percentage
})()
```

#### 5.3 Monitoring and Metrics
- Performance metrics (render time, memory usage)
- User engagement (messages sent, tasks completed)
- Error rates and types
- Feature usage comparison

#### 5.4 Rollout Plan
1. **Week 1**: Internal team (100%)
2. **Week 2**: Beta users (10%)
3. **Week 3**: Gradual rollout (25% → 50%)
4. **Week 4**: Full rollout (100%)
5. **Week 5**: Remove old code

#### 5.5 Rollback Strategy
- Feature flag can instantly revert
- Keep old code for 4 weeks minimum
- Monitor error rates closely
- Have rollback runbook ready

**Deliverables**:
- 90%+ test coverage
- Performance benchmarks documented
- Monitoring dashboards created
- Rollout plan approved

## Success Metrics

### Quantitative
- **Code Reduction**: 3,565 → ~1,400 lines (60% reduction)
- **Performance**: <100ms initial render, <50ms message render
- **Bundle Size**: 30% smaller JavaScript bundle
- **Error Rate**: <0.1% user-facing errors

### Qualitative
- **Developer Satisfaction**: Easier to understand and modify
- **User Feedback**: No regression in core functionality
- **Maintainability**: New features take 50% less time to implement
- **Code Quality**: All components under 200 lines

## Risks and Mitigations

### Technical Risks
1. **Message handling bugs**: Extensive testing, gradual rollout
2. **Performance regression**: Continuous monitoring, quick rollback
3. **Feature parity gaps**: User feedback loops, iterative improvements

### Process Risks
1. **Scope creep**: Strict feature prioritization, time-boxed phases
2. **Team bandwidth**: Dedicated developer, clear milestones
3. **User resistance**: Clear communication, opt-in period

## Conclusion

The Sidepanel V2 redesign represents a crucial technical debt paydown that will accelerate future development. By following this phased approach, we can deliver a cleaner, faster, more maintainable solution while ensuring zero disruption to users. The side-by-side implementation allows us to derisk the migration and learn from real usage before committing to the new architecture.
