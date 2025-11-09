/**
 * ModelPricing - Utility for calculating LLM and API costs
 * 
 * Provides pricing information for various LLM providers, models, and external APIs.
 * LLM prices are in USD per 1M tokens (input/output).
 * 
 * Note: Prices are approximate and may change. Always verify with provider pricing pages.
 * 
 * External API Costs:
 * - Moondream Vision API: $0.30 per 1M input tokens, $2.50 per 1M output tokens
 * - Klavis MCP API: $0.05 per call (Hobby), $0.02 per call (Pro), $0.01 per call (Team)
 * 
 * Total execution cost = LLM token cost + Moondream token cost + Klavis call cost
 */

export interface ModelPrice {
  inputPer1M: number;  // USD per 1M input tokens
  outputPer1M: number;  // USD per 1M output tokens
}

export interface ApiCallPrice {
  costPerCall: number;  // USD per API call
  name: string;  // API service name
}

/**
 * Pricing data for common LLM models
 * Updated as of November 2025
 */
const MODEL_PRICING: Record<string, ModelPrice> = {
  // OpenAI Models
  'gpt-4o': { inputPer1M: 2.50, outputPer1M: 10.00 },
  'gpt-4o-mini': { inputPer1M: 0.150, outputPer1M: 0.600 },
  'gpt-4-turbo': { inputPer1M: 10.00, outputPer1M: 30.00 },
  'gpt-4': { inputPer1M: 30.00, outputPer1M: 60.00 },
  'gpt-3.5-turbo': { inputPer1M: 0.50, outputPer1M: 1.50 },
  'o1-preview': { inputPer1M: 15.00, outputPer1M: 60.00 },
  'o1-mini': { inputPer1M: 3.00, outputPer1M: 12.00 },
  'o3-mini': { inputPer1M: 1.10, outputPer1M: 4.40 },

  // Anthropic Models
  'claude-4-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3.5-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-opus': { inputPer1M: 15.00, outputPer1M: 75.00 },
  'claude-3-sonnet': { inputPer1M: 3.00, outputPer1M: 15.00 },
  'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3-5-haiku-20241022': { inputPer1M: 1.00, outputPer1M: 5.00 },

  // Google Gemini Models
  'gemini-2.0-flash-exp': { inputPer1M: 0.00, outputPer1M: 0.00 }, // Free tier
  'gemini-2.5-flash': { inputPer1M: 0.075, outputPer1M: 0.30 },
  'gemini-1.5-pro': { inputPer1M: 1.25, outputPer1M: 5.00 },
  'gemini-1.5-flash': { inputPer1M: 0.10, outputPer1M: 0.40 },
  'gemini-pro': { inputPer1M: 0.50, outputPer1M: 1.50 },

  // Ollama (Local) - No cost
  'ollama': { inputPer1M: 0.00, outputPer1M: 0.00 },
  'qwen3:4b': { inputPer1M: 0.00, outputPer1M: 0.00 },
  'llama3': { inputPer1M: 0.00, outputPer1M: 0.00 },
  'llama3.1': { inputPer1M: 0.00, outputPer1M: 0.00 },
  'mistral': { inputPer1M: 0.00, outputPer1M: 0.00 },

  // Vision APIs
  'moondream': { inputPer1M: 0.30, outputPer1M: 2.50 },
  'moondream-2b': { inputPer1M: 0.30, outputPer1M: 2.50 },

  // Default pricing for unknown models
  'default': { inputPer1M: 2.00, outputPer1M: 6.00 },
};

/**
 * Pricing for external API services (per-call basis)
 */
const API_CALL_PRICING: Record<string, number> = {
  'klavis-hobby': 0.05,  // $0.05 per call (Hobby plan)
  'klavis-pro': 0.02,    // $0.02 per call (Pro plan)
  'klavis-team': 0.01,   // $0.01 per call (Team plan)
  'klavis': 0.02,        // Default to Pro plan pricing
};

export class ModelPricing {
  /**
   * Calculate the cost of a token usage
   * @param modelName - The model name (e.g., 'gpt-4o', 'claude-3-5-sonnet')
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Cost in USD
   */
  static calculateCost(
    modelName: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    // Normalize model name to lowercase for matching
    const normalizedModel = modelName.toLowerCase();

    // Find matching pricing - check exact match first, then substring match
    let pricing = MODEL_PRICING[normalizedModel];

    if (!pricing) {
      // Try to find a matching model by checking if the model name contains known keys
      const matchingKey = Object.keys(MODEL_PRICING).find(key => 
        normalizedModel.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedModel)
      );
      
      if (matchingKey) {
        pricing = MODEL_PRICING[matchingKey];
      } else {
        // Use default pricing if no match found
        pricing = MODEL_PRICING['default'];
      }
    }

    // Calculate cost: (tokens / 1,000,000) * price_per_1M
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    
    return inputCost + outputCost;
  }

  /**
   * Get pricing information for a model
   * @param modelName - The model name
   * @returns Pricing information or null if not found
   */
  static getPricing(modelName: string): ModelPrice | null {
    const normalizedModel = modelName.toLowerCase();
    return MODEL_PRICING[normalizedModel] || MODEL_PRICING['default'];
  }

  /**
   * Format cost as a readable string
   * @param cost - Cost in USD
   * @returns Formatted string (e.g., "$0.0123" or "$0.0001")
   */
  static formatCost(cost: number): string {
    if (cost === 0) {
      return '$0.00';
    }
    
    if (cost < 0.0001) {
      return '< $0.0001';
    }
    
    if (cost < 0.01) {
      return `$${cost.toFixed(4)}`;
    }
    
    return `$${cost.toFixed(3)}`;
  }

  /**
   * Check if a model is free (local model)
   * @param modelName - The model name
   * @returns True if the model is free
   */
  static isFreeModel(modelName: string): boolean {
    const pricing = this.getPricing(modelName);
    return pricing ? pricing.inputPer1M === 0 && pricing.outputPer1M === 0 : false;
  }

  /**
   * Calculate the cost of an API call (for per-call pricing services like Klavis)
   * @param apiName - The API service name (e.g., 'klavis', 'klavis-pro')
   * @param callCount - Number of API calls made
   * @returns Cost in USD
   */
  static calculateApiCallCost(apiName: string, callCount: number = 1): number {
    const normalizedName = apiName.toLowerCase();
    const costPerCall = API_CALL_PRICING[normalizedName] || 0;
    return costPerCall * callCount;
  }

  /**
   * Get API call pricing information
   * @param apiName - The API service name
   * @returns Cost per call in USD, or 0 if not found
   */
  static getApiCallPrice(apiName: string): number {
    const normalizedName = apiName.toLowerCase();
    return API_CALL_PRICING[normalizedName] || 0;
  }

  /**
   * Get a summary of token usage and cost
   * @param modelName - The model name
   * @param inputTokens - Number of input tokens
   * @param outputTokens - Number of output tokens
   * @returns Human-readable summary
   */
  static getSummary(
    modelName: string,
    inputTokens: number,
    outputTokens: number
  ): string {
    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(modelName, inputTokens, outputTokens);
    const formattedCost = this.formatCost(cost);
    
    if (this.isFreeModel(modelName)) {
      return `${totalTokens.toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out) - Local model (Free)`;
    }
    
    return `${totalTokens.toLocaleString()} tokens (${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out) - ${formattedCost}`;
  }
}

