export interface ProtocolProperty {
  name: string
  description?: string
  optional?: boolean
  type?: string
  $ref?: string
  enum?: string[]
  items?: { type?: string; $ref?: string }
  properties?: ProtocolProperty[]
}

export interface ProtocolType {
  id: string
  description?: string
  type: string
  enum?: string[]
  properties?: ProtocolProperty[]
  items?: { type?: string; $ref?: string }
}

export interface ProtocolCommand {
  name: string
  description?: string
  parameters?: ProtocolProperty[]
  returns?: ProtocolProperty[]
}

export interface ProtocolEvent {
  name: string
  description?: string
  parameters?: ProtocolProperty[]
}

export interface ProtocolDomain {
  domain: string
  description?: string
  dependencies?: string[]
  types?: ProtocolType[]
  commands?: ProtocolCommand[]
  events?: ProtocolEvent[]
}

export interface Protocol {
  version: { major: string; minor: string }
  domains: ProtocolDomain[]
}

export async function parseProtocol(path: string): Promise<Protocol> {
  const file = Bun.file(path)
  const data = (await file.json()) as Protocol

  if (!data.version || !Array.isArray(data.domains)) {
    throw new Error(`Invalid protocol JSON: missing version or domains`)
  }

  return data
}
