// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AddBindingParams,
  AwaitPromiseParams,
  AwaitPromiseResult,
  BindingCalledEvent,
  CallFunctionOnParams,
  CallFunctionOnResult,
  CompileScriptParams,
  CompileScriptResult,
  ConsoleAPICalledEvent,
  EvaluateParams,
  EvaluateResult,
  ExceptionRevokedEvent,
  ExceptionThrownEvent,
  ExecutionContextCreatedEvent,
  ExecutionContextDestroyedEvent,
  GetExceptionDetailsParams,
  GetExceptionDetailsResult,
  GetHeapUsageResult,
  GetIsolateIdResult,
  GetPropertiesParams,
  GetPropertiesResult,
  GlobalLexicalScopeNamesParams,
  GlobalLexicalScopeNamesResult,
  InspectRequestedEvent,
  QueryObjectsParams,
  QueryObjectsResult,
  ReleaseObjectGroupParams,
  ReleaseObjectParams,
  RemoveBindingParams,
  RunScriptParams,
  RunScriptResult,
  SetAsyncCallStackDepthParams,
  SetCustomObjectFormatterEnabledParams,
  SetMaxCallStackSizeToCaptureParams,
} from '../domains/runtime'

export interface RuntimeApi {
  // ── Commands ──

  awaitPromise(params: AwaitPromiseParams): Promise<AwaitPromiseResult>
  callFunctionOn(params: CallFunctionOnParams): Promise<CallFunctionOnResult>
  compileScript(params: CompileScriptParams): Promise<CompileScriptResult>
  disable(): Promise<void>
  discardConsoleEntries(): Promise<void>
  enable(): Promise<void>
  evaluate(params: EvaluateParams): Promise<EvaluateResult>
  getIsolateId(): Promise<GetIsolateIdResult>
  getHeapUsage(): Promise<GetHeapUsageResult>
  getProperties(params: GetPropertiesParams): Promise<GetPropertiesResult>
  globalLexicalScopeNames(
    params?: GlobalLexicalScopeNamesParams,
  ): Promise<GlobalLexicalScopeNamesResult>
  queryObjects(params: QueryObjectsParams): Promise<QueryObjectsResult>
  releaseObject(params: ReleaseObjectParams): Promise<void>
  releaseObjectGroup(params: ReleaseObjectGroupParams): Promise<void>
  runIfWaitingForDebugger(): Promise<void>
  runScript(params: RunScriptParams): Promise<RunScriptResult>
  setAsyncCallStackDepth(params: SetAsyncCallStackDepthParams): Promise<void>
  setCustomObjectFormatterEnabled(
    params: SetCustomObjectFormatterEnabledParams,
  ): Promise<void>
  setMaxCallStackSizeToCapture(
    params: SetMaxCallStackSizeToCaptureParams,
  ): Promise<void>
  terminateExecution(): Promise<void>
  addBinding(params: AddBindingParams): Promise<void>
  removeBinding(params: RemoveBindingParams): Promise<void>
  getExceptionDetails(
    params: GetExceptionDetailsParams,
  ): Promise<GetExceptionDetailsResult>

  // ── Events ──

  on(
    event: 'bindingCalled',
    handler: (params: BindingCalledEvent) => void,
  ): () => void
  on(
    event: 'consoleAPICalled',
    handler: (params: ConsoleAPICalledEvent) => void,
  ): () => void
  on(
    event: 'exceptionRevoked',
    handler: (params: ExceptionRevokedEvent) => void,
  ): () => void
  on(
    event: 'exceptionThrown',
    handler: (params: ExceptionThrownEvent) => void,
  ): () => void
  on(
    event: 'executionContextCreated',
    handler: (params: ExecutionContextCreatedEvent) => void,
  ): () => void
  on(
    event: 'executionContextDestroyed',
    handler: (params: ExecutionContextDestroyedEvent) => void,
  ): () => void
  on(event: 'executionContextsCleared', handler: () => void): () => void
  on(
    event: 'inspectRequested',
    handler: (params: InspectRequestedEvent) => void,
  ): () => void
}
