/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Generates registry.json from a local models.dev clone.
 *
 * Usage:
 *   bun packages/models-dev/scripts/generate.ts /path/to/models.dev/providers
 */

import path from 'node:path'
import type {
  ModelCost,
  ModelInfo,
  ModelRegistry,
  ProviderInfo,
} from '../src/types'

// models.dev provider IDs → BrowserOS provider IDs
const PROVIDER_MAP: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  openrouter: 'openrouter',
  'ollama-cloud': 'ollama',
}

const SOURCE_PROVIDERS = Object.keys(PROVIDER_MAP)

interface RawModel {
  id?: string
  name: string
  family?: string
  reasoning: boolean
  tool_call: boolean
  structured_output?: boolean
  attachment: boolean
  modalities: { input: string[]; output: string[] }
  limit: { context: number; input?: number; output: number }
  cost?: RawCost
  knowledge?: string
  status?: string
  release_date: string
  [key: string]: unknown
}

interface RawCost {
  input: number
  output: number
  reasoning?: number
  cache_read?: number
  cache_write?: number
  [key: string]: unknown
}

interface RawProvider {
  name: string
  [key: string]: unknown
}

function extractCost(raw?: RawCost): ModelCost | undefined {
  if (!raw) return undefined
  const cost: ModelCost = { input: raw.input, output: raw.output }
  if (raw.reasoning !== undefined) cost.reasoning = raw.reasoning
  if (raw.cache_read !== undefined) cost.cache_read = raw.cache_read
  if (raw.cache_write !== undefined) cost.cache_write = raw.cache_write
  return cost
}

function extractModel(raw: RawModel, modelId: string): ModelInfo {
  return {
    id: modelId,
    name: raw.name,
    ...(raw.family && { family: raw.family }),
    reasoning: raw.reasoning,
    tool_call: raw.tool_call,
    ...(raw.structured_output !== undefined && {
      structured_output: raw.structured_output,
    }),
    attachment: raw.attachment,
    modalities: raw.modalities,
    limit: {
      context: raw.limit.context,
      ...(raw.limit.input !== undefined && { input: raw.limit.input }),
      output: raw.limit.output,
    },
    ...(raw.cost && { cost: extractCost(raw.cost) }),
    ...(raw.knowledge && { knowledge: raw.knowledge }),
    ...(raw.status && { status: raw.status as ModelInfo['status'] }),
    release_date: raw.release_date,
  }
}

async function loadToml(filePath: string): Promise<Record<string, unknown>> {
  return import(filePath, { with: { type: 'toml' } }).then((mod) => mod.default)
}

async function generateProvider(
  providersDir: string,
  sourceId: string,
  targetId: string,
): Promise<ProviderInfo> {
  // Load provider metadata
  const providerToml = (await loadToml(
    path.join(providersDir, sourceId, 'provider.toml'),
  )) as unknown as RawProvider

  const provider: ProviderInfo = {
    id: targetId,
    name: providerToml.name,
    models: {},
  }

  // Scan all model TOML files
  const modelsDir = path.join(providersDir, sourceId, 'models')
  for await (const modelPath of new Bun.Glob('**/*.toml').scan({
    cwd: modelsDir,
    absolute: true,
    followSymlinks: true,
  })) {
    const modelId = path.relative(modelsDir, modelPath).slice(0, -5)
    try {
      const raw = (await loadToml(modelPath)) as unknown as RawModel
      provider.models[modelId] = extractModel(raw, modelId)
    } catch (err) {
      console.warn(`Skipping ${sourceId}/${modelId}: ${err}`)
    }
  }

  return provider
}

async function main() {
  const providersDir = process.argv[2]
  if (!providersDir) {
    console.error(
      'Usage: bun scripts/generate.ts <path-to-models.dev-providers>',
    )
    process.exit(1)
  }

  const absoluteDir = path.resolve(providersDir)
  console.log(`Reading from: ${absoluteDir}`)

  const registry: ModelRegistry = {}

  for (const sourceId of SOURCE_PROVIDERS) {
    const targetId = PROVIDER_MAP[sourceId]
    try {
      const provider = await generateProvider(absoluteDir, sourceId, targetId)
      const modelCount = Object.keys(provider.models).length
      console.log(`  ${sourceId} → ${targetId}: ${modelCount} models`)
      registry[targetId] = provider
    } catch (err) {
      console.error(`Failed to process ${sourceId}: ${err}`)
      process.exit(1)
    }
  }

  // Write registry
  const outputPath = path.join(
    import.meta.dir,
    '..',
    'src',
    'data',
    'registry.json',
  )
  await Bun.write(outputPath, JSON.stringify(registry, null, 2))

  const totalModels = Object.values(registry).reduce(
    (sum, p) => sum + Object.keys(p.models).length,
    0,
  )
  console.log(`\nGenerated ${outputPath}`)
  console.log(
    `  ${Object.keys(registry).length} providers, ${totalModels} models`,
  )
}

main()
