// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { StreamHandle } from './io'
import type {
  ErrorReason,
  RequestId as NetworkRequestId,
  Request,
  ResourceType,
} from './network'
import type { FrameId } from './page'

// ══ Types ══

export type RequestId = string

export type RequestStage = 'Request' | 'Response'

export interface RequestPattern {
  urlPattern?: string
  resourceType?: ResourceType
  requestStage?: RequestStage
}

export interface HeaderEntry {
  name: string
  value: string
}

export interface AuthChallenge {
  source?: 'Server' | 'Proxy'
  origin: string
  scheme: string
  realm: string
}

export interface AuthChallengeResponse {
  response: 'Default' | 'CancelAuth' | 'ProvideCredentials'
  username?: string
  password?: string
}

// ══ Commands ══

export interface EnableParams {
  patterns?: RequestPattern[]
  handleAuthRequests?: boolean
}

export interface FailRequestParams {
  requestId: RequestId
  errorReason: ErrorReason
}

export interface FulfillRequestParams {
  requestId: RequestId
  responseCode: number
  responseHeaders?: HeaderEntry[]
  binaryResponseHeaders?: string
  body?: string
  responsePhrase?: string
}

export interface ContinueRequestParams {
  requestId: RequestId
  url?: string
  method?: string
  postData?: string
  headers?: HeaderEntry[]
  interceptResponse?: boolean
}

export interface ContinueWithAuthParams {
  requestId: RequestId
  authChallengeResponse: AuthChallengeResponse
}

export interface ContinueResponseParams {
  requestId: RequestId
  responseCode?: number
  responsePhrase?: string
  responseHeaders?: HeaderEntry[]
  binaryResponseHeaders?: string
}

export interface GetResponseBodyParams {
  requestId: RequestId
}

export interface GetResponseBodyResult {
  body: string
  base64Encoded: boolean
}

export interface TakeResponseBodyAsStreamParams {
  requestId: RequestId
}

export interface TakeResponseBodyAsStreamResult {
  stream: StreamHandle
}

// ══ Events ══

export interface RequestPausedEvent {
  requestId: RequestId
  request: Request
  frameId: FrameId
  resourceType: ResourceType
  responseErrorReason?: ErrorReason
  responseStatusCode?: number
  responseStatusText?: string
  responseHeaders?: HeaderEntry[]
  networkId?: NetworkRequestId
  redirectedRequestId?: RequestId
}

export interface AuthRequiredEvent {
  requestId: RequestId
  request: Request
  frameId: FrameId
  resourceType: ResourceType
  authChallenge: AuthChallenge
}
