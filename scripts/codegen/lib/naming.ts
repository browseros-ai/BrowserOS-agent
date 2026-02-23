export function domainToKebab(domain: string): string {
  return domain
    .replace(/(?<=[a-z0-9])(?=[A-Z])/g, '-')
    .replace(/(?<=[A-Z])(?=[A-Z][a-z])/g, '-')
    .toLowerCase()
}

export function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function resolveRef(ref: string): { domain?: string; typeName: string } {
  const dot = ref.indexOf('.')
  if (dot === -1) return { typeName: ref }
  return { domain: ref.slice(0, dot), typeName: ref.slice(dot + 1) }
}
