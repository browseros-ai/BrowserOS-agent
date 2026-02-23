// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { TimeSinceEpoch } from './network'

// ══ Types ══

export type CertificateId = number

export type MixedContentType = 'blockable' | 'optionally-blockable' | 'none'

export type SecurityState =
  | 'unknown'
  | 'neutral'
  | 'insecure'
  | 'secure'
  | 'info'
  | 'insecure-broken'

export interface CertificateSecurityState {
  protocol: string
  keyExchange: string
  keyExchangeGroup?: string
  cipher: string
  mac?: string
  certificate: string[]
  subjectName: string
  issuer: string
  validFrom: TimeSinceEpoch
  validTo: TimeSinceEpoch
  certificateNetworkError?: string
  certificateHasWeakSignature: boolean
  certificateHasSha1Signature: boolean
  modernSSL: boolean
  obsoleteSslProtocol: boolean
  obsoleteSslKeyExchange: boolean
  obsoleteSslCipher: boolean
  obsoleteSslSignature: boolean
}

export type SafetyTipStatus = 'badReputation' | 'lookalike'

export interface SafetyTipInfo {
  safetyTipStatus: SafetyTipStatus
  safeUrl?: string
}

export interface VisibleSecurityState {
  securityState: SecurityState
  certificateSecurityState?: CertificateSecurityState
  safetyTipInfo?: SafetyTipInfo
  securityStateIssueIds: string[]
}

export interface SecurityStateExplanation {
  securityState: SecurityState
  title: string
  summary: string
  description: string
  mixedContentType: MixedContentType
  certificate: string[]
  recommendations?: string[]
}

export interface InsecureContentStatus {
  ranMixedContent: boolean
  displayedMixedContent: boolean
  containedMixedForm: boolean
  ranContentWithCertErrors: boolean
  displayedContentWithCertErrors: boolean
  ranInsecureContentStyle: SecurityState
  displayedInsecureContentStyle: SecurityState
}

export type CertificateErrorAction = 'continue' | 'cancel'

// ══ Commands ══

export interface SetIgnoreCertificateErrorsParams {
  ignore: boolean
}

export interface HandleCertificateErrorParams {
  eventId: number
  action: CertificateErrorAction
}

export interface SetOverrideCertificateErrorsParams {
  override: boolean
}

// ══ Events ══

export interface CertificateErrorEvent {
  eventId: number
  errorType: string
  requestURL: string
}

export interface VisibleSecurityStateChangedEvent {
  visibleSecurityState: VisibleSecurityState
}

export interface SecurityStateChangedEvent {
  securityState: SecurityState
  schemeIsCryptographic: boolean
  explanations: SecurityStateExplanation[]
  insecureContentStatus: InsecureContentStatus
  summary?: string
}
