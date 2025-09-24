# Teach Mode UI Design Document

## Overview
Teach Mode allows users to demonstrate browser workflows through natural interaction and voice narration, which the AI then learns and can replay adaptively. This document outlines the UI/UX design for this feature.

## Core Design Principles
1. **Clarity Over Features** - Every element should have a clear, single purpose
2. **Progressive Disclosure** - Show only what's needed at each step
3. **Visual Feedback** - Users should always know what's happening
4. **Forgiving** - Easy to undo, retry, or modify
5. **Contextual** - Voice + Visual = Complete understanding

## User Flow States
```
IDLE → INTENT → RECORDING → PROCESSING → READY → EXECUTING
  ↑                              ↓
  └──────────────────────────────┘
```

## Screen Designs

### 1. Home Screen (IDLE State)
**Purpose**: Entry point showing existing recordings and create new option

**Elements**:
- Header with "Teach" tab indicator
- Primary action: "Create New Recording" button (prominent)
- Recording list (if any exist)
  - Recording cards showing:
    - Workflow name (auto-generated or custom)
    - Step count + duration
    - Last run timestamp
    - Success/failure indicator
    - Thumbnail of starting page
- Empty state (if no recordings):
  - Friendly illustration
  - "Teach your first workflow" message
  - 3 example suggestions (quick wins)

**Interactions**:
- Click "Create New" → Intent Screen
- Click recording card → Recording Detail View
- Long-press card → Delete confirmation

### 2. Intent Capture Screen
**Purpose**: Understand what user wants to automate before recording

**Elements**:
- Back button (top left)
- Title: "What would you like to automate?"
- Text input field (auto-focused, placeholder: "e.g., Unsubscribe from marketing emails")
- Helper text: "Describe your workflow in simple terms"
- Start Recording button (disabled until input has content)
- Optional: Suggested intents based on common workflows

**Interactions**:
- Type intent → Enable Start button
- Press Start → Begin Recording Screen
- Press Back → Return to Home

### 3. Recording Screen (RECORDING State)
**Purpose**: Capture user actions and voice narration

**Elements**:
- Recording header:
  - Red recording indicator (pulsing)
  - Timer showing elapsed time (00:42)
  - Stop button (prominent)
- Intent reminder (small text): "Automating: [user's intent]"
- Live action timeline:
  - Visual cards for each captured action
  - Screenshot thumbnails (lazy loaded)
  - Action description ("Clicked 'Sign in'")
  - Voice annotation overlay (if speaking)
- Voice indicator:
  - Microphone icon with audio wave visualization
  - "Listening..." text when detecting speech

**Visual Feedback**:
- Entire panel has subtle red border glow
- Actions appear with slide-in animation
- Voice transcription appears in real-time

**Interactions**:
- Stop → End recording and go to Processing
- Browser actions automatically captured and added to timeline

### 4. Processing Screen (PROCESSING State)
**Purpose**: Show progress while AI processes the recording

**Elements**:
- Animated processing indicator (not a generic spinner)
- Progress stages with checkmarks:
  - ✓ Captured 12 actions
  - ⟳ Understanding workflow intent...
  - ⟳ Creating adaptable automation...
  - ⟳ Optimizing for reliability...
- Estimated time remaining (if possible)
- Cancel button (stops processing, saves raw recording)

**Interactions**:
- Cancel → Save draft and return to Home
- Processing complete → Recording Detail View

### 5. Recording Detail View (READY State)
**Purpose**: Review, edit, and execute recorded workflow

**Elements**:
- Header:
  - Back to list button
  - Workflow name (editable)
  - Options menu (rename, duplicate, delete, export)
- Action buttons:
  - Primary: "Run Now" (green, prominent)
  - Secondary: "Schedule"
- Workflow timeline (refined version):
  - Step cards with:
    - Step number and title
    - Screenshot thumbnail
    - Voice annotation (if any)
    - Estimated duration
    - Success rate (after first run)
  - Connecting lines between steps
  - Expand/collapse for details
- Metadata section:
  - Created date
  - Last run
  - Success rate
  - Average duration
  - Run count

**Interactions**:
- Run Now → Execute Screen
- Click step → Expand to show details
- Schedule → Scheduling modal (future enhancement)

### 6. Execution Screen (EXECUTING State)
**Purpose**: Show real-time progress during workflow execution

**Elements**:
- Execution header:
  - "Running: [Workflow Name]"
  - Stop button (abort execution)
  - Minimize button
- Progress indicator:
  - Current step / Total steps
  - Progress bar
- Live execution view:
  - Current step card (highlighted)
  - Live screenshot/preview
  - Status: "Executing..." | "Complete" | "Failed"
  - AI reasoning (optional toggle): "Looking for unsubscribe link..."
- Completed steps (collapsed, green checkmark)
- Upcoming steps (grayed out)

**Interactions**:
- Stop → Abort and show partial results
- Step fails → Show error with "Fix & Continue" option
- Completion → Show summary

### 7. Execution Summary
**Purpose**: Show results after workflow completes

**Elements**:
- Status badge: Success | Partial Success | Failed
- Execution stats:
  - Duration
  - Steps completed (e.g., 11/12)
  - Data extracted (if applicable)
- Action buttons:
  - "Run Again"
  - "View Details"
  - "Report Issue"
- If failed: Error details with suggestions

## Component Design Patterns

### Recording Cards
```
┌─────────────────────────────────┐
│ [📧] Email Cleanup               │
│ 5 steps • 1:23 • 2 hours ago    │
│ ━━━━━━━━━━━━━━━━━━━  ✅ Success │
└─────────────────────────────────┘
```

### Step Cards (Timeline)
```
┌─────────────────────────────────┐
│ 1 │ Navigate to Gmail           │
│   │ [📷 thumbnail]               │
│   │ 💬 "go to my inbox"         │
└───┼─────────────────────────────┘
    ↓
```

### Voice Annotation Display
- Inline with step: Shows as quoted text
- During recording: Real-time transcription bubble
- In timeline: Italicized, different color

## Visual Design Tokens

### Colors (CSS Variables)
```css
/* Using existing sidepanel theme variables */
--background: 0 0% 96%;
--background-alt: 0 0% 100%;
--foreground: 240 10% 3.9%;
--primary: 221.2 83.2% 53.3%; /* Blue */
--destructive: 0 84.2% 60.2%; /* Red for recording */
--success: 142 71% 45%; /* Green for success */
--muted: 240 4.8% 95.9%;
--muted-foreground: 240 3.8% 46.1%;
--border: 240 5.9% 90%;
--brand: 19 96% 55%; /* Orange brand color */

/* Dark mode overrides */
.dark {
  --background: 222.2 84% 4.9%;
  --background-alt: 224 71% 4%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --destructive: 0 62.8% 30.6%;
  --border: 217.2 32.6% 17.5%;
}
```

### Typography
- Font Family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto
- Base Size: 14px (inherited from sidepanel)
- Headers: 20px, font-semibold
- Body: 14px, font-normal
- Captions: 12px, font-normal
- Monospace: font-mono, 13px (for technical details)

### Spacing
- Base unit: 4px
- Component padding: 16px
- Card spacing: 12px
- Section spacing: 24px

### Animation Timings
- Micro-interactions: 200ms ease-out
- Page transitions: 300ms ease-in-out
- Loading states: 400ms ease-in-out
- Recording pulse: 1.5s ease-in-out (loop)

## Error States

### Recording Errors
- Lost connection: "Recording paused - Please check your connection"
- Tab closed: "Recording stopped - The tab was closed"
- Permission denied: "Please grant microphone permission to add voice notes"

### Execution Errors
- Element not found: Highlight step, offer visual fallback
- Page load timeout: Show retry with increased timeout
- Network error: Pause and wait for connection

## Responsive Behavior
- Minimum width: 320px (Chrome side panel constraint)
- Maximum width: 400px (optimal for side panel)
- Scrollable areas: Recording list, timeline
- Fixed areas: Headers, primary actions

## Accessibility
- All interactive elements keyboard accessible
- ARIA labels for all icons
- Voice annotations help screen readers understand workflow
- High contrast mode support through CSS variables
- Focus indicators on all interactive elements

## Future Enhancements (Not MVP)
- Workflow branching (if-then logic)
- Data extraction configuration
- Workflow sharing/marketplace
- Advanced scheduling (cron-like)
- Workflow composition (combine recordings)
- Version history
- A/B testing different approaches
- Batch execution of multiple workflows

## Technical Notes
- Screenshots stored as base64 thumbnails (200x150)
- Voice recordings processed client-side when possible
- Debounce rapid events (typing, scrolling)
- Group related actions automatically
- Cache processed recordings locally
- Sync to cloud for backup (with user permission)

## React Component Architecture

### Component Structure
All teach mode components will reside in `src/sidepanel/teachmode/` keeping it simple and co-located with sidepanel where it's used.

Move existing components from `src/sidepanel/components/teachmode/`:
- `TeachModeView.tsx` → `TeachMode.tsx` (main container)
- `RecordingControls.tsx` - Recording UI controls
- `RecordingsList.tsx` - List of saved recordings
- `VoiceRecorder.tsx` - Voice recording functionality
- `DebugStream.tsx` - Debug event stream

### New File Structure

```typescript
src/sidepanel/teachmode/
  // Main entry point
  TeachMode.tsx                 // Main container component

  // Screen components (flat structure)
  TeachModeHome.tsx            // Home screen with recordings list
  TeachModeIntent.tsx          // Capture user intent before recording
  TeachModeRecording.tsx       // Active recording interface
  TeachModeProcessing.tsx      // Processing animation and status
  TeachModeDetail.tsx          // Recording detail and playback controls
  TeachModeExecution.tsx       // Live execution progress
  TeachModeSummary.tsx         // Execution results

  // Shared components
  components/
    RecordingCard.tsx          // Individual recording card in list
    StepTimeline.tsx           // Visual timeline of recorded steps
    StepCard.tsx               // Individual step in timeline
    RecordingHeader.tsx        // Recording state header with timer
    VoiceIndicator.tsx         // Voice recording visual feedback
    EmptyState.tsx             // Empty state for no recordings
    ProcessingStages.tsx       // Processing progress indicator

  // Feature logic
  teachmode.store.ts           // Zustand store for state management
  teachmode.types.ts           // TypeScript interfaces and types
  teachmode.hooks.ts           // Custom hooks for teach mode
  teachmode.api.ts             // Chrome API interactions
  teachmode.utils.ts           // Utility functions
```

### State Management

#### Zustand Store
```typescript
// src/sidepanel/stores/teachModeStore.ts
interface TeachModeStore {
  // State
  mode: 'idle' | 'intent' | 'recording' | 'processing' | 'ready' | 'executing'
  currentIntent: string
  recordings: TeachModeRecording[]
  activeRecording: TeachModeRecording | null
  recordingEvents: CapturedEvent[]
  executionProgress: ExecutionProgress | null

  // Actions
  setMode: (mode: TeachModeStore['mode']) => void
  setIntent: (intent: string) => void
  startRecording: () => void
  stopRecording: () => void
  addEvent: (event: CapturedEvent) => void
  saveRecording: (recording: TeachModeRecording) => void
  deleteRecording: (id: string) => void
  executeRecording: (id: string) => void
  reset: () => void
}
```

### Component Guidelines

#### Styling Approach
- Use Tailwind CSS utilities exclusively (no CSS modules)
- Follow existing sidepanel component patterns
- Import UI primitives from `@/sidepanel/components/ui/`
- Use `cn()` utility for conditional classes

#### Example Component Template
```tsx
import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/sidepanel/components/ui/button'

interface RecordingCardProps {
  recording: TeachModeRecording
  onClick: () => void
  onDelete: () => void
}

export function RecordingCard({ recording, onClick, onDelete }: RecordingCardProps) {
  return (
    <div
      className={cn(
        "bg-background-alt rounded-lg p-4 cursor-pointer",
        "border border-border hover:border-primary/50",
        "transition-all duration-200"
      )}
      onClick={onClick}
    >
      {/* Component content */}
    </div>
  )
}
```

### Integration Points

#### Chrome Runtime Messages
```typescript
// Message types for teach mode
interface TeachModeMessages {
  TEACH_MODE_START: { tabId: number; intent: string }
  TEACH_MODE_STOP: { saveRecording: boolean }
  TEACH_MODE_EVENT_CAPTURED: { event: CapturedEvent }
  TEACH_MODE_EXECUTE: { recordingId: string }
  TEACH_MODE_EXECUTION_UPDATE: { progress: ExecutionProgress }
}
```

#### Browser Context Integration
- Leverage existing `BrowserContext` for tab management
- Use `chrome.browserOS` APIs defined in design doc
- Integrate with existing `ExecutionContext` for agent execution

### Animation Classes
```css
/* Add to src/sidepanel/styles.css */
@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.recording-pulse {
  animation: recording-pulse 1.5s ease-in-out infinite;
}

.recording-border-glow {
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}
```

### Data Flow
```
User Action → Chrome Extension Content Script → Background Script
    → TeachModeView → teachModeStore → Chrome Runtime API
    → Background Processing → Update Store → Re-render Components
```

### Testing Strategy
- Unit tests for individual components with Vitest
- Integration tests for recording/playback flow
- Mock Chrome APIs for testing
- Test file structure: `ComponentName.test.tsx`

## UI Sketches

### 1. Home Screen - Empty State
```
┌──────────────────────────────────────┐
│ ← Chat  Teach Mode                   │
├──────────────────────────────────────┤
│                                       │
│                                       │
│         [Icon: Wand/Magic]            │
│                                       │
│     Teach BrowserOS Your Workflows    │
│                                       │
│  Show BrowserOS how to do something   │
│  once, and it learns to do it for    │
│  you automatically.                   │
│                                       │
│     ┌─────────────────────────┐      │
│     │   Create New Workflow    │      │
│     └─────────────────────────┘      │
│                                       │
│  ─────────── Examples ───────────     │
│                                       │
│  • Unsubscribe from emails           │
│  • Extract data to spreadsheet       │
│  • Check website for updates         │
│                                       │
│                                       │
└──────────────────────────────────────┘
```

### 1b. Home Screen - With Recordings
```
┌──────────────────────────────────────┐
│ ← Chat  Teach Mode                   │
├──────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────┐     │
│  │  + Create New Workflow       │     │
│  └─────────────────────────────┘     │
│                                       │
│  Your Workflows (3)                   │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ 📧 Email Cleanup             │     │
│  │ Unsubscribe from marketing  │     │
│  │                              │     │
│  │ 5 steps • 1:23 • 2 hrs ago  │     │
│  │ ━━━━━━━━━━━━━━━━━━━━━━ ✅   │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ 📊 Daily Report              │     │
│  │ Extract metrics to sheets    │     │
│  │                              │     │
│  │ 8 steps • 2:45 • yesterday  │     │
│  │ ━━━━━━━━━━━━━━━━━━━━━━ ✅   │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ 🔍 Price Monitor             │     │
│  │ Check product prices         │     │
│  │                              │     │
│  │ 3 steps • 0:45 • 3 days ago │     │
│  │ ━━━━━━━━━━━━━━━━━━━━━━ ❌   │     │
│  └─────────────────────────────┘     │
│                                       │
└──────────────────────────────────────┘
```

### 2. Intent Capture Screen
```
┌──────────────────────────────────────┐
│ ← Back                               │
├──────────────────────────────────────┤
│                                       │
│                                       │
│  What would you like to automate?    │
│                                       │
│  ┌─────────────────────────────┐     │
│  │                              │     │
│  │ e.g., Unsubscribe from      │     │
│  │ marketing emails            │     │
│  │                              │     │
│  └─────────────────────────────┘     │
│                                       │
│  Describe your workflow in simple    │
│  terms. Be specific about what you   │
│  want BrowserOS to do.                │
│                                       │
│                                       │
│                                       │
│  ┌─────────────────────────────┐     │
│  │    Start Recording →         │     │
│  └─────────────────────────────┘     │
│         (disabled until input)        │
│                                       │
│  Quick suggestions:                   │
│  • "Find and remove spam emails"     │
│  • "Download invoice PDFs"           │
│  • "Check for new job postings"      │
│                                       │
└──────────────────────────────────────┘
```

### 3. Recording Screen (Active)
```
┌──────────────────────────────────────┐
│ ● Recording  00:42        [■ Stop]   │ ← Red border glow
├──────────────────────────────────────┤
│ Automating: Unsubscribe from emails  │
├──────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────┐     │
│  │ Step 1 • Just now            │     │
│  │ ┌─────┐ Navigate to Gmail   │     │
│  │ │ 📷  │ gmail.com            │     │
│  │ └─────┘                      │     │
│  │ 💬 "Open my email inbox"     │     │
│  └─────────────────────────────┘     │
│              ↓                        │
│  ┌─────────────────────────────┐     │
│  │ Step 2 • 5 sec ago           │     │
│  │ ┌─────┐ Clicked "Promotions"│     │
│  │ │ 📷  │ Tab selector         │     │
│  │ └─────┘                      │     │
│  │ 💬 "Go to promotional emails"│     │
│  └─────────────────────────────┘     │
│              ↓                        │
│  ┌─────────────────────────────┐     │
│  │ Step 3 • Recording...        │     │
│  │ ┌─────┐ [Current action]    │     │
│  │ │ ⚪  │ ...                  │     │
│  │ └─────┘                      │     │
│  │  🎤 ～～～ Listening...      │     │
│  └─────────────────────────────┘     │
│                                       │
│  Tip: Describe what you're doing     │
│  as you click for better learning    │
└──────────────────────────────────────┘
```

### 4. Processing Screen
```
┌──────────────────────────────────────┐
│ Processing Your Workflow             │
├──────────────────────────────────────┤
│                                       │
│                                       │
│     ⚡ Creating Your Automation       │
│                                       │
│                                       │
│  ✓ Captured 12 actions               │
│    with voice annotations             │
│                                       │
│  ✓ Analyzed page interactions        │
│    and UI elements                    │
│                                       │
│  ⟳ Understanding workflow intent...   │
│    ▓▓▓▓▓▓▓▓░░░░░░░░░░ 40%           │
│                                       │
│  ○ Creating adaptable automation     │
│                                       │
│  ○ Optimizing for reliability        │
│                                       │
│                                       │
│  This usually takes 10-20 seconds    │
│                                       │
│         [ Cancel ]                    │
│                                       │
└──────────────────────────────────────┘
```

### 5. Recording Detail View
```
┌──────────────────────────────────────┐
│ ← Back     Email Cleanup        ⋮    │
├──────────────────────────────────────┤
│                                       │
│  ┌─────────────────────────────┐     │
│  │      ▶ Run Now               │     │
│  └─────────────────────────────┘     │
│                                       │
│  Workflow Steps                       │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ 1. Navigate to Gmail         │     │
│  │    ┌──────────┐              │     │
│  │    │[screenshot]│ gmail.com   │     │
│  │    └──────────┘              │     │
│  │    💬 "Open my inbox"        │     │
│  │    ~0.5s                     │     │
│  └─────────────────────────────┘     │
│            ↓                          │
│  ┌─────────────────────────────┐     │
│  │ 2. Click Promotions Tab      │     │
│  │    ┌──────────┐              │     │
│  │    │[screenshot]│ Tab click   │     │
│  │    └──────────┘              │     │
│  │    💬 "Find marketing emails"│     │
│  │    ~0.3s                     │     │
│  └─────────────────────────────┘     │
│            ↓                          │
│  ┌─────────────────────────────┐     │
│  │ 3. Open First Email          │     │
│  │    [+] Show details           │     │
│  └─────────────────────────────┘     │
│                                       │
│  ──────────────────────────────      │
│  Created: Today at 2:30 PM           │
│  Last run: 2 hours ago (Success)     │
│  Total runs: 5                        │
│  Success rate: 80%                   │
│  Avg duration: 1:23                  │
└──────────────────────────────────────┘
```

### 6. Execution Screen
```
┌──────────────────────────────────────┐
│ Running: Email Cleanup    [■ Stop]   │
├──────────────────────────────────────┤
│                                       │
│  Step 3 of 5                          │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░ 60%          │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ✅ Navigate to Gmail         │     │
│  │    Completed in 0.8s         │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ✅ Click Promotions Tab      │     │
│  │    Found 23 promotional emails│     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ ⟳ Opening email...           │     │
│  │ ┌──────────────────────┐     │     │
│  │ │                       │     │     │
│  │ │   [Live Screenshot]   │     │     │
│  │ │                       │     │     │
│  │ └──────────────────────┘     │     │
│  │                              │     │
│  │ Looking for unsubscribe link...│    │
│  └─────────────────────────────┘     │
│                                       │
│  ○ Click unsubscribe                 │
│  ○ Confirm unsubscription            │
│                                       │
│         [ Minimize ]                  │
└──────────────────────────────────────┘
```

### 7. Execution Summary
```
┌──────────────────────────────────────┐
│ Workflow Complete                     │
├──────────────────────────────────────┤
│                                       │
│     ✅ Success                        │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ Email Cleanup                │     │
│  │                              │     │
│  │ Duration: 1:18               │     │
│  │ Steps completed: 5/5         │     │
│  │                              │     │
│  │ Results:                     │     │
│  │ • Unsubscribed from 3 lists  │     │
│  │ • Deleted 15 emails          │     │
│  │ • Marked 8 as spam           │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │       Run Again               │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │      View Details             │     │
│  └─────────────────────────────┘     │
│                                       │
│         [ Done ]                      │
│                                       │
└──────────────────────────────────────┘
```

### 7b. Execution Summary - Failure
```
┌──────────────────────────────────────┐
│ Workflow Stopped                      │
├──────────────────────────────────────┤
│                                       │
│     ⚠️ Partial Success                │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ Email Cleanup                │     │
│  │                              │     │
│  │ Duration: 0:45               │     │
│  │ Steps completed: 3/5         │     │
│  │                              │     │
│  │ Failed at Step 4:            │     │
│  │ "Could not find unsubscribe  │     │
│  │  link on this email"         │     │
│  │                              │     │
│  │ Completed:                   │     │
│  │ • Navigated to Gmail ✓       │     │
│  │ • Found promotional tab ✓    │     │
│  │ • Opened first email ✓       │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │    Continue Manually          │     │
│  └─────────────────────────────┘     │
│                                       │
│  ┌─────────────────────────────┐     │
│  │       Try Again               │     │
│  └─────────────────────────────┘     │
│                                       │
└──────────────────────────────────────┘
```

### Component Details

#### Recording Card Component
```
┌─────────────────────────────┐
│ [emoji] Title               │ ← Hover: border-primary/50
│ Description line            │ ← text-muted-foreground
│                             │
│ X steps • X:XX • time ago  │ ← text-xs text-muted
│ ━━━━━━━━━━━━━━━━━━ [✅/❌]  │ ← Progress bar
└─────────────────────────────┘
  Long press → Delete modal
```

#### Step Card Component
```
┌─────────────────────────────┐
│ Step N • timestamp          │ ← text-xs text-muted
│ ┌─────┐ Action description │
│ │ 📷  │ Element/URL info    │ ← Thumbnail
│ └─────┘                     │
│ 💬 "Voice annotation"       │ ← italic text-muted
└─────────────────────────────┘
        ↓                      ← Connector line
```

#### Voice Indicator States
```
Idle:       🎤 (gray)
Listening:  🎤 ～～～ (red, animated)
Processing: 🎤 ••• (blue, pulsing)
```

#### Recording Header States
```
Not Recording: [ ⚪ Teach ]
Recording:     [ ● Recording 00:42  ■ Stop ] (red bg)
Processing:    [ ⟳ Processing... ] (blue)
```

## Interactive Elements

### Buttons
```
Primary:   ┌─────────────────┐
           │  Action Text    │  bg-primary text-primary-foreground
           └─────────────────┘

Secondary: ┌─────────────────┐
           │  Action Text    │  bg-background border-border
           └─────────────────┘

Ghost:     [ Action Text ]     hover:bg-accent

Danger:    ┌─────────────────┐
           │  Delete         │  bg-destructive
           └─────────────────┘
```

### Transitions Between Screens
```
Home → Intent:      Slide left
Intent → Recording: Slide left with red border fade-in
Recording → Process: Crossfade
Process → Detail:   Slide left
Detail → Execution: Fade with scale
Execution → Summary: Slide up from bottom
```

## Next Steps
1. Review and refine this design document ✓
2. Create UI sketches ✓
3. Build core view components starting with TeachModeHome
4. Implement teachmode.store.ts with Zustand
5. Move existing components to new structure
6. Integrate with Chrome extension background script
7. Add Chrome browserOS API implementations
8. Create visual timeline with screenshot capture
9. Implement AI processing pipeline
10. Test end-to-end workflow
