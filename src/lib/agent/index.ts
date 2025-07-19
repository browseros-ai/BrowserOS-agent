// ==============================================
// Agent Index for Nxtscape Browser Automation
// ==============================================

/**
 * Agent exports
 */

// Base agent
export {
  BaseAgent as LangChainBaseAgent,
  AgentOptions as LangChainAgentOptions,
  AgentOptionsSchema as LangChainAgentOptionsSchema,
} from "./BaseAgent";

// Productivity agent
export {
  ProductivityAgent,
  ProductivityOutput,
  ProductivityOutputSchema,
} from "./ProductivityAgent";

// Browse agent
export { BrowseAgent, BrowseOutput, BrowseOutputSchema } from "./BrowseAgent";

// Classification agent
export {
  ClassificationAgent,
  ClassificationOutput,
  ClassificationOutputSchema,
} from "./ClassificationAgent";

// Planner agent
export { PlannerAgent } from "./PlannerAgent";

// Validator agent
export { ValidatorAgent } from "./ValidatorAgent";

// Answer agent
export { AnswerAgent, AnswerOutput, AnswerOutputSchema } from "./AnswerAgent";

// Intent prediction agent
export {
  IntentPredictionAgent,
  IntentPredictionOutput,
  IntentPredictionOutputSchema,
} from "./IntentPredictionAgent";

// Agent categories for reference
export const AGENT_TYPES = {
  PRODUCTIVITY: "productivity", // Tab management and browser operations
  NAVIGATION: "navigation", // Web navigation and automation (future)
  BROWSE: "browse", // Full web browsing automation
  ANSWER: "answer", // Question answering about web content
} as const;

/**
 * Agent descriptions for UI/documentation
 */
export const AGENT_DESCRIPTIONS = {
  [AGENT_TYPES.PRODUCTIVITY]:
    "Tab management and browser productivity features",
  [AGENT_TYPES.BROWSE]:
    "Complete web browsing automation with planning and validation",
  [AGENT_TYPES.ANSWER]: "Question answering and content analysis for web pages",
} as const;

