export interface CompactionConfig {
  contextWindow: number
}

export interface ComputedConfig {
  contextWindow: number
  reserveTokens: number
  triggerRatio: number
  triggerThreshold: number
  keepRecentTokens: number
  minSummarizableTokens: number
  maxSummarizationInput: number
  summarizerMaxOutputTokens: number
  summarizationTimeoutMs: number
  fixedOverhead: number
  safetyMultiplier: number
  imageTokenEstimate: number
}

export interface CompactionState {
  existingSummary: string | null
  compactionCount: number
}

export interface StepWithUsage {
  usage?: {
    inputTokens?: number | undefined
    outputTokens?: number | undefined
  }
}

export interface SplitPointResult {
  splitIndex: number
  turnStartIndex: number
  isSplitTurn: boolean
}
