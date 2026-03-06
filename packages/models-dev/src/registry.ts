/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Model registry lookup functions.
 * Data is sourced from models.dev and pre-built into registry.json.
 */

import data from './data/registry.json'
import type { ModelInfo, ModelRegistry, ProviderInfo } from './types'

const registry: ModelRegistry = data as ModelRegistry

export function getModelDefaults(
  provider: string,
  modelId: string,
): ModelInfo | undefined {
  if (!Object.hasOwn(registry, provider)) return undefined
  const p = registry[provider]
  if (!Object.hasOwn(p.models, modelId)) return undefined
  return p.models[modelId]
}

export function getProviderModels(provider: string): ProviderInfo | undefined {
  if (!Object.hasOwn(registry, provider)) return undefined
  return registry[provider]
}

export function getAllProviders(): Record<string, ProviderInfo> {
  return registry
}
