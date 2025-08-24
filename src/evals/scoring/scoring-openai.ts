/**
 * Raw OpenAI client for LLM scoring (no telemetry wrapping)
 * 
 * This provides a centralized OpenAI client specifically for scoring.
 * Per Braintrust guidance, we use a raw client (not wrapped) so the judge
 * doesn't create its own span - the score is attached to the task event instead.
 */

import { OPENAI_API_KEY_FOR_SCORING, OPENAI_MODEL_FOR_SCORING } from '@/config'

// Lazy-load OpenAI to avoid module loading issues
let OpenAI: any
let scoringClient: any = null

const DEFAULT_MODEL = OPENAI_MODEL_FOR_SCORING || 'gpt-5-mini'

/**
 * Get or create the raw OpenAI client for scoring
 * Uses raw client without Braintrust wrapping to avoid creating separate spans
 * Lazy initialization to avoid issues when telemetry is disabled
 */
export function getScoringOpenAI(): any {
  if (scoringClient) {
    return scoringClient
  }

  const apiKey = OPENAI_API_KEY_FOR_SCORING
  if (!apiKey || !apiKey.trim()) {
    console.warn('[scoring-openai] Missing OPENAI_API_KEY_FOR_SCORING in config.ts')
    return null
  }

  try {
    // Lazy load OpenAI
    if (!OpenAI) {
      OpenAI = require('openai').default
    }

    // Create raw OpenAI client - NOT wrapped with Braintrust
    // This prevents the judge from creating its own span in the trace
    // The score will be attached to the task event instead
    scoringClient = new OpenAI({ apiKey })
    
    console.log('%c✓ Scoring OpenAI client initialized (raw, no telemetry)', 'color: #9c27b0; font-size: 10px')
    
    return scoringClient
  } catch (error) {
    console.error('[scoring-openai] Failed to create client:', error)
    return null
  }
}

// Export as a getter to ensure lazy initialization
export const scoringOpenAI = {
  get chat() {
    const client = getScoringOpenAI()
    return client?.chat
  }
}

export { DEFAULT_MODEL }
