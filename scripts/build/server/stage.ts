import { chmod, cp, mkdir, rm } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative } from 'node:path'

import type { S3Client } from '@aws-sdk/client-s3'

import { writeArtifactMetadata } from './metadata'
import { downloadObjectToFile } from './r2'
import type {
  BuildTarget,
  R2Config,
  ResourceRule,
  StagedArtifact,
} from './types'

function artifactRoot(distRoot: string, target: BuildTarget): string {
  return join(distRoot, target.id)
}

function serverDestinationPath(rootDir: string, target: BuildTarget): string {
  return join(rootDir, 'resources', 'bin', target.serverBinaryName)
}

async function copyServerBinary(
  compiledBinaryPath: string,
  destinationPath: string,
  target: BuildTarget,
): Promise<void> {
  await mkdir(dirname(destinationPath), { recursive: true })
  await cp(compiledBinaryPath, destinationPath)
  if (target.os !== 'windows') {
    await chmod(destinationPath, 0o755)
  }
}

function resolveDestination(rootDir: string, destination: string): string {
  const outputPath = join(rootDir, destination)
  const relativePath = relative(rootDir, outputPath)
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new Error(
      `Invalid destination path outside artifact root: ${destination}`,
    )
  }
  return outputPath
}

async function stageRule(
  rootDir: string,
  rule: ResourceRule,
  target: BuildTarget,
  client: S3Client,
  r2: R2Config,
): Promise<void> {
  const destinationPath = resolveDestination(rootDir, rule.destination)
  await downloadObjectToFile(client, r2, rule.source.key, destinationPath)

  if (rule.executable && target.os !== 'windows') {
    await chmod(destinationPath, 0o755)
  }
}

export async function stageTargetArtifact(
  distRoot: string,
  compiledBinaryPath: string,
  target: BuildTarget,
  rules: ResourceRule[],
  client: S3Client,
  r2: R2Config,
  version: string,
): Promise<StagedArtifact> {
  const rootDir = artifactRoot(distRoot, target)
  await rm(rootDir, { recursive: true, force: true })
  await mkdir(rootDir, { recursive: true })

  await copyServerBinary(
    compiledBinaryPath,
    serverDestinationPath(rootDir, target),
    target,
  )

  for (const rule of rules) {
    await stageRule(rootDir, rule, target, client, r2)
  }

  const metadataPath = await writeArtifactMetadata(rootDir, target, version)
  return {
    target,
    rootDir,
    resourcesDir: join(rootDir, 'resources'),
    metadataPath,
  }
}
