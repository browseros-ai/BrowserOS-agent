import { z } from 'zod'

// ============================================
// Action Types
// ============================================

// Action types - unified and clear
export const ActionTypeSchema = z.enum([
  'session_start',  // Recording session start
  'session_end',    // Recording session end
  'click',          // Mouse click
  'dblclick',       // Double click
  'input',          // Text input
  'change',         // Input change
  'keydown',        // Key down event
  'keyup',          // Key up event
  'beforeunload',   // Page unload
  'navigation',     // URL navigation
  'scroll',         // Page scroll
  'type',           // Text input/typing (alias for input)
  'keypress',       // Keyboard press (non-text)
  'navigate',       // URL navigation (alias for navigation)
  'tab_switched',   // User switched to different tab
  'tab_opened',     // New tab was opened
  'tab_closed'      // Tab was closed
])

// ============================================
// Element Context (Rich target information)
// ============================================

export const ElementContextSchema = z.object({
  nodeId: z.number().optional(),  // BrowserOS nodeId if available

  // Multiple selector strategies for resilience
  selectors: z.object({
    css: z.string().optional(),  // CSS selector
    xpath: z.string().optional(),  // XPath
    text: z.string().optional(),  // Text content selector
    ariaLabel: z.string().optional(),  // ARIA label
    dataTestId: z.string().optional(),  // data-testid
    id: z.string().optional(),  // Element ID
    className: z.string().optional()  // Class names
  }),

  // Element details for context
  element: z.object({
    tagName: z.string(),  // HTML tag
    type: z.string().optional(),  // Input type
    text: z.string().optional(),  // Inner text
    value: z.string().optional(),  // Current value
    placeholder: z.string().optional(),  // Placeholder text
    attributes: z.record(z.string(), z.string()),  // All attributes

    // Visual information
    boundingBox: z.object({
      x: z.number(),  // X position
      y: z.number(),  // Y position
      width: z.number(),  // Width
      height: z.number()  // Height
    }),

    isVisible: z.boolean(),  // Visibility state
    isInteractive: z.boolean().optional(),  // Can interact
    isDisabled: z.boolean().optional()  // Disabled state
  }),
})

// ============================================
// State Snapshot
// ============================================

export const StateSnapshotSchema = z.object({
  timestamp: z.number(),  // When captured

  // Page information
  page: z.object({
    url: z.string(),  // Current URL
    title: z.string(),  // Page title
  }),

  // BrowserOS interactive snapshot
  browserState: z.object({
    string: z.string(),  // Text representation
  }).optional(),

  // Visual capture
  screenshot: z.string().optional(),  // Base64 screenshot

  // Additional context
  viewport: z.object({
    scrollX: z.number(),  // Scroll position X
    scrollY: z.number(),  // Scroll position Y
    innerWidth: z.number(),  // Viewport width
    innerHeight: z.number()  // Viewport height
  }).optional()
})

// ============================================
// Event Structure
// ============================================

// Captured event with rich context
export const CapturedEventSchema = z.object({
  id: z.string(),  // Unique event ID
  timestamp: z.number(),  // Unix timestamp
  tabId: z.number().optional(),  // Tab ID that sent this event

  // Core action description
  action: z.object({
    type: ActionTypeSchema,  // Action type

    // For text input
    value: z.string().optional(),  // Input value

    // For keyboard events
    key: z.object({
      key: z.string(),  // Key name (e.g., "Enter", "a")
      code: z.string().optional(),  // Key code (e.g., "KeyA")
      altKey: z.boolean().optional(),  // Alt modifier
      ctrlKey: z.boolean().optional(),  // Ctrl modifier
      metaKey: z.boolean().optional(),  // Meta/Cmd modifier
      shiftKey: z.boolean().optional()  // Shift modifier
    }).optional(),

    // For mouse events
    mouse: z.object({
      button: z.number(),  // Mouse button (0=left, 1=middle, 2=right)
      x: z.number(),  // Page X coordinate
      y: z.number(),  // Page Y coordinate
      offsetX: z.number().optional(),  // Element relative X
      offsetY: z.number().optional()  // Element relative Y
    }).optional(),

    // For navigation
    url: z.string().optional(),  // Target URL

    // For scroll
    scroll: z.object({
      x: z.number(),  // Horizontal scroll position
      y: z.number(),  // Vertical scroll position
      deltaX: z.number().optional(),  // Scroll delta X
      deltaY: z.number().optional()  // Scroll delta Y
    }).optional(),

    // For tab operations
    tabId: z.number().optional(),  // Tab ID involved in operation
    fromTabId: z.number().optional(),  // Previous tab (for switches)
    toTabId: z.number().optional(),  // New tab (for switches)
    fromUrl: z.string().optional(),  // URL of previous tab (for switches)
    toUrl: z.string().optional()  // URL of new tab (for switches/opens)
  }),

  // Target element information (for interactions)
  target: ElementContextSchema.optional(),

  // State before and after the event
  state: StateSnapshotSchema.optional(),

  // Optional narration segment for this event
  narration: z.string().optional()
})

// ============================================
// Core Recording Structure
// ============================================

export const TeachModeRecordingSchema = z.object({
  // Session metadata
  session: z.object({
    id: z.string(),  // Unique session ID
    startTimestamp: z.number(),  // Unix timestamp
    endTimestamp: z.number().optional(),  // Unix timestamp when stopped
    tabId: z.number(),  // Initial Chrome tab ID where recording started
    url: z.string()  // Initial URL
  }),

  // Voice narration/transcript
  narration: z.object({
    transcript: z.string(),  // Full transcript text
    duration: z.number().optional(),  // Recording duration in ms
    segments: z.array(z.object({  // Timestamped segments
      text: z.string(),  // Segment text
      startTime: z.number(),  // Start time in recording
      endTime: z.number(),  // End time in recording
      confidence: z.number().optional()  // VAPI confidence score
    })).optional(),
    vapiSessionId: z.string().optional(),  // VAPI session reference
    language: z.string().default('en')  // Language code
  }).optional(),

  // Audio recording (base64 encoded WebM)
  audio: z.string().optional(),

  // Viewport configuration
  viewport: z.object({
    width: z.number(),  // Viewport width
    height: z.number(),  // Viewport height
    deviceScaleFactor: z.number(),  // DPR
    isMobile: z.boolean(),  // Mobile emulation
    hasTouch: z.boolean(),  // Touch support
    isLandscape: z.boolean()  // Orientation
  }).optional(),

  // Captured events with full context
  events: z.array(CapturedEventSchema)
})

// ============================================
// Semantic Workflow (Processed output)
// ============================================

export const SemanticWorkflowSchema = z.object({
  metadata: z.object({
    recordingId: z.string(),  // Source recording ID
    name: z.string(),  // Concise workflow name (2-3 words)
    goal: z.string(),  // High-level goal
    description: z.string().optional(),  // Detailed description
    transcript: z.string().optional(),  // Raw transcript from narration/audio
    createdAt: z.number(),  // Creation timestamp
    duration: z.number().optional()  // Total duration in ms
  }),

  steps: z.array(z.object({
    id: z.string(),  // Step ID
    intent: z.string(),  // What the step accomplishes

    action: z.object({
      type: z.string(),  // Action type
      description: z.string(),  // Human-readable description
      nodeIdentificationStrategy: z.string().optional().nullable(),  // Element identification guidance
      validationStrategy: z.string(),  // How to verify completion
      timeoutMs: z.number().default(5000)  // Suggested timeout
    }),

    // Reference to source events
    sourceEventIds: z.array(z.string()),

    // State context
    stateBefore: StateSnapshotSchema.optional(),
    stateAfter: StateSnapshotSchema.optional()
  }))
})

// ============================================
// Type exports
// ============================================

export type TeachModeRecording = z.infer<typeof TeachModeRecordingSchema>
export type CapturedEvent = z.infer<typeof CapturedEventSchema>
export type ActionType = z.infer<typeof ActionTypeSchema>
export type ElementContext = z.infer<typeof ElementContextSchema>
export type StateSnapshot = z.infer<typeof StateSnapshotSchema>
export type SemanticWorkflow = z.infer<typeof SemanticWorkflowSchema>

// ============================================
// Message types for communication
// ============================================

export const TeachModeMessageSchema = z.discriminatedUnion('action', [
  // Service → Content Script
  z.object({
    action: z.literal('START_RECORDING'),
    source: z.literal('TeachModeService'),
    targetTabId: z.number().optional(),  // For multi-tab targeting
    config: z.object({
      captureVoice: z.boolean().optional(),  // Enable voice capture
      captureScreenshots: z.boolean().optional(),  // Enable screenshots
      captureBeforeState: z.boolean().optional()  // Capture before states
    }).optional()
  }),

  z.object({
    action: z.literal('STOP_RECORDING'),
    source: z.literal('TeachModeService'),
    targetTabId: z.number().optional()  // For multi-tab targeting
  }),

  z.object({
    action: z.literal('HEARTBEAT_PING'),
    source: z.literal('TeachModeService')
  }),

  // Content Script → Service
  z.object({
    action: z.literal('EVENT_CAPTURED'),
    source: z.literal('TeachModeRecorder'),
    event: CapturedEventSchema
  }),

  z.object({
    action: z.literal('RECORDER_READY'),
    source: z.literal('TeachModeRecorder'),
    viewport: z.object({
      width: z.number(),
      height: z.number(),
      deviceScaleFactor: z.number()
    }).optional()
  }),

  // Voice/Narration messages
  z.object({
    action: z.literal('NARRATION_UPDATE'),
    source: z.literal('TeachModeRecorder'),
    segment: z.object({
      text: z.string(),
      startTime: z.number(),
      endTime: z.number()
    })
  })
])

export type TeachModeMessage = z.infer<typeof TeachModeMessageSchema>

