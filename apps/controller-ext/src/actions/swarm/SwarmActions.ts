/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Swarm Actions - Chrome Extension handlers for swarm window management
 */
import { z } from 'zod'
import { ActionHandler } from '../ActionHandler'
import { swarmWindowManager, type SwarmWindow } from './SwarmWindowManager'

// ============================================================================
// Create Swarm Worker Window
// ============================================================================

const CreateSwarmWindowInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  workerId: z.string().describe('ID of the worker'),
  url: z.string().optional().describe('Initial URL to load'),
  position: z
    .object({
      left: z.number().optional(),
      top: z.number().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .optional()
    .describe('Window position and size'),
  focused: z.boolean().optional().describe('Whether to focus the window'),
  incognito: z.boolean().optional().describe('Create in incognito mode'),
})

const CreateSwarmWindowOutputSchema = z.object({
  windowId: z.number().describe('Chrome window ID'),
  tabId: z.number().describe('Chrome tab ID'),
  position: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  }),
})

type CreateSwarmWindowInput = z.infer<typeof CreateSwarmWindowInputSchema>
type CreateSwarmWindowOutput = z.infer<typeof CreateSwarmWindowOutputSchema>

export class CreateSwarmWindowAction extends ActionHandler<
  CreateSwarmWindowInput,
  CreateSwarmWindowOutput
> {
  readonly inputSchema = CreateSwarmWindowInputSchema

  async execute(input: CreateSwarmWindowInput): Promise<CreateSwarmWindowOutput> {
    return swarmWindowManager.createWorkerWindow(input)
  }
}

// ============================================================================
// Navigate Swarm Worker Window
// ============================================================================

const NavigateSwarmWindowInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  workerId: z.string().describe('ID of the worker'),
  url: z.string().describe('URL to navigate to'),
})

const NavigateSwarmWindowOutputSchema = z.object({
  success: z.boolean(),
})

type NavigateSwarmWindowInput = z.infer<typeof NavigateSwarmWindowInputSchema>
type NavigateSwarmWindowOutput = z.infer<typeof NavigateSwarmWindowOutputSchema>

export class NavigateSwarmWindowAction extends ActionHandler<
  NavigateSwarmWindowInput,
  NavigateSwarmWindowOutput
> {
  readonly inputSchema = NavigateSwarmWindowInputSchema

  async execute(input: NavigateSwarmWindowInput): Promise<NavigateSwarmWindowOutput> {
    await swarmWindowManager.navigateWorkerWindow(
      input.swarmId,
      input.workerId,
      input.url
    )
    return { success: true }
  }
}

// ============================================================================
// Focus Swarm Worker Window
// ============================================================================

const FocusSwarmWindowInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  workerId: z.string().describe('ID of the worker'),
})

const FocusSwarmWindowOutputSchema = z.object({
  success: z.boolean(),
})

type FocusSwarmWindowInput = z.infer<typeof FocusSwarmWindowInputSchema>
type FocusSwarmWindowOutput = z.infer<typeof FocusSwarmWindowOutputSchema>

export class FocusSwarmWindowAction extends ActionHandler<
  FocusSwarmWindowInput,
  FocusSwarmWindowOutput
> {
  readonly inputSchema = FocusSwarmWindowInputSchema

  async execute(input: FocusSwarmWindowInput): Promise<FocusSwarmWindowOutput> {
    await swarmWindowManager.focusWorkerWindow(input.swarmId, input.workerId)
    return { success: true }
  }
}

// ============================================================================
// Close Swarm Worker Window
// ============================================================================

const CloseSwarmWindowInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  workerId: z.string().describe('ID of the worker'),
})

const CloseSwarmWindowOutputSchema = z.object({
  success: z.boolean(),
})

type CloseSwarmWindowInput = z.infer<typeof CloseSwarmWindowInputSchema>
type CloseSwarmWindowOutput = z.infer<typeof CloseSwarmWindowOutputSchema>

export class CloseSwarmWindowAction extends ActionHandler<
  CloseSwarmWindowInput,
  CloseSwarmWindowOutput
> {
  readonly inputSchema = CloseSwarmWindowInputSchema

  async execute(input: CloseSwarmWindowInput): Promise<CloseSwarmWindowOutput> {
    await swarmWindowManager.closeWorkerWindow(input.swarmId, input.workerId)
    return { success: true }
  }
}

// ============================================================================
// Terminate Swarm (Close All Windows)
// ============================================================================

const TerminateSwarmInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm to terminate'),
})

const TerminateSwarmOutputSchema = z.object({
  success: z.boolean(),
  closedWindows: z.number().describe('Number of windows closed'),
})

type TerminateSwarmInput = z.infer<typeof TerminateSwarmInputSchema>
type TerminateSwarmOutput = z.infer<typeof TerminateSwarmOutputSchema>

export class TerminateSwarmAction extends ActionHandler<
  TerminateSwarmInput,
  TerminateSwarmOutput
> {
  readonly inputSchema = TerminateSwarmInputSchema

  async execute(input: TerminateSwarmInput): Promise<TerminateSwarmOutput> {
    const windows = swarmWindowManager.getSwarmWindows(input.swarmId)
    const closedWindows = windows.length
    await swarmWindowManager.terminateSwarm(input.swarmId)
    return { success: true, closedWindows }
  }
}

// ============================================================================
// Arrange Swarm Windows
// ============================================================================

const ArrangeSwarmWindowsInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  layout: z
    .enum(['grid', 'cascade', 'tile'])
    .optional()
    .default('grid')
    .describe('Layout arrangement'),
})

const ArrangeSwarmWindowsOutputSchema = z.object({
  success: z.boolean(),
})

type ArrangeSwarmWindowsInput = z.infer<typeof ArrangeSwarmWindowsInputSchema>
type ArrangeSwarmWindowsOutput = z.infer<typeof ArrangeSwarmWindowsOutputSchema>

export class ArrangeSwarmWindowsAction extends ActionHandler<
  ArrangeSwarmWindowsInput,
  ArrangeSwarmWindowsOutput
> {
  readonly inputSchema = ArrangeSwarmWindowsInputSchema

  async execute(input: ArrangeSwarmWindowsInput): Promise<ArrangeSwarmWindowsOutput> {
    await swarmWindowManager.arrangeSwarmWindows(input.swarmId, input.layout)
    return { success: true }
  }
}

// ============================================================================
// Get Swarm Windows Status
// ============================================================================

const GetSwarmWindowsInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
})

const SwarmWindowSchema = z.object({
  windowId: z.number(),
  tabId: z.number(),
  swarmId: z.string(),
  workerId: z.string(),
  createdAt: z.number(),
  state: z.enum(['active', 'minimized', 'focused']),
  position: z.object({
    left: z.number(),
    top: z.number(),
    width: z.number(),
    height: z.number(),
  }),
})

const GetSwarmWindowsOutputSchema = z.object({
  windows: z.array(SwarmWindowSchema),
})

type GetSwarmWindowsInput = z.infer<typeof GetSwarmWindowsInputSchema>
type GetSwarmWindowsOutput = z.infer<typeof GetSwarmWindowsOutputSchema>

export class GetSwarmWindowsAction extends ActionHandler<
  GetSwarmWindowsInput,
  GetSwarmWindowsOutput
> {
  readonly inputSchema = GetSwarmWindowsInputSchema

  async execute(input: GetSwarmWindowsInput): Promise<GetSwarmWindowsOutput> {
    const windows = swarmWindowManager.getSwarmWindows(input.swarmId)
    return { windows }
  }
}

// ============================================================================
// Capture Worker Screenshot
// ============================================================================

const CaptureSwarmScreenshotInputSchema = z.object({
  swarmId: z.string().describe('ID of the swarm'),
  workerId: z.string().describe('ID of the worker'),
})

const CaptureSwarmScreenshotOutputSchema = z.object({
  dataUrl: z.string().describe('Base64 encoded PNG screenshot'),
})

type CaptureSwarmScreenshotInput = z.infer<typeof CaptureSwarmScreenshotInputSchema>
type CaptureSwarmScreenshotOutput = z.infer<typeof CaptureSwarmScreenshotOutputSchema>

export class CaptureSwarmScreenshotAction extends ActionHandler<
  CaptureSwarmScreenshotInput,
  CaptureSwarmScreenshotOutput
> {
  readonly inputSchema = CaptureSwarmScreenshotInputSchema

  async execute(
    input: CaptureSwarmScreenshotInput
  ): Promise<CaptureSwarmScreenshotOutput> {
    const dataUrl = await swarmWindowManager.captureWorkerScreenshot(
      input.swarmId,
      input.workerId
    )
    return { dataUrl }
  }
}

// ============================================================================
// Get Swarm Stats
// ============================================================================

const GetSwarmStatsInputSchema = z.object({})

const GetSwarmStatsOutputSchema = z.object({
  totalSwarms: z.number(),
  totalWindows: z.number(),
  swarmDetails: z.array(
    z.object({
      swarmId: z.string(),
      windowCount: z.number(),
    })
  ),
})

type GetSwarmStatsInput = z.infer<typeof GetSwarmStatsInputSchema>
type GetSwarmStatsOutput = z.infer<typeof GetSwarmStatsOutputSchema>

export class GetSwarmStatsAction extends ActionHandler<
  GetSwarmStatsInput,
  GetSwarmStatsOutput
> {
  readonly inputSchema = GetSwarmStatsInputSchema

  async execute(_input: GetSwarmStatsInput): Promise<GetSwarmStatsOutput> {
    return swarmWindowManager.getStats()
  }
}
