// Scoring weights
export const SCORE_WEIGHTS = {
  goalCompletion: 0.40,    // 40% - Most important
  planCorrectness: 0.30,   // 30% - Plan quality
  errorFreeExecution: 0.15,      // 15% - Error handling (renamed per NTN feedback)
  contextEfficiency: 0.15  // 15% - Efficiency
} as const;

// Default scoring model
export const DEFAULT_SCORING_MODEL = "gpt-4o-mini";

// Gemini 2.5 Pro configuration (hardcoded for evals2)
export const GEMINI_SCORING_CONFIG = {
  provider: 'google_gemini',
  modelId: 'gemini-2.5-pro',
  temperature: 0,
  maxTokens: 8192,  // Output tokens for scoring
  contextWindow: 2000000  // 2M token context
} as const;

// Time buckets for plan efficiency scoring (in milliseconds)
// NTN: Using 10-point scale for finer granularity
export const TIME_EFFICIENCY_BUCKETS = {
  perfect: 30000,       // < 30s = 10
  exceptional: 60000,   // < 1 min = 9
  excellent: 120000,    // < 2 min = 8
  veryGood: 180000,     // < 3 min = 7
  good: 240000,         // < 4 min = 6
  average: 300000,      // < 5 min = 5
  belowAverage: 360000, // < 6 min = 4
  poor: 480000,         // < 8 min = 3
  veryPoor: 600000,     // < 10 min = 2
  terrible: Infinity    // > 10 min = 1
} as const;

// Environment variable names (for reference)
export const ENV_VARS = {
  ENABLE: "ENABLE_EVALS2",
  BRAINTRUST_KEY: "BRAINTRUST_API_KEY",
  SCORING_MODEL: "OPENAI_MODEL_FOR_SCORING"
} as const;