/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Model metadata types sourced from models.dev.
 */

export interface ModelCost {
  input: number
  output: number
  reasoning?: number
  cache_read?: number
  cache_write?: number
}

export interface ModelInfo {
  id: string
  name: string
  family?: string
  reasoning: boolean
  tool_call: boolean
  structured_output?: boolean
  attachment: boolean
  modalities: {
    input: string[]
    output: string[]
  }
  limit: {
    context: number
    input?: number
    output: number
  }
  cost?: ModelCost
  knowledge?: string
  status?: 'alpha' | 'beta' | 'deprecated'
  release_date: string
}

export interface ProviderInfo {
  id: string
  name: string
  models: Record<string, ModelInfo>
}

export type ModelRegistry = Record<string, ProviderInfo>
