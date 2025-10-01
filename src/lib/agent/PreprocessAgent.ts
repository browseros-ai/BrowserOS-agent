import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { Logging } from "@/lib/utils/Logging";
import { invokeWithRetry } from "@/lib/utils/retryable";
import { PubSubChannel } from "@/lib/pubsub/PubSubChannel";
import {
  TeachModeRecordingSchema,
  SemanticWorkflowSchema,
  type TeachModeRecording,
  type SemanticWorkflow,
  type CapturedEvent,
  type StateSnapshot
} from "@/lib/teach-mode/types";

// Internal schemas for LLM responses - aligned with SemanticWorkflow structure
const EventAnalysisSchema = z.object({
  intent: z.string(),  // What the step accomplishes
  actionDescription: z.string(),  // Human-readable description
  nodeIdentificationStrategy: z.string().optional().nullable(),  // Element identification guidance
  validationStrategy: z.string(),  // How to verify completion
  timeoutMs: z.number().default(5000),  // Suggested timeout
  updatedWorkflowSummary: z.string()  // Updated summary including this action
});

const WorkflowMetadataSchema = z.object({
  workflowDescription: z.string(),  // Summary of the demonstrated workflow
  userGoal: z.string(),  // What the user wants the agent to accomplish
  workflowName: z.string()  // Concise 2-3 word workflow name
});

type EventAnalysis = z.infer<typeof EventAnalysisSchema>;
type WorkflowMetadata = z.infer<typeof WorkflowMetadataSchema>;

import {
  generateEventAnalysisPrompt,
  generateWorkflowMetadataPrompt
} from "./PreprocessAgent.prompt";
import { isDevelopmentMode } from "@/config";

/**
 * PreprocessAgent converts TeachModeRecording into SemanticWorkflow
 * by analyzing individual events sequentially with LLM processing
 */
export class PreprocessAgent {
  private pubsub: PubSubChannel | null = null;
  private sessionId: string | null = null;

  constructor(pubsub?: PubSubChannel, sessionId?: string) {
    this.pubsub = pubsub || null;
    this.sessionId = sessionId || null;
    Logging.log("PreprocessAgent", "Agent instance created", "info");
  }

  /**
   * Main processing method to convert recording to workflow
   */
  async processRecording(recording: TeachModeRecording): Promise<SemanticWorkflow> {
    try {
      const validatedRecording = TeachModeRecordingSchema.parse(recording);
      const totalEvents = validatedRecording.events.length;
      Logging.log("PreprocessAgent", `Processing recording with ${totalEvents} events`, "info");

      // Emit preprocessing started
      this._emitProgress('preprocessing_started', {
        totalEvents: totalEvents
      });

      // Transcribe audio if present and narration not already set
      let transcript = validatedRecording.narration?.transcript || "";
      if (!transcript && validatedRecording.audio) {
        Logging.log("PreprocessAgent", "Transcribing audio recording...", "info");

        this._emitProgress('preprocessing_progress', {
          stage: 'transcription',
          current: 0,
          total: totalEvents,
          message: 'Transcribing audio narration...'
        });

        try {
          transcript = await this._transcribeAudio(validatedRecording.audio);
          Logging.log("PreprocessAgent", `Transcription complete: ${transcript.length} characters`, "info");

          // Log metric for successful transcription
          Logging.logMetric('teachmode.transcription.completed', {
            transcriptLength: transcript.length,
            success: true
          }).catch(() => {
            // Metric logging failed, continue
          });

          // Emit debug info for transcript
          this._emitDebug('Transcript extracted', transcript);

          this._emitProgress('preprocessing_progress', {
            stage: 'transcription',
            current: 0,
            total: totalEvents,
            message: 'Transcription completed',
            transcript
          });
        } catch (error) {
          Logging.log("PreprocessAgent", `Transcription failed: ${error}`, "warning");

          // Log metric for failed transcription
          Logging.logMetric('teachmode.transcription.completed', {
            transcriptLength: 0,
            success: false
          }).catch(() => {
            // Metric logging failed, continue
          });

          this._emitProgress('preprocessing_progress', {
            stage: 'transcription',
            current: 0,
            total: totalEvents,
            message: 'Continuing without transcription',
            error: String(error)
          });
        }
      }

      // Process each event sequentially
      const steps: SemanticWorkflow['steps'] = [];
      let previousState: StateSnapshot | undefined;
      let currentWorkflowSummary = "This is the first action in the workflow.";

      let processedCount = 0;
      for (let i = 0; i < validatedRecording.events.length; i++) {
        const event = validatedRecording.events[i];

        // Skip session_start and session_end events
        // if (event.action.type === 'session_start' || event.action.type === 'session_end') {
        //   previousState = event.state;
        //   continue;
        // }

        processedCount++;
        Logging.log("PreprocessAgent", `Processing event ${processedCount}/${totalEvents}: ${event.action.type}`, "info");

        // Emit progress for event processing stage
        this._emitProgress('preprocessing_progress', {
          stage: 'event_processing',
          current: processedCount,
          total: totalEvents,
          actionType: event.action.type,
          message: `Processing ${event.action.type} (${processedCount}/${totalEvents})`
        });

        try {
          const step = await this._processEvent(
            event,
            processedCount,
            totalEvents,
            transcript,
            previousState,
            currentWorkflowSummary
          );
          steps.push(step);

          // Update workflow summary from the LLM's updated summary for next iteration
          currentWorkflowSummary = (step as any).updatedWorkflowSummary || currentWorkflowSummary;

          // Update previous state for next iteration
          previousState = event.state;

        } catch (error) {
          Logging.log("PreprocessAgent", `Failed to process event ${processedCount}: ${error}`, "warning");
          // Continue processing other events
        }
      }

      // Generate workflow metadata (description, goal, name) based on all steps
      Logging.log("PreprocessAgent", `Generating workflow metadata with ${steps.length} steps and transcript: ${transcript ? 'available' : 'none'}`, "info");
      const metadata = await this._generateWorkflowMetadata(transcript, steps);
      Logging.log("PreprocessAgent", `Generated workflow metadata - Name: "${metadata.workflowName}", Goal: "${metadata.userGoal}"`, "info");

      // Emit debug info for metadata
      this._emitDebug('Workflow metadata generated', metadata);

      // Create final workflow
      const workflow: SemanticWorkflow = {
        metadata: {
          recordingId: validatedRecording.session.id,
          name: metadata.workflowName,
          goal: metadata.userGoal,
          description: metadata.workflowDescription,
          transcript: transcript || undefined,
          createdAt: Date.now(),
          duration: validatedRecording.session.endTimestamp ?
            validatedRecording.session.endTimestamp - validatedRecording.session.startTimestamp : undefined
        },
        steps
      };

      Logging.log("PreprocessAgent", `Successfully created workflow with ${steps.length} steps`, "info");

      // Emit debug info for final workflow
      this._emitDebug('Workflow created', {
        name: workflow.metadata.name,
        goal: workflow.metadata.goal,
        description: workflow.metadata.description,
        totalSteps: workflow.steps.length,
        stepIntents: workflow.steps.map(s => s.intent)
      });

      // Count action types from the recording
      const actionTypeCounts: Record<string, number> = {};
      validatedRecording.events.forEach(event => {
        const actionType = event.action.type;
        actionTypeCounts[actionType] = (actionTypeCounts[actionType] || 0) + 1;
      });

      // Log metric for preprocessing completion
      Logging.logMetric('teachmode.preprocessing.completed', {
        eventsCount: validatedRecording.events.length,
        stepsGenerated: steps.length,
        workflowGoal: workflow.metadata.goal,
        hasTranscript: !!transcript,
        transcript: transcript || undefined,
        actionTypeCounts,
        steps: workflow.steps.map(s => ({
          intent: s.intent,
          type: s.action.type
        }))
      }).catch(() => {
        // Metric logging failed, continue
      });

      // Emit preprocessing completed
      this._emitProgress('preprocessing_completed', {
        workflowName: workflow.metadata.name,
        totalSteps: steps.length
      });

      return SemanticWorkflowSchema.parse(workflow);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("PreprocessAgent", `Processing failed: ${errorMessage}`, "error");

      // Emit preprocessing failed
      this._emitProgress('preprocessing_failed', {
        error: errorMessage
      });

      throw new Error(`Failed to process recording: ${errorMessage}`);
    }
  }

  /**
   * Process a single captured event into a semantic step
   */
  private async _processEvent(
    event: CapturedEvent,
    actionIndex: number,
    totalActions: number,
    narration: string,
    previousState: StateSnapshot | undefined,
    currentWorkflowSummary: string
  ): Promise<SemanticWorkflow['steps'][0]> {
    try {
      // Analyze event with LLM
      const analysis = await this._analyzeEventWithLLM(event, actionIndex, totalActions, narration, currentWorkflowSummary, previousState);

      // Convert analysis to semantic step (store updated summary temporarily)
      const step: SemanticWorkflow['steps'][0] & { updatedWorkflowSummary?: string } = {
        id: `step-${actionIndex}`,
        intent: analysis.intent,
        action: {
          type: event.action.type,
          description: analysis.actionDescription,
          nodeIdentificationStrategy: ['click', 'input', 'type', 'change'].includes(event.action.type)
            ? analysis.nodeIdentificationStrategy
            : undefined,
          validationStrategy: analysis.validationStrategy,
          timeoutMs: analysis.timeoutMs
        },
        sourceEventIds: [event.id],
        stateBefore: previousState,
        stateAfter: event.state,
        updatedWorkflowSummary: analysis.updatedWorkflowSummary
      };

      return step;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("PreprocessAgent", `Event analysis failed: ${errorMessage}`, "error");
      throw new Error(`Failed to analyze event: ${errorMessage}`);
    }
  }

  /**
   * Analyze event with LLM to extract semantic information
   */
  private async _analyzeEventWithLLM(
    event: CapturedEvent,
    actionIndex: number,
    totalActions: number,
    narration: string,
    currentWorkflowSummary: string,
    previousState?: StateSnapshot
  ): Promise<EventAnalysis> {
    try {
      // Get LLM with structured output
      this._emitDebug(`Analyzing event ${actionIndex}`, {
        actionType: event.action.type,
        eventId: event.id,
        targetElement: event.target?.element?.tagName || 'none'
      });
      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 2048
      });
      const structuredLLM = llm.withStructuredOutput(EventAnalysisSchema);

      // Build multi-message context for LLM
      const systemPrompt = generateEventAnalysisPrompt();

      const workflowAndActionMessage = this._buildWorkflowAndActionMessage(
        event,
        narration,
        actionIndex,
        totalActions,
        currentWorkflowSummary
      );

      const beforeStateMessage = this._buildStateMessage("BEFORE", previousState);
      const afterStateMessage = this._buildStateMessage("AFTER", event.state);

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(workflowAndActionMessage),
        new HumanMessage(beforeStateMessage),
        new HumanMessage(afterStateMessage)
      ];

      // Get structured response with retry
      const analysis = await invokeWithRetry<EventAnalysis>(
        structuredLLM,
        messages,
        3
      );

      return analysis;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("PreprocessAgent", `LLM analysis failed: ${errorMessage}`, "error");
      throw new Error(`LLM analysis failed: ${errorMessage}`);
    }
  }

  /**
   * Build workflow context and action info message
   */
  private _buildWorkflowAndActionMessage(
    event: CapturedEvent,
    narration: string,
    actionIndex: number,
    totalActions: number,
    currentWorkflowSummary: string
  ): string {
    // Extract action details by traversing all action properties
    const actionDetails: string[] = [];

    Object.entries(event.action).forEach(([key, value]) => {
      if (key !== 'type' && value !== undefined && value !== null) {
        if (typeof value === 'object') {
          actionDetails.push(`${key}: ${JSON.stringify(value)}`);
        } else {
          actionDetails.push(`${key}: ${value}`);
        }
      }
    });

    const actionInfo = actionDetails.length > 0 ? actionDetails.join(', ') : "No additional action data";

    return `
## User Narration
${narration ? `"${narration}"` : "(No narration provided)"}

## Action Context
- **Position**: Action ${actionIndex} of ${totalActions}
- **Previous Actions**: ${currentWorkflowSummary}

## Current Action Details
- **Action Type**: ${event.action.type.toUpperCase()}
- **Action Data**: ${actionInfo}
- **Target Element**: ${event.target ? `${event.target.element.tagName} with text "${event.target.element.text || 'N/A'}"` : "No target specified"}
`;
  }

  /**
   * Build state message with screenshot
   */
  private _buildStateMessage(stateType: "BEFORE" | "AFTER", state?: StateSnapshot): string {
    if (!state) {
      return `
## ${stateType} State
- **State**: No state information available for ${stateType.toLowerCase()} action
`;
    }

    return `
## ${stateType} State
- **URL**: ${state.page.url}
- **Title**: ${state.page.title}
- **Timestamp**: ${new Date(state.timestamp).toISOString()}
- **Interactive Elements**: ${state.browserState?.string || 'No browser state available'}
- **Screenshot**: ${state.screenshot ? `[Base64 image data: ${state.screenshot.substring(0, 50)}...]` : 'No screenshot available'}
`;
  }

  /**
   * Emit progress event via PubSub
   */
  private _emitProgress(
    eventType: 'preprocessing_started' | 'preprocessing_progress' | 'preprocessing_completed' | 'preprocessing_failed',
    data: any
  ): void {
    if (!this.pubsub || !this.sessionId) return;

    this.pubsub.publishTeachModeEvent({
      eventType,
      sessionId: this.sessionId,
      data
    });
  }

  /**
   * Emit debug information in development mode
   */
  private _emitDebug(action: string, details?: any, maxLength: number = 200): void {
    if (!isDevelopmentMode()) return;

    let message = `[PreprocessAgent] ${action}`;
    if (details !== undefined && details !== null) {
      let detailString: string;
      if (typeof details === 'object') {
        detailString = JSON.stringify(details, null, 2);
      } else {
        detailString = String(details);
      }

      if (detailString.length > maxLength) {
        detailString = detailString.substring(0, maxLength) + '...';
      }
      message = `${message}: ${detailString}`;
    }

    // Emit as preprocessing_progress event in dev mode
    this._emitProgress('preprocessing_progress', {
      stage: 'debug',
      message,
      timestamp: Date.now()
    });

    // Also log to console for development
    Logging.log("PreprocessAgent", message, "info");
  }

  /**
   * Generate comprehensive workflow metadata (description, goal, name) from completed steps
   */
  private async _generateWorkflowMetadata(
    narration: string,
    steps: SemanticWorkflow['steps']
  ): Promise<WorkflowMetadata> {
    try {
      // If no steps processed, return simple defaults
      if (steps.length === 0) {
        const date = new Date();
        const timeStr = date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        return {
          workflowDescription: "No actions were recorded",
          userGoal: "No specific goal provided",
          workflowName: `Workflow ${timeStr}`
        };
      }

      this._emitDebug('Generating workflow metadata', {
        stepCount: steps.length,
        hasNarration: !!narration
      });

      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 1024
      });
      const structuredLLM = llm.withStructuredOutput(WorkflowMetadataSchema);

      const systemPrompt = generateWorkflowMetadataPrompt();

      // Build step summary for the prompt
      const stepSummary = steps.map((step, idx) =>
        `${idx + 1}. ${step.intent} (${step.action.type}${step.action.nodeIdentificationStrategy ? `: ${step.action.nodeIdentificationStrategy}` : ''})`
      ).join('\n');

      const userPrompt = `
Narration: ${narration || "(No narration provided)"}

Workflow Steps:
${stepSummary}
`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ];

      const response = await invokeWithRetry<WorkflowMetadata>(structuredLLM, messages, 3);

      return response;

    } catch (error) {
      Logging.log("PreprocessAgent", `Workflow metadata generation failed: ${error}`, "warning");

      // Fallback: Generate simple metadata from steps
      const lastStep = steps[steps.length - 1];
      const finalState = lastStep.stateAfter || lastStep.stateBefore;

      let workflowName = "Browser Workflow";
      if (finalState?.page?.url) {
        try {
          const url = new URL(finalState.page.url);
          const domain = url.hostname.replace('www.', '').split('.')[0];
          const domainName = domain.charAt(0).toUpperCase() + domain.slice(1);
          const date = new Date();
          const timeStr = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          workflowName = `${domainName} ${timeStr}`;
        } catch {
          // URL parsing failed, use default
        }
      }

      return {
        workflowDescription: `The user performed ${steps.length} actions including: ${steps.map(s => s.intent).slice(0, 3).join(', ')}${steps.length > 3 ? '...' : ''}.`,
        userGoal: narration || "Perform the same workflow as demonstrated",
        workflowName
      };
    }
  }

  /**
   * Transcribe audio recording to text
   */
  private async _transcribeAudio(audioBase64: string): Promise<string> {
    try {
      // Convert base64 to Blob
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });

      // Prepare FormData
      const formData = new FormData();
      formData.append('file', blob, 'recording.webm');
      formData.append('response_format', 'json');

      // Call transcription API
      const response = await fetch('https://llm.browseros.com/api/transcribe', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Transcription API error: ${response.status}`);
      }

      const data = await response.json();
      return data.text?.trim() || "";

    } catch (error) {
      Logging.log("PreprocessAgent", `Failed to transcribe: ${error}`, "error");
      throw error;
    }
  }

}
