// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  BreakpointResolvedEvent,
  ContinueToLocationParams,
  DisassembleWasmModuleParams,
  DisassembleWasmModuleResult,
  EnableParams,
  EnableResult,
  EvaluateOnCallFrameParams,
  EvaluateOnCallFrameResult,
  GetPossibleBreakpointsParams,
  GetPossibleBreakpointsResult,
  GetScriptSourceParams,
  GetScriptSourceResult,
  GetStackTraceParams,
  GetStackTraceResult,
  GetWasmBytecodeParams,
  GetWasmBytecodeResult,
  NextWasmDisassemblyChunkParams,
  NextWasmDisassemblyChunkResult,
  PausedEvent,
  PauseOnAsyncCallParams,
  RemoveBreakpointParams,
  RestartFrameParams,
  RestartFrameResult,
  ResumeParams,
  ScriptFailedToParseEvent,
  ScriptParsedEvent,
  SearchInContentParams,
  SearchInContentResult,
  SetAsyncCallStackDepthParams,
  SetBlackboxExecutionContextsParams,
  SetBlackboxedRangesParams,
  SetBlackboxPatternsParams,
  SetBreakpointByUrlParams,
  SetBreakpointByUrlResult,
  SetBreakpointOnFunctionCallParams,
  SetBreakpointOnFunctionCallResult,
  SetBreakpointParams,
  SetBreakpointResult,
  SetBreakpointsActiveParams,
  SetInstrumentationBreakpointParams,
  SetInstrumentationBreakpointResult,
  SetPauseOnExceptionsParams,
  SetReturnValueParams,
  SetScriptSourceParams,
  SetScriptSourceResult,
  SetSkipAllPausesParams,
  SetVariableValueParams,
  StepIntoParams,
  StepOverParams,
} from '../domains/debugger'

export interface DebuggerApi {
  // ── Commands ──

  continueToLocation(params: ContinueToLocationParams): Promise<void>
  disable(): Promise<void>
  enable(params?: EnableParams): Promise<EnableResult>
  evaluateOnCallFrame(
    params: EvaluateOnCallFrameParams,
  ): Promise<EvaluateOnCallFrameResult>
  getPossibleBreakpoints(
    params: GetPossibleBreakpointsParams,
  ): Promise<GetPossibleBreakpointsResult>
  getScriptSource(params: GetScriptSourceParams): Promise<GetScriptSourceResult>
  disassembleWasmModule(
    params: DisassembleWasmModuleParams,
  ): Promise<DisassembleWasmModuleResult>
  nextWasmDisassemblyChunk(
    params: NextWasmDisassemblyChunkParams,
  ): Promise<NextWasmDisassemblyChunkResult>
  getWasmBytecode(params: GetWasmBytecodeParams): Promise<GetWasmBytecodeResult>
  getStackTrace(params: GetStackTraceParams): Promise<GetStackTraceResult>
  pause(): Promise<void>
  pauseOnAsyncCall(params: PauseOnAsyncCallParams): Promise<void>
  removeBreakpoint(params: RemoveBreakpointParams): Promise<void>
  restartFrame(params: RestartFrameParams): Promise<RestartFrameResult>
  resume(params?: ResumeParams): Promise<void>
  searchInContent(params: SearchInContentParams): Promise<SearchInContentResult>
  setAsyncCallStackDepth(params: SetAsyncCallStackDepthParams): Promise<void>
  setBlackboxExecutionContexts(
    params: SetBlackboxExecutionContextsParams,
  ): Promise<void>
  setBlackboxPatterns(params: SetBlackboxPatternsParams): Promise<void>
  setBlackboxedRanges(params: SetBlackboxedRangesParams): Promise<void>
  setBreakpoint(params: SetBreakpointParams): Promise<SetBreakpointResult>
  setInstrumentationBreakpoint(
    params: SetInstrumentationBreakpointParams,
  ): Promise<SetInstrumentationBreakpointResult>
  setBreakpointByUrl(
    params: SetBreakpointByUrlParams,
  ): Promise<SetBreakpointByUrlResult>
  setBreakpointOnFunctionCall(
    params: SetBreakpointOnFunctionCallParams,
  ): Promise<SetBreakpointOnFunctionCallResult>
  setBreakpointsActive(params: SetBreakpointsActiveParams): Promise<void>
  setPauseOnExceptions(params: SetPauseOnExceptionsParams): Promise<void>
  setReturnValue(params: SetReturnValueParams): Promise<void>
  setScriptSource(params: SetScriptSourceParams): Promise<SetScriptSourceResult>
  setSkipAllPauses(params: SetSkipAllPausesParams): Promise<void>
  setVariableValue(params: SetVariableValueParams): Promise<void>
  stepInto(params?: StepIntoParams): Promise<void>
  stepOut(): Promise<void>
  stepOver(params?: StepOverParams): Promise<void>

  // ── Events ──

  on(
    event: 'breakpointResolved',
    handler: (params: BreakpointResolvedEvent) => void,
  ): () => void
  on(event: 'paused', handler: (params: PausedEvent) => void): () => void
  on(event: 'resumed', handler: () => void): () => void
  on(
    event: 'scriptFailedToParse',
    handler: (params: ScriptFailedToParseEvent) => void,
  ): () => void
  on(
    event: 'scriptParsed',
    handler: (params: ScriptParsedEvent) => void,
  ): () => void
}
