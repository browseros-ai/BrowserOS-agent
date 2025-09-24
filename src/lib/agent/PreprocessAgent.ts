import { z } from "zod";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getLLM } from "@/lib/llm/LangChainProvider";
import { Logging } from "@/lib/utils/Logging";
import { invokeWithRetry } from "@/lib/utils/retryable";
import {
  TeachModeRecordingSchema,
  SemanticWorkflowSchema,
  type TeachModeRecording,
  type SemanticWorkflow,
  type CapturedEvent,
  type StateSnapshot,
  type ActionType
} from "@/lib/teach-mode/types";

// Internal schemas for LLM responses - aligned with SemanticWorkflow structure
const EventAnalysisSchema = z.object({
  intent: z.string(),  // What the step accomplishes
  actionDescription: z.string(),  // Human-readable description
  nodeIdentificationStrategy: z.string().optional().nullable(),  // Element identification guidance
  validationStrategy: z.string(),  // How to verify completion
  timeoutMs: z.number().default(5000)  // Suggested timeout
});

const GoalExtractionSchema = z.object({
  workflowDescription: z.string(),  // Summary of the demonstrated workflow
  userGoal: z.string()  // What the user wants the agent to accomplish
});

type EventAnalysis = z.infer<typeof EventAnalysisSchema>;
type GoalExtraction = z.infer<typeof GoalExtractionSchema>;

import {
  generateEventAnalysisPrompt,
  generateGoalExtractionPrompt
} from "./PreprocessAgent.prompt";

/**
 * PreprocessAgent converts TeachModeRecording into SemanticWorkflow
 * by analyzing individual events sequentially with LLM processing
 */
export class PreprocessAgent {
  private goalExtracted: GoalExtraction | null = null;

  constructor() {
    Logging.log("PreprocessAgent", "Agent instance created", "info");
  }

  /**
   * Main processing method to convert recording to workflow
   */
  async processRecording(recording: TeachModeRecording): Promise<SemanticWorkflow> {
    try {
      const validatedRecording = TeachModeRecordingSchema.parse(recording);
      console.log("validatedRecording", validatedRecording)

      Logging.log("PreprocessAgent", `Processing recording with ${validatedRecording.events.length} events`, "info");

      // Extract overall goal from narration
      this.goalExtracted = await this._extractGoalFromNarration(validatedRecording.narration?.transcript || "");

      // Process each event sequentially
      const steps: SemanticWorkflow['steps'] = [];
      let previousState: StateSnapshot | undefined;

      for (let i = 0; i < validatedRecording.events.length; i++) {
        const event = validatedRecording.events[i];

        // Skip session_start and session_end events
        if (event.action.type === 'session_start' || event.action.type === 'session_end') {
          previousState = event.state;
          continue;
        }

        Logging.log("PreprocessAgent", `Processing event ${i + 1}/${validatedRecording.events.length}: ${event.action.type}`, "info");

        try {
          // Build current workflow progress summary
          const currentProgress = steps.length > 0
            ? steps.map((s, idx) => `${idx + 1}. ${s.intent}`).join('; ')
            : "This is the first action in the workflow.";

          const step = await this._processEvent(
            event,
            i + 1,
            validatedRecording.events.length,
            this.goalExtracted?.workflowDescription || "",
            previousState,
            currentProgress
          );
          steps.push(step);

          // Update previous state for next iteration
          previousState = event.state;

        } catch (error) {
          Logging.log("PreprocessAgent", `Failed to process event ${i + 1}: ${error}`, "warning");
          // Continue processing other events
        }
      }

      // Create final workflow
      const workflow: SemanticWorkflow = {
        metadata: {
          recordingId: validatedRecording.session.id,
          goal: this.goalExtracted?.userGoal || "No specific goal provided",
          description: this.goalExtracted?.workflowDescription,
          createdAt: Date.now(),
          duration: validatedRecording.session.endTimestamp ?
            validatedRecording.session.endTimestamp - validatedRecording.session.startTimestamp : undefined
        },
        steps
      };

      Logging.log("PreprocessAgent", `Successfully created workflow with ${steps.length} steps`, "info");
      return SemanticWorkflowSchema.parse(workflow);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      Logging.log("PreprocessAgent", `Processing failed: ${errorMessage}`, "error");
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
    workflowDescription: string,
    previousState: StateSnapshot | undefined,
    currentWorkflowProgress: string
  ): Promise<SemanticWorkflow['steps'][0]> {
    try {
      // Analyze event with LLM
      const analysis = await this._analyzeEventWithLLM(event, actionIndex, totalActions, workflowDescription, currentWorkflowProgress, previousState);

      // Convert analysis to semantic step
      const step: SemanticWorkflow['steps'][0] = {
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
        stateAfter: event.state
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
    workflowDescription: string,
    currentWorkflowProgress: string,
    previousState?: StateSnapshot
  ): Promise<EventAnalysis> {
    try {
      // Get LLM with structured output
      console.log("event", event)
      const llm = await getLLM({
        temperature: 0.3,
        maxTokens: 2048
      });
      console.log("llm", llm)
      const structuredLLM = llm.withStructuredOutput(EventAnalysisSchema);

      // Build multi-message context for LLM
      const systemPrompt = generateEventAnalysisPrompt();

      const workflowAndActionMessage = this._buildWorkflowAndActionMessage(
        event,
        workflowDescription,
        actionIndex,
        totalActions,
        currentWorkflowProgress
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
    workflowDescription: string,
    actionIndex: number,
    totalActions: number,
    currentWorkflowProgress: string
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
## Workflow Context
- **Overall Workflow Description**: ${workflowDescription || "No workflow description provided"}
- **Action Position**: Action ${actionIndex} of ${totalActions}
- **Progress So Far**: ${currentWorkflowProgress}

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
   * Extract goal from narration transcript
   */
  private async _extractGoalFromNarration(transcript: string): Promise<GoalExtraction> {
    try {
      if (!transcript.trim()) {
        return {
          workflowDescription: "",
          userGoal: "Perform the same workflow as demonstrated by the user"
        };
      }
      console.log("transcript", transcript)
      const llm = await getLLM({
        temperature: 0.2,
        maxTokens: 512
      });
      console.log("llm", llm)
      const structuredLLM = llm.withStructuredOutput(GoalExtractionSchema);

      const systemPrompt = generateGoalExtractionPrompt();
      const userPrompt = `Transcript: "${transcript}"`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt)
      ];

      const response = await invokeWithRetry<GoalExtraction>(structuredLLM, messages, 3);

      return response;

    } catch (error) {
      Logging.log("PreprocessAgent", `Goal extraction failed: ${error}`, "warning");
      return {
        workflowDescription: "",
        userGoal: "Perform the same workflow as demonstrated by the user"
      };
    }
  }

}