import type { AgentContext } from '../context'
import type { AgentSDKError } from '../errors'
import { ConnectionError } from '../errors'

type ErrorConstructor = new (
  message: string,
  statusCode?: number,
) => AgentSDKError

export async function request<T>(
  ctx: AgentContext,
  endpoint: string,
  body: Record<string, unknown>,
  ErrorClass: ErrorConstructor,
): Promise<T> {
  ctx.throwIfAborted()

  const url = `${ctx.baseUrl}${endpoint}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctx.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Operation aborted')
    }
    throw new ConnectionError(
      `Failed to connect to server: ${error instanceof Error ? error.message : String(error)}`,
      url,
    )
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      if (errorBody.error?.message) {
        errorMessage = errorBody.error.message
      }
    } catch {
      // Use default error message
    }
    throw new ErrorClass(errorMessage, response.status)
  }

  return response.json() as Promise<T>
}
