export class AgentSDKError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message)
    this.name = 'AgentSDKError'
  }
}

export class ConnectionError extends AgentSDKError {
  constructor(message: string, url: string) {
    super(message, 'CONNECTION_ERROR')
    this.name = 'ConnectionError'
  }
}

export class NavigationError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NAVIGATION_ERROR', statusCode)
    this.name = 'NavigationError'
  }
}

export class ActionError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'ACTION_ERROR', statusCode)
    this.name = 'ActionError'
  }
}

export class ExtractionError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'EXTRACTION_ERROR', statusCode)
    this.name = 'ExtractionError'
  }
}

export class VerificationError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'VERIFICATION_ERROR', statusCode)
    this.name = 'VerificationError'
  }
}
