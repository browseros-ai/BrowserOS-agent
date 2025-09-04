// Scoring weights
export const SCORE_WEIGHTS = {
  goalCompletion: 0.40,    // 40% - Most important
  planCorrectness: 0.30,   // 30% - Plan quality
  errorFreeExecution: 0.15,      // 15% - Error handling (renamed per NTN feedback)
  contextEfficiency: 0.15  // 15% - Efficiency
} as const;

// Default scoring model
export const DEFAULT_SCORING_MODEL = "gpt-4o-mini";

// Environment variable names (for reference)
export const ENV_VARS = {
  ENABLE: "ENABLE_EVALS2",
  BRAINTRUST_KEY: "BRAINTRUST_API_KEY",
  SCORING_MODEL: "OPENAI_MODEL_FOR_SCORING"
} as const;