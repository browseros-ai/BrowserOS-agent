// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AudioListenerCreatedEvent,
  AudioListenerWillBeDestroyedEvent,
  AudioNodeCreatedEvent,
  AudioNodeWillBeDestroyedEvent,
  AudioParamCreatedEvent,
  AudioParamWillBeDestroyedEvent,
  ContextChangedEvent,
  ContextCreatedEvent,
  ContextWillBeDestroyedEvent,
  GetRealtimeDataParams,
  GetRealtimeDataResult,
  NodeParamConnectedEvent,
  NodeParamDisconnectedEvent,
  NodesConnectedEvent,
  NodesDisconnectedEvent,
} from '../domains/web-audio'

export interface WebAudioApi {
  // ── Commands ──

  enable(): Promise<void>
  disable(): Promise<void>
  getRealtimeData(params: GetRealtimeDataParams): Promise<GetRealtimeDataResult>

  // ── Events ──

  on(
    event: 'contextCreated',
    handler: (params: ContextCreatedEvent) => void,
  ): () => void
  on(
    event: 'contextWillBeDestroyed',
    handler: (params: ContextWillBeDestroyedEvent) => void,
  ): () => void
  on(
    event: 'contextChanged',
    handler: (params: ContextChangedEvent) => void,
  ): () => void
  on(
    event: 'audioListenerCreated',
    handler: (params: AudioListenerCreatedEvent) => void,
  ): () => void
  on(
    event: 'audioListenerWillBeDestroyed',
    handler: (params: AudioListenerWillBeDestroyedEvent) => void,
  ): () => void
  on(
    event: 'audioNodeCreated',
    handler: (params: AudioNodeCreatedEvent) => void,
  ): () => void
  on(
    event: 'audioNodeWillBeDestroyed',
    handler: (params: AudioNodeWillBeDestroyedEvent) => void,
  ): () => void
  on(
    event: 'audioParamCreated',
    handler: (params: AudioParamCreatedEvent) => void,
  ): () => void
  on(
    event: 'audioParamWillBeDestroyed',
    handler: (params: AudioParamWillBeDestroyedEvent) => void,
  ): () => void
  on(
    event: 'nodesConnected',
    handler: (params: NodesConnectedEvent) => void,
  ): () => void
  on(
    event: 'nodesDisconnected',
    handler: (params: NodesDisconnectedEvent) => void,
  ): () => void
  on(
    event: 'nodeParamConnected',
    handler: (params: NodeParamConnectedEvent) => void,
  ): () => void
  on(
    event: 'nodeParamDisconnected',
    handler: (params: NodeParamDisconnectedEvent) => void,
  ): () => void
}
