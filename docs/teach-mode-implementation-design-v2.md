# Teach Mode Implementation Design V2

## Overview

This document outlines the implementation design for Teach Mode in the Nxtscape browser agent. The design follows a KISS (Keep It Simple, Stupid) approach, leveraging existing patterns from the codebase (like GlowAnimationService) and Chrome's recorder implementation.

## Architecture Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **NodeId Strategy** | Record without nodeIds | Use multiple selectors (CSS, XPath, text) for robustness |
| **Event Transmission** | Send immediately | No batching, simpler implementation |
| **Selector Types** | Comprehensive set | CSS, XPath, text, ARIA, data-testid for fallback options |
| **State Capture** | 100ms after event | Capture browserStateString, screenshot, URL, title |
| **Storage** | In-memory, save at end | Simple JSON file output |
| **Injection** | Once at recording start | Re-inject on navigation like glow animation |
| **Event Filtering** | Capture all | Filter during processing if needed |
| **Multi-tab** | Single tab + navigation | Track tab switches but record one tab at a time |
| **UI** | Sidepanel button | Use existing pubsub for communication |

## File Structure

```
src/
├── content/
│   └── teach-mode-recorder.ts      # Injected content script
│
├── lib/
│   ├── services/
│   │   └── TeachModeService.ts     # Main orchestration service
│   │
│   └── teach-mode/
│       ├── recording/
│       │   ├── RecordingSession.ts  # Recording session management
│       │   ├── EventCollector.ts    # Event collection from content script
│       │   └── StateCapture.ts      # Browser state capture
│       │
│       ├── storage/
│       │   └── RecordingStorage.ts  # Save/load recordings
│       │
│       └── types/
│           └── index.ts              # Type definitions
│
└── sidepanel/
    └── v2/
        └── components/
            └── TeachModeButton.tsx  # Recording controls
```

## Core Components

### 1. Content Script (`content/teach-mode-recorder.ts`)

Based on Chrome's RecordingClient pattern:

```typescript
class TeachModeRecorder {
  // Initialize with options (debug mode, selector types)

  start():
    // Add event listeners (click, input, keydown, etc.)
    // Set recording flag to true

  handleClick(event):
    // Compute selectors for target element
    // Extract mouse position and modifiers
    // Send event to background

  handleInput(event):
    // Get input value
    // Compute selectors
    // Send to background

  computeSelectors(element):
    // Generate CSS selector
    // Generate XPath
    // Extract text content
    // Get ARIA labels
    // Return all selectors

  sendEvent(event):
    // Send via chrome.runtime.sendMessage
    // Include timestamp and event data
}

// Message listener for START/STOP commands
```

### 2. Service Layer (`lib/services/TeachModeService.ts`)

Following the GlowAnimationService pattern:

```typescript
class TeachModeService {
  // Singleton pattern
  // Current recording session
  // Navigation listener

  startRecording(tabId, options):
    // Create new RecordingSession
    // Inject content script
    // Send START_RECORDING message
    // Initialize session

  stopRecording():
    // Stop current session
    // Send STOP_RECORDING message
    // Save recording to storage
    // Return recording data

  setupNavigationListener():
    // Listen for chrome.webNavigation.onCommitted
    // Record navigation events
    // Re-inject content script after navigation

  setupMessageListener():
    // Listen for EVENT_CAPTURED from content script
    // Forward to RecordingSession for processing

  reinjectContentScript(tabId):
    // Re-inject after navigation
    // Restart event capture
}
```

### 3. Recording Session (`lib/teach-mode/recording/RecordingSession.ts`)

```typescript
class RecordingSession {
  // Tab ID, browser context, events array
  // Recording metadata

  start():
    // Capture initial browser state
    // Add session_start event

  handleCapturedEvent(event, tabId):
    // Verify event is from our tab
    // Schedule state capture (100ms delay)
    // Add enriched event to array

  captureState():
    // Get current page from BrowserContext
    // Get browserStateString
    // Take screenshot
    // Get URL and title
    // Return state object

  stop():
    // Capture final state
    // Add session_end event
    // Return complete recording

  addNavigationEvent(details):
    // Record URL change
    // Include transition type
}
```

### 4. Type Definitions (`lib/teach-mode/types/index.ts`)

```typescript
import { z } from 'zod'

// Selector types (comprehensive for robustness)
export const SelectorsSchema = z.object({
  css: z.string().optional(),  // CSS selector
  xpath: z.string().optional(),  // XPath selector
  text: z.string().optional(),  // Text content
  ariaLabel: z.string().optional(),  // ARIA label
  dataTestId: z.string().optional(),  // data-testid attribute
  id: z.string().optional(),  // Element ID
  className: z.string().optional()  // Class names
})

export type Selectors = z.infer<typeof SelectorsSchema>

// Browser state (captured after each event)
export const BrowserStateSchema = z.object({
  timestamp: z.number(),  // When captured
  browserStateString: z.string(),  // Text representation
  screenshot: z.string().optional(),  // Base64 image
  url: z.string(),  // Current URL
  title: z.string(),  // Page title
  tabId: z.number()  // Tab ID
})

export type BrowserState = z.infer<typeof BrowserStateSchema>

// Event types (based on Chrome recorder)
export const EventTypeSchema = z.enum([
  'session_start',
  'session_end',
  'click',
  'dblclick',
  'input',
  'change',
  'keydown',
  'keyup',
  'scroll',
  'focus',
  'blur',
  'navigation',
  'beforeunload',
  'tab_switch'
])

export type EventType = z.infer<typeof EventTypeSchema>

// Captured event
export const CapturedEventSchema = z.object({
  id: z.string(),  // Unique event ID
  type: EventTypeSchema,  // Event type
  timestamp: z.number(),  // When it occurred

  // For interaction events
  selectors: SelectorsSchema.optional(),  // Element selectors
  value: z.string().optional(),  // Input value
  key: z.string().optional(),  // Key pressed

  // Mouse data
  mouseButton: z.number().optional(),
  mousePosition: z.object({
    x: z.number(),
    y: z.number()
  }).optional(),

  // Keyboard modifiers
  altKey: z.boolean().optional(),
  ctrlKey: z.boolean().optional(),
  metaKey: z.boolean().optional(),
  shiftKey: z.boolean().optional(),

  // Navigation data
  url: z.string().optional(),
  transitionType: z.string().optional(),
  transitionQualifiers: z.array(z.string()).optional(),

  // State after event (captured 100ms later)
  state: BrowserStateSchema.optional()
})

export type CapturedEvent = z.infer<typeof CapturedEventSchema>

// Recording metadata
export const RecordingMetadataSchema = z.object({
  id: z.string(),  // Recording ID
  title: z.string(),  // User-provided title
  description: z.string().optional(),  // Optional description
  startTime: z.number(),  // Start timestamp
  endTime: z.number().optional(),  // End timestamp
  tabId: z.number(),  // Initial tab ID
  version: z.literal('1.0.0').default('1.0.0')  // Format version
})

export type RecordingMetadata = z.infer<typeof RecordingMetadataSchema>

// Complete recording
export const TeachModeRecordingSchema = z.object({
  metadata: RecordingMetadataSchema,  // Recording info
  events: z.array(CapturedEventSchema),  // All captured events
  narration: z.string().default('')  // Voice narration (future)
})

export type TeachModeRecording = z.infer<typeof TeachModeRecordingSchema>

// Recording options
export const RecordingOptionsSchema = z.object({
  title: z.string().optional(),  // Recording title
  captureScreenshots: z.boolean().default(true),  // Include screenshots
  captureFullState: z.boolean().default(true),  // Full browser state
  selectorTypes: z.array(z.string()).default(['css', 'xpath', 'text', 'aria'])  // Selector strategies
})

export type RecordingOptions = z.infer<typeof RecordingOptionsSchema>
```

### 5. Storage (`lib/teach-mode/storage/RecordingStorage.ts`)

```typescript
class RecordingStorage {
  static save(recording):
    // Convert to JSON string
    // Save to chrome.storage.local
    // Offer download as JSON file
    // Return recording ID

  static load(id):
    // Get from chrome.storage.local
    // Parse JSON
    // Validate with schema
    // Return recording

  static list():
    // Get all recordings from storage
    // Extract metadata
    // Sort by timestamp
    // Return list

  static delete(id):
    // Remove from chrome.storage.local
}
```

### 6. UI Component (`sidepanel/v2/components/TeachModeButton.tsx`)

```typescript
const TeachModeButton = () => {
  // State: isRecording, recordingTime
  // Use pubsub hook

  handleStartRecording():
    // Get current tab
    // Publish TEACH_MODE_START via pubsub
    // Start timer

  handleStopRecording():
    // Publish TEACH_MODE_STOP
    // Stop timer
    // Reset state

  render():
    // Show Start button when not recording
    // Show Stop button + timer when recording
}
```

### 7. Background Handler (`background/handlers/teachModeHandler.ts`)

```typescript
setupTeachModeHandler():
  // Get TeachModeService instance
  // Listen for TEACH_MODE_START message
  // Listen for TEACH_MODE_STOP message
  // Forward to service methods
  // Return success/error response
```

## Message Flow

```
User clicks "Start Teaching" in sidepanel
    ↓
TeachModeButton publishes TEACH_MODE_START via PubSub
    ↓
Background handler receives message
    ↓
TeachModeService.startRecording()
    ↓
Inject content script (teach-mode-recorder.js)
    ↓
Send START_RECORDING to content script
    ↓
Content script starts capturing events
    ↓
User performs actions...
    ↓
Content script sends EVENT_CAPTURED messages
    ↓
TeachModeService receives events
    ↓
RecordingSession captures state (100ms delay)
    ↓
User clicks "Stop Recording"
    ↓
TeachModeButton publishes TEACH_MODE_STOP
    ↓
TeachModeService.stopRecording()
    ↓
Save recording to JSON file
```

## Navigation Handling

Following the GlowAnimationService pattern:

1. Listen for `chrome.webNavigation.onCommitted`
2. Check if it's our recording tab
3. Record navigation event
4. Re-inject content script after 100ms delay
5. Continue recording seamlessly

## Implementation Phases

### Phase 1: Core Recording Infrastructure
**Features**: Basic event capture and session management
- [ ] Create content script with event listeners
- [ ] Implement TeachModeService with start/stop methods
- [ ] Set up RecordingSession to collect events
- [ ] Add chrome.runtime message passing
- [ ] Handle content script injection

### Phase 2: State Capture System
**Features**: Browser state and screenshot capture
- [ ] Integrate with BrowserContext for state capture
- [ ] Add 100ms delayed state capture after events
- [ ] Implement screenshot capture using BrowserPage
- [ ] Store state with each event

### Phase 3: Navigation & Tab Handling
**Features**: Handle page navigation and tab switches
- [ ] Add webNavigation listener for page changes
- [ ] Re-inject content script after navigation
- [ ] Track tab switches and record as events
- [ ] Handle beforeunload events

### Phase 4: Selector Computation
**Features**: Comprehensive selector strategies
- [ ] Implement CSS selector computation
- [ ] Add XPath selector generation
- [ ] Extract ARIA labels and data-testid
- [ ] Add text-based selectors

### Phase 5: Storage & Persistence
**Features**: Save and load recordings
- [ ] Implement RecordingStorage class
- [ ] Add JSON serialization/deserialization
- [ ] Store in chrome.storage.local
- [ ] Add download as JSON file option

### Phase 6: UI Integration
**Features**: User interface for recording control
- [ ] Add TeachModeButton to sidepanel
- [ ] Implement recording timer display
- [ ] Set up pubsub message flow
- [ ] Add visual recording indicators

### Phase 7: Error Handling & Polish
**Features**: Robustness and user experience
- [ ] Add error boundaries and recovery
- [ ] Handle edge cases (tab close, navigation errors)
- [ ] Add logging and debugging support
- [ ] Optimize performance for long recordings

## Future Enhancements

1. **Voice Narration**: Add audio recording capability
2. **Processing Pipeline**: Convert events to semantic workflows
3. **Replay Engine**: Execute recorded workflows
4. **Multi-tab Support**: Record across multiple tabs
5. **Visual Timeline**: Show recorded events visually

## Testing Strategy

### Unit Tests
- SelectorComputer logic
- Event enrichment
- State capture timing
- Storage operations

### Integration Tests
- Content script injection
- Message passing flow
- Navigation handling
- Full recording cycle

### Manual Testing
- Record complex workflows
- Test navigation scenarios
- Verify state capture accuracy
- Test file save/load

## Conclusion

This design provides a clean, simple implementation of teach mode recording based on proven patterns from the codebase (GlowAnimationService) and Chrome's recorder. The architecture is modular, testable, and follows the KISS principle throughout.