import type { UIMessage } from 'ai'

export interface AgentInterface {
  get messages(): UIMessage[]
  set messages(msgs: UIMessage[])
  appendUserMessage(content: string): void
  dispose(): Promise<void>
}
