// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  ActivateTargetParams,
  AttachedToTargetEvent,
  AttachToBrowserTargetResult,
  AttachToTargetParams,
  AttachToTargetResult,
  AutoAttachRelatedParams,
  CloseTargetParams,
  CloseTargetResult,
  CreateBrowserContextParams,
  CreateBrowserContextResult,
  CreateTargetParams,
  CreateTargetResult,
  DetachedFromTargetEvent,
  DetachFromTargetParams,
  DisposeBrowserContextParams,
  ExposeDevToolsProtocolParams,
  GetBrowserContextsResult,
  GetDevToolsTargetParams,
  GetDevToolsTargetResult,
  GetTargetInfoParams,
  GetTargetInfoResult,
  GetTargetsParams,
  GetTargetsResult,
  OpenDevToolsParams,
  OpenDevToolsResult,
  ReceivedMessageFromTargetEvent,
  SendMessageToTargetParams,
  SetAutoAttachParams,
  SetDiscoverTargetsParams,
  SetRemoteLocationsParams,
  TargetCrashedEvent,
  TargetCreatedEvent,
  TargetDestroyedEvent,
  TargetInfoChangedEvent,
} from '../domains/target'

export interface TargetApi {
  // ── Commands ──

  activateTarget(params: ActivateTargetParams): Promise<void>
  attachToTarget(params: AttachToTargetParams): Promise<AttachToTargetResult>
  attachToBrowserTarget(): Promise<AttachToBrowserTargetResult>
  closeTarget(params: CloseTargetParams): Promise<CloseTargetResult>
  exposeDevToolsProtocol(params: ExposeDevToolsProtocolParams): Promise<void>
  createBrowserContext(
    params?: CreateBrowserContextParams,
  ): Promise<CreateBrowserContextResult>
  getBrowserContexts(): Promise<GetBrowserContextsResult>
  createTarget(params: CreateTargetParams): Promise<CreateTargetResult>
  detachFromTarget(params?: DetachFromTargetParams): Promise<void>
  disposeBrowserContext(params: DisposeBrowserContextParams): Promise<void>
  getTargetInfo(params?: GetTargetInfoParams): Promise<GetTargetInfoResult>
  getTargets(params?: GetTargetsParams): Promise<GetTargetsResult>
  sendMessageToTarget(params: SendMessageToTargetParams): Promise<void>
  setAutoAttach(params: SetAutoAttachParams): Promise<void>
  autoAttachRelated(params: AutoAttachRelatedParams): Promise<void>
  setDiscoverTargets(params: SetDiscoverTargetsParams): Promise<void>
  setRemoteLocations(params: SetRemoteLocationsParams): Promise<void>
  getDevToolsTarget(
    params: GetDevToolsTargetParams,
  ): Promise<GetDevToolsTargetResult>
  openDevTools(params: OpenDevToolsParams): Promise<OpenDevToolsResult>

  // ── Events ──

  on(
    event: 'attachedToTarget',
    handler: (params: AttachedToTargetEvent) => void,
  ): () => void
  on(
    event: 'detachedFromTarget',
    handler: (params: DetachedFromTargetEvent) => void,
  ): () => void
  on(
    event: 'receivedMessageFromTarget',
    handler: (params: ReceivedMessageFromTargetEvent) => void,
  ): () => void
  on(
    event: 'targetCreated',
    handler: (params: TargetCreatedEvent) => void,
  ): () => void
  on(
    event: 'targetDestroyed',
    handler: (params: TargetDestroyedEvent) => void,
  ): () => void
  on(
    event: 'targetCrashed',
    handler: (params: TargetCrashedEvent) => void,
  ): () => void
  on(
    event: 'targetInfoChanged',
    handler: (params: TargetInfoChangedEvent) => void,
  ): () => void
}
