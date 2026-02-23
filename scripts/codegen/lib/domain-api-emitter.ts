import { domainToKebab, toPascalCase } from './naming'
import type { ProtocolCommand, ProtocolDomain } from './protocol-parser'

function allParamsOptional(cmd: ProtocolCommand): boolean {
  if (!cmd.parameters || cmd.parameters.length === 0) return false
  return cmd.parameters.every((p) => p.optional === true)
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: codegen — linear iteration over commands/events
export function emitDomainApiFile(domain: ProtocolDomain): string {
  const lines: string[] = []
  const imports = new Set<string>()
  const commands = domain.commands ?? []
  const events = domain.events ?? []

  for (const cmd of commands) {
    const pascal = toPascalCase(cmd.name)
    if (cmd.parameters && cmd.parameters.length > 0) {
      imports.add(`${pascal}Params`)
    }
    if (cmd.returns && cmd.returns.length > 0) {
      imports.add(`${pascal}Result`)
    }
  }

  for (const event of events) {
    if (event.parameters && event.parameters.length > 0) {
      imports.add(`${toPascalCase(event.name)}Event`)
    }
  }

  lines.push('// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──')
  lines.push('')

  if (imports.size > 0) {
    const kebab = domainToKebab(domain.domain)
    const sorted = [...imports].sort()
    lines.push('import type {')
    for (const imp of sorted) {
      lines.push(`  ${imp},`)
    }
    lines.push(`} from '../domains/${kebab}'`)
    lines.push('')
  }

  lines.push(`export interface ${domain.domain}Api {`)

  if (commands.length > 0) {
    lines.push('  // ── Commands ──')
    lines.push('')
    for (const cmd of commands) {
      const pascal = toPascalCase(cmd.name)
      const hasParams = cmd.parameters && cmd.parameters.length > 0
      const hasReturns = cmd.returns && cmd.returns.length > 0
      const returnType = hasReturns
        ? `Promise<${pascal}Result>`
        : 'Promise<void>'

      if (!hasParams) {
        lines.push(`  ${cmd.name}(): ${returnType}`)
      } else if (allParamsOptional(cmd)) {
        lines.push(`  ${cmd.name}(params?: ${pascal}Params): ${returnType}`)
      } else {
        lines.push(`  ${cmd.name}(params: ${pascal}Params): ${returnType}`)
      }
    }
  }

  if (events.length > 0) {
    if (commands.length > 0) lines.push('')
    lines.push('  // ── Events ──')
    lines.push('')
    for (const event of events) {
      const hasParams = event.parameters && event.parameters.length > 0
      if (hasParams) {
        const pascal = toPascalCase(event.name)
        lines.push(
          `  on(event: '${event.name}', handler: (params: ${pascal}Event) => void): () => void`,
        )
      } else {
        lines.push(
          `  on(event: '${event.name}', handler: () => void): () => void`,
        )
      }
    }
  }

  lines.push('}')
  lines.push('')

  return lines.join('\n')
}
