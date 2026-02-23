import { domainToKebab, resolveRef, toPascalCase } from './naming'
import type { ProtocolDomain } from './protocol-parser'
import {
  collectImports,
  emitInterface,
  emitType,
  type RefResolver,
} from './type-emitter'

export function emitDomainFile(domain: ProtocolDomain): string {
  const lines: string[] = []
  const localTypeNames = new Set((domain.types ?? []).map((t) => t.id))
  const allImports = new Map<string, Set<string>>()

  const allRefSources = [
    ...(domain.types ?? []).flatMap((t) => [
      ...(t.properties ?? []),
      ...(t.items ? [t] : []),
    ]),
    ...(domain.commands ?? []).flatMap((c) => [
      ...(c.parameters ?? []),
      ...(c.returns ?? []),
    ]),
    ...(domain.events ?? []).flatMap((e) => e.parameters ?? []),
  ]

  const imports = collectImports(allRefSources, domain.domain)
  for (const ref of imports) {
    const existing = allImports.get(ref.domain) ?? new Set()
    existing.add(ref.typeName)
    allImports.set(ref.domain, existing)
  }

  const aliases = new Map<string, string>()
  for (const [depDomain, types] of allImports) {
    for (const typeName of types) {
      if (localTypeNames.has(typeName)) {
        aliases.set(`${depDomain}.${typeName}`, `${depDomain}${typeName}`)
      }
    }
  }

  const resolve: RefResolver = (ref: string) => {
    const r = resolveRef(ref)
    if (!r.domain || r.domain === domain.domain) return r.typeName
    return aliases.get(ref) ?? r.typeName
  }

  lines.push(`// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──`)
  lines.push('')

  if (allImports.size > 0) {
    const sortedDomains = [...allImports.keys()].sort()
    for (const dep of sortedDomains) {
      const types = [...allImports.get(dep)!].sort()
      const file = domainToKebab(dep)
      const specs = types.map((t) => {
        const alias = aliases.get(`${dep}.${t}`)
        return alias ? `${t} as ${alias}` : t
      })
      lines.push(`import type { ${specs.join(', ')} } from './${file}'`)
    }
    lines.push('')
  }

  if (domain.types && domain.types.length > 0) {
    lines.push('// ══ Types ══')
    lines.push('')
    for (const type of domain.types) {
      lines.push(emitType(type, resolve))
    }
  }

  const commands = domain.commands ?? []
  if (commands.length > 0) {
    lines.push('// ══ Commands ══')
    lines.push('')
    for (const cmd of commands) {
      const pascal = toPascalCase(cmd.name)

      if (cmd.parameters && cmd.parameters.length > 0) {
        lines.push(emitInterface(`${pascal}Params`, cmd.parameters, resolve))
      }

      if (cmd.returns && cmd.returns.length > 0) {
        lines.push(emitInterface(`${pascal}Result`, cmd.returns, resolve))
      }
    }
  }

  const events = domain.events ?? []
  if (events.length > 0) {
    lines.push('// ══ Events ══')
    lines.push('')
    for (const event of events) {
      if (event.parameters && event.parameters.length > 0) {
        const pascal = toPascalCase(event.name)
        lines.push(emitInterface(`${pascal}Event`, event.parameters, resolve))
      }
    }
  }

  return lines.join('\n')
}
