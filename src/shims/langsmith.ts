// Minimal browser shim for langsmith to satisfy optional imports from @langchain/*
// Exports no-op/classes used by langchain tracing paths.

export class Client {
  // No-op client
}

export class RunTree {
  constructor(..._args: any[]) {}
}

export function getDefaultProjectName(): string {
  return 'default'
}

export default {}






