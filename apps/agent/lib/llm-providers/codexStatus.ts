export interface CodexStatus {
  isAuthenticated: boolean
  authMode: 'chatgpt' | 'api-key' | null
  canUseChatGpt: boolean
  authPath: string
  message: string
}

export async function getCodexStatus(
  agentServerUrl: string,
): Promise<CodexStatus> {
  const response = await fetch(`${agentServerUrl}/codex/status`)

  if (!response.ok) {
    throw new Error('Failed to load Codex status')
  }

  return (await response.json()) as CodexStatus
}
