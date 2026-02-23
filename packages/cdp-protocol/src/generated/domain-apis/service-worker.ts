// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  DeliverPushMessageParams,
  DispatchPeriodicSyncEventParams,
  DispatchSyncEventParams,
  SetForceUpdateOnPageLoadParams,
  SkipWaitingParams,
  StartWorkerParams,
  StopWorkerParams,
  UnregisterParams,
  UpdateRegistrationParams,
  WorkerErrorReportedEvent,
  WorkerRegistrationUpdatedEvent,
  WorkerVersionUpdatedEvent,
} from '../domains/service-worker'

export interface ServiceWorkerApi {
  // ── Commands ──

  deliverPushMessage(params: DeliverPushMessageParams): Promise<void>
  disable(): Promise<void>
  dispatchSyncEvent(params: DispatchSyncEventParams): Promise<void>
  dispatchPeriodicSyncEvent(
    params: DispatchPeriodicSyncEventParams,
  ): Promise<void>
  enable(): Promise<void>
  setForceUpdateOnPageLoad(
    params: SetForceUpdateOnPageLoadParams,
  ): Promise<void>
  skipWaiting(params: SkipWaitingParams): Promise<void>
  startWorker(params: StartWorkerParams): Promise<void>
  stopAllWorkers(): Promise<void>
  stopWorker(params: StopWorkerParams): Promise<void>
  unregister(params: UnregisterParams): Promise<void>
  updateRegistration(params: UpdateRegistrationParams): Promise<void>

  // ── Events ──

  on(
    event: 'workerErrorReported',
    handler: (params: WorkerErrorReportedEvent) => void,
  ): () => void
  on(
    event: 'workerRegistrationUpdated',
    handler: (params: WorkerRegistrationUpdatedEvent) => void,
  ): () => void
  on(
    event: 'workerVersionUpdated',
    handler: (params: WorkerVersionUpdatedEvent) => void,
  ): () => void
}
