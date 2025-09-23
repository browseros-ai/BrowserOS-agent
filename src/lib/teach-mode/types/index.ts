import { z } from 'zod'

// Event types that we'll capture
export const EventTypeSchema = z.enum([
  'session_start',
  'session_end',
  'setViewport',
  'click',
  'dblclick',
  'input',
  'change',
  'keydown',
  'keyup',
  'beforeunload',
  'navigation'
])

export type EventType = z.infer<typeof EventTypeSchema>

// Selectors for elements (improved with ARIA and data-testid)
export const SelectorsSchema = z.object({
  css: z.string().optional(),  // CSS selector
  xpath: z.string().optional(),  // XPath selector
  text: z.string().optional(),  // Text content
  ariaLabel: z.string().optional(),  // ARIA label
  dataTestId: z.string().optional(),  // data-testid attribute
  tagName: z.string().optional()  // Tag name for context
})

export type Selectors = z.infer<typeof SelectorsSchema>

// Basic captured event for Phase 1
export const CapturedEventSchema = z.object({
  id: z.string(),  // Unique event ID
  type: EventTypeSchema,  // Event type
  timestamp: z.number(),  // When it occurred

  // Element selectors (for interaction events)
  selectors: SelectorsSchema.optional(),

  // Event-specific data
  value: z.string().optional(),  // Input value
  key: z.string().optional(),  // Key pressed
  button: z.number().optional(),  // Mouse button

  // Click position
  offsetX: z.number().optional(),  // X position within element
  offsetY: z.number().optional(),  // Y position within element

  // Modifiers
  altKey: z.boolean().optional(),
  ctrlKey: z.boolean().optional(),
  metaKey: z.boolean().optional(),
  shiftKey: z.boolean().optional(),

  // Navigation data
  url: z.string().optional(),

  // Viewport data (for setViewport event)
  width: z.number().optional(),
  height: z.number().optional(),
  deviceScaleFactor: z.number().optional(),
  isMobile: z.boolean().optional(),
  hasTouch: z.boolean().optional(),
  isLandscape: z.boolean().optional()
})

export type CapturedEvent = z.infer<typeof CapturedEventSchema>

// Recording session metadata
export const RecordingMetadataSchema = z.object({
  id: z.string(),  // Recording ID
  startTime: z.number(),  // Start timestamp
  endTime: z.number().optional(),  // End timestamp
  tabId: z.number(),  // Tab being recorded
  url: z.string()  // Initial URL
})

export type RecordingMetadata = z.infer<typeof RecordingMetadataSchema>

// Complete recording for Phase 1
export const TeachModeRecordingSchema = z.object({
  metadata: RecordingMetadataSchema,
  events: z.array(CapturedEventSchema)
})

export type TeachModeRecording = z.infer<typeof TeachModeRecordingSchema>

// Messages between content script and service
export const TeachModeMessageSchema = z.discriminatedUnion('action', [
  // From service to content script
  z.object({
    action: z.literal('START_RECORDING'),
    source: z.literal('TeachModeService')
  }),
  z.object({
    action: z.literal('STOP_RECORDING'),
    source: z.literal('TeachModeService')
  }),

  // From content script to service
  z.object({
    action: z.literal('EVENT_CAPTURED'),
    source: z.literal('TeachModeRecorder'),
    event: CapturedEventSchema
  }),
  z.object({
    action: z.literal('RECORDER_READY'),
    source: z.literal('TeachModeRecorder')
  })
])

export type TeachModeMessage = z.infer<typeof TeachModeMessageSchema>