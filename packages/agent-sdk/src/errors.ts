/**
 * Base error class for all Agent SDK errors.
 * All SDK errors extend this class.
 */
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

/**
 * Thrown when the agent cannot connect to the BrowserOS runtime.
 */
export class ConnectionError extends AgentSDKError {
  constructor(
    message: string,
    public readonly url: string,
  ) {
    super(message, 'CONNECTION_ERROR')
    this.name = 'ConnectionError'
  }
}

/**
 * Thrown when `nav()` fails to navigate to the target URL.
 */
export class NavigationError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'NAVIGATION_ERROR', statusCode)
    this.name = 'NavigationError'
  }
}

/**
 * Thrown when `act()` fails to perform the requested action.
 */
export class ActionError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'ACTION_ERROR', statusCode)
    this.name = 'ActionError'
  }
}

/**
 * Thrown when `extract()` fails to extract data or data doesn't match schema.
 */
export class ExtractionError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'EXTRACTION_ERROR', statusCode)
    this.name = 'ExtractionError'
  }
}

/**
 * Thrown when `verify()` encounters an error during verification.
 */
export class VerificationError extends AgentSDKError {
  constructor(message: string, statusCode?: number) {
    super(message, 'VERIFICATION_ERROR', statusCode)
    this.name = 'VerificationError'
  }
}
