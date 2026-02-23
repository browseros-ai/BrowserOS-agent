// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type { BrowserContextID } from './browser'
import type { Cookie, CookieParam, RequestId, TimeSinceEpoch } from './network'
import type { FrameId } from './page'
import type { TargetID } from './target'

// ══ Types ══

export type SerializedStorageKey = string

export type StorageType =
  | 'cookies'
  | 'file_systems'
  | 'indexeddb'
  | 'local_storage'
  | 'shader_cache'
  | 'websql'
  | 'service_workers'
  | 'cache_storage'
  | 'interest_groups'
  | 'shared_storage'
  | 'storage_buckets'
  | 'all'
  | 'other'

export interface UsageForType {
  storageType: StorageType
  usage: number
}

export interface TrustTokens {
  issuerOrigin: string
  count: number
}

export type InterestGroupAuctionId = string

export type InterestGroupAccessType =
  | 'join'
  | 'leave'
  | 'update'
  | 'loaded'
  | 'bid'
  | 'win'
  | 'additionalBid'
  | 'additionalBidWin'
  | 'topLevelBid'
  | 'topLevelAdditionalBid'
  | 'clear'

export type InterestGroupAuctionEventType = 'started' | 'configResolved'

export type InterestGroupAuctionFetchType =
  | 'bidderJs'
  | 'bidderWasm'
  | 'sellerJs'
  | 'bidderTrustedSignals'
  | 'sellerTrustedSignals'

export type SharedStorageAccessScope =
  | 'window'
  | 'sharedStorageWorklet'
  | 'protectedAudienceWorklet'
  | 'header'

export type SharedStorageAccessMethod =
  | 'addModule'
  | 'createWorklet'
  | 'selectURL'
  | 'run'
  | 'batchUpdate'
  | 'set'
  | 'append'
  | 'delete'
  | 'clear'
  | 'get'
  | 'keys'
  | 'values'
  | 'entries'
  | 'length'
  | 'remainingBudget'

export interface SharedStorageEntry {
  key: string
  value: string
}

export interface SharedStorageMetadata {
  creationTime: TimeSinceEpoch
  length: number
  remainingBudget: number
  bytesUsed: number
}

export interface SharedStoragePrivateAggregationConfig {
  aggregationCoordinatorOrigin?: string
  contextId?: string
  filteringIdMaxBytes: number
  maxContributions?: number
}

export interface SharedStorageReportingMetadata {
  eventType: string
  reportingUrl: string
}

export interface SharedStorageUrlWithMetadata {
  url: string
  reportingMetadata: SharedStorageReportingMetadata[]
}

export interface SharedStorageAccessParams {
  scriptSourceUrl?: string
  dataOrigin?: string
  operationName?: string
  operationId?: string
  keepAlive?: boolean
  privateAggregationConfig?: SharedStoragePrivateAggregationConfig
  serializedData?: string
  urlsWithMetadata?: SharedStorageUrlWithMetadata[]
  urnUuid?: string
  key?: string
  value?: string
  ignoreIfPresent?: boolean
  workletOrdinal?: number
  workletTargetId?: TargetID
  withLock?: string
  batchUpdateId?: string
  batchSize?: number
}

export type StorageBucketsDurability = 'relaxed' | 'strict'

export interface StorageBucket {
  storageKey: SerializedStorageKey
  name?: string
}

export interface StorageBucketInfo {
  bucket: StorageBucket
  id: string
  expiration: TimeSinceEpoch
  quota: number
  persistent: boolean
  durability: StorageBucketsDurability
}

export type AttributionReportingSourceType = 'navigation' | 'event'

export type UnsignedInt64AsBase10 = string

export type UnsignedInt128AsBase16 = string

export type SignedInt64AsBase10 = string

export interface AttributionReportingFilterDataEntry {
  key: string
  values: string[]
}

export interface AttributionReportingFilterConfig {
  filterValues: AttributionReportingFilterDataEntry[]
  lookbackWindow?: number
}

export interface AttributionReportingFilterPair {
  filters: AttributionReportingFilterConfig[]
  notFilters: AttributionReportingFilterConfig[]
}

export interface AttributionReportingAggregationKeysEntry {
  key: string
  value: UnsignedInt128AsBase16
}

export interface AttributionReportingEventReportWindows {
  start: number
  ends: number[]
}

export type AttributionReportingTriggerDataMatching = 'exact' | 'modulus'

export interface AttributionReportingAggregatableDebugReportingData {
  keyPiece: UnsignedInt128AsBase16
  value: number
  types: string[]
}

export interface AttributionReportingAggregatableDebugReportingConfig {
  budget?: number
  keyPiece: UnsignedInt128AsBase16
  debugData: AttributionReportingAggregatableDebugReportingData[]
  aggregationCoordinatorOrigin?: string
}

export interface AttributionScopesData {
  values: string[]
  limit: number
  maxEventStates: number
}

export interface AttributionReportingNamedBudgetDef {
  name: string
  budget: number
}

export interface AttributionReportingSourceRegistration {
  time: TimeSinceEpoch
  expiry: number
  triggerData: number[]
  eventReportWindows: AttributionReportingEventReportWindows
  aggregatableReportWindow: number
  type: AttributionReportingSourceType
  sourceOrigin: string
  reportingOrigin: string
  destinationSites: string[]
  eventId: UnsignedInt64AsBase10
  priority: SignedInt64AsBase10
  filterData: AttributionReportingFilterDataEntry[]
  aggregationKeys: AttributionReportingAggregationKeysEntry[]
  debugKey?: UnsignedInt64AsBase10
  triggerDataMatching: AttributionReportingTriggerDataMatching
  destinationLimitPriority: SignedInt64AsBase10
  aggregatableDebugReportingConfig: AttributionReportingAggregatableDebugReportingConfig
  scopesData?: AttributionScopesData
  maxEventLevelReports: number
  namedBudgets: AttributionReportingNamedBudgetDef[]
  debugReporting: boolean
  eventLevelEpsilon: number
}

export type AttributionReportingSourceRegistrationResult =
  | 'success'
  | 'internalError'
  | 'insufficientSourceCapacity'
  | 'insufficientUniqueDestinationCapacity'
  | 'excessiveReportingOrigins'
  | 'prohibitedByBrowserPolicy'
  | 'successNoised'
  | 'destinationReportingLimitReached'
  | 'destinationGlobalLimitReached'
  | 'destinationBothLimitsReached'
  | 'reportingOriginsPerSiteLimitReached'
  | 'exceedsMaxChannelCapacity'
  | 'exceedsMaxScopesChannelCapacity'
  | 'exceedsMaxTriggerStateCardinality'
  | 'exceedsMaxEventStatesLimit'
  | 'destinationPerDayReportingLimitReached'

export type AttributionReportingSourceRegistrationTimeConfig =
  | 'include'
  | 'exclude'

export interface AttributionReportingAggregatableValueDictEntry {
  key: string
  value: number
  filteringId: UnsignedInt64AsBase10
}

export interface AttributionReportingAggregatableValueEntry {
  values: AttributionReportingAggregatableValueDictEntry[]
  filters: AttributionReportingFilterPair
}

export interface AttributionReportingEventTriggerData {
  data: UnsignedInt64AsBase10
  priority: SignedInt64AsBase10
  dedupKey?: UnsignedInt64AsBase10
  filters: AttributionReportingFilterPair
}

export interface AttributionReportingAggregatableTriggerData {
  keyPiece: UnsignedInt128AsBase16
  sourceKeys: string[]
  filters: AttributionReportingFilterPair
}

export interface AttributionReportingAggregatableDedupKey {
  dedupKey?: UnsignedInt64AsBase10
  filters: AttributionReportingFilterPair
}

export interface AttributionReportingNamedBudgetCandidate {
  name?: string
  filters: AttributionReportingFilterPair
}

export interface AttributionReportingTriggerRegistration {
  filters: AttributionReportingFilterPair
  debugKey?: UnsignedInt64AsBase10
  aggregatableDedupKeys: AttributionReportingAggregatableDedupKey[]
  eventTriggerData: AttributionReportingEventTriggerData[]
  aggregatableTriggerData: AttributionReportingAggregatableTriggerData[]
  aggregatableValues: AttributionReportingAggregatableValueEntry[]
  aggregatableFilteringIdMaxBytes: number
  debugReporting: boolean
  aggregationCoordinatorOrigin?: string
  sourceRegistrationTimeConfig: AttributionReportingSourceRegistrationTimeConfig
  triggerContextId?: string
  aggregatableDebugReportingConfig: AttributionReportingAggregatableDebugReportingConfig
  scopes: string[]
  namedBudgets: AttributionReportingNamedBudgetCandidate[]
}

export type AttributionReportingEventLevelResult =
  | 'success'
  | 'successDroppedLowerPriority'
  | 'internalError'
  | 'noCapacityForAttributionDestination'
  | 'noMatchingSources'
  | 'deduplicated'
  | 'excessiveAttributions'
  | 'priorityTooLow'
  | 'neverAttributedSource'
  | 'excessiveReportingOrigins'
  | 'noMatchingSourceFilterData'
  | 'prohibitedByBrowserPolicy'
  | 'noMatchingConfigurations'
  | 'excessiveReports'
  | 'falselyAttributedSource'
  | 'reportWindowPassed'
  | 'notRegistered'
  | 'reportWindowNotStarted'
  | 'noMatchingTriggerData'

export type AttributionReportingAggregatableResult =
  | 'success'
  | 'internalError'
  | 'noCapacityForAttributionDestination'
  | 'noMatchingSources'
  | 'excessiveAttributions'
  | 'excessiveReportingOrigins'
  | 'noHistograms'
  | 'insufficientBudget'
  | 'insufficientNamedBudget'
  | 'noMatchingSourceFilterData'
  | 'notRegistered'
  | 'prohibitedByBrowserPolicy'
  | 'deduplicated'
  | 'reportWindowPassed'
  | 'excessiveReports'

export type AttributionReportingReportResult =
  | 'sent'
  | 'prohibited'
  | 'failedToAssemble'
  | 'expired'

export interface RelatedWebsiteSet {
  primarySites: string[]
  associatedSites: string[]
  serviceSites: string[]
}

// ══ Commands ══

export interface GetStorageKeyForFrameParams {
  frameId: FrameId
}

export interface GetStorageKeyForFrameResult {
  storageKey: SerializedStorageKey
}

export interface GetStorageKeyParams {
  frameId?: FrameId
}

export interface GetStorageKeyResult {
  storageKey: SerializedStorageKey
}

export interface ClearDataForOriginParams {
  origin: string
  storageTypes: string
}

export interface ClearDataForStorageKeyParams {
  storageKey: string
  storageTypes: string
}

export interface GetCookiesParams {
  browserContextId?: BrowserContextID
}

export interface GetCookiesResult {
  cookies: Cookie[]
}

export interface SetCookiesParams {
  cookies: CookieParam[]
  browserContextId?: BrowserContextID
}

export interface ClearCookiesParams {
  browserContextId?: BrowserContextID
}

export interface GetUsageAndQuotaParams {
  origin: string
}

export interface GetUsageAndQuotaResult {
  usage: number
  quota: number
  overrideActive: boolean
  usageBreakdown: UsageForType[]
}

export interface OverrideQuotaForOriginParams {
  origin: string
  quotaSize?: number
}

export interface TrackCacheStorageForOriginParams {
  origin: string
}

export interface TrackCacheStorageForStorageKeyParams {
  storageKey: string
}

export interface TrackIndexedDBForOriginParams {
  origin: string
}

export interface TrackIndexedDBForStorageKeyParams {
  storageKey: string
}

export interface UntrackCacheStorageForOriginParams {
  origin: string
}

export interface UntrackCacheStorageForStorageKeyParams {
  storageKey: string
}

export interface UntrackIndexedDBForOriginParams {
  origin: string
}

export interface UntrackIndexedDBForStorageKeyParams {
  storageKey: string
}

export interface GetTrustTokensResult {
  tokens: TrustTokens[]
}

export interface ClearTrustTokensParams {
  issuerOrigin: string
}

export interface ClearTrustTokensResult {
  didDeleteTokens: boolean
}

export interface GetInterestGroupDetailsParams {
  ownerOrigin: string
  name: string
}

export interface GetInterestGroupDetailsResult {
  details: Record<string, unknown>
}

export interface SetInterestGroupTrackingParams {
  enable: boolean
}

export interface SetInterestGroupAuctionTrackingParams {
  enable: boolean
}

export interface GetSharedStorageMetadataParams {
  ownerOrigin: string
}

export interface GetSharedStorageMetadataResult {
  metadata: SharedStorageMetadata
}

export interface GetSharedStorageEntriesParams {
  ownerOrigin: string
}

export interface GetSharedStorageEntriesResult {
  entries: SharedStorageEntry[]
}

export interface SetSharedStorageEntryParams {
  ownerOrigin: string
  key: string
  value: string
  ignoreIfPresent?: boolean
}

export interface DeleteSharedStorageEntryParams {
  ownerOrigin: string
  key: string
}

export interface ClearSharedStorageEntriesParams {
  ownerOrigin: string
}

export interface ResetSharedStorageBudgetParams {
  ownerOrigin: string
}

export interface SetSharedStorageTrackingParams {
  enable: boolean
}

export interface SetStorageBucketTrackingParams {
  storageKey: string
  enable: boolean
}

export interface DeleteStorageBucketParams {
  bucket: StorageBucket
}

export interface RunBounceTrackingMitigationsResult {
  deletedSites: string[]
}

export interface SetAttributionReportingLocalTestingModeParams {
  enabled: boolean
}

export interface SetAttributionReportingTrackingParams {
  enable: boolean
}

export interface SendPendingAttributionReportsResult {
  numSent: number
}

export interface GetRelatedWebsiteSetsResult {
  sets: RelatedWebsiteSet[]
}

export interface GetAffectedUrlsForThirdPartyCookieMetadataParams {
  firstPartyUrl: string
  thirdPartyUrls: string[]
}

export interface GetAffectedUrlsForThirdPartyCookieMetadataResult {
  matchedUrls: string[]
}

export interface SetProtectedAudienceKAnonymityParams {
  owner: string
  name: string
  hashes: string[]
}

// ══ Events ══

export interface CacheStorageContentUpdatedEvent {
  origin: string
  storageKey: string
  bucketId: string
  cacheName: string
}

export interface CacheStorageListUpdatedEvent {
  origin: string
  storageKey: string
  bucketId: string
}

export interface IndexedDBContentUpdatedEvent {
  origin: string
  storageKey: string
  bucketId: string
  databaseName: string
  objectStoreName: string
}

export interface IndexedDBListUpdatedEvent {
  origin: string
  storageKey: string
  bucketId: string
}

export interface InterestGroupAccessedEvent {
  accessTime: TimeSinceEpoch
  type: InterestGroupAccessType
  ownerOrigin: string
  name: string
  componentSellerOrigin?: string
  bid?: number
  bidCurrency?: string
  uniqueAuctionId?: InterestGroupAuctionId
}

export interface InterestGroupAuctionEventOccurredEvent {
  eventTime: TimeSinceEpoch
  type: InterestGroupAuctionEventType
  uniqueAuctionId: InterestGroupAuctionId
  parentAuctionId?: InterestGroupAuctionId
  auctionConfig?: Record<string, unknown>
}

export interface InterestGroupAuctionNetworkRequestCreatedEvent {
  type: InterestGroupAuctionFetchType
  requestId: RequestId
  auctions: InterestGroupAuctionId[]
}

export interface SharedStorageAccessedEvent {
  accessTime: TimeSinceEpoch
  scope: SharedStorageAccessScope
  method: SharedStorageAccessMethod
  mainFrameId: FrameId
  ownerOrigin: string
  ownerSite: string
  params: SharedStorageAccessParams
}

export interface SharedStorageWorkletOperationExecutionFinishedEvent {
  finishedTime: TimeSinceEpoch
  executionTime: number
  method: SharedStorageAccessMethod
  operationId: string
  workletTargetId: TargetID
  mainFrameId: FrameId
  ownerOrigin: string
}

export interface StorageBucketCreatedOrUpdatedEvent {
  bucketInfo: StorageBucketInfo
}

export interface StorageBucketDeletedEvent {
  bucketId: string
}

export interface AttributionReportingSourceRegisteredEvent {
  registration: AttributionReportingSourceRegistration
  result: AttributionReportingSourceRegistrationResult
}

export interface AttributionReportingTriggerRegisteredEvent {
  registration: AttributionReportingTriggerRegistration
  eventLevel: AttributionReportingEventLevelResult
  aggregatable: AttributionReportingAggregatableResult
}

export interface AttributionReportingReportSentEvent {
  url: string
  body: Record<string, unknown>
  result: AttributionReportingReportResult
  netError?: number
  netErrorName?: string
  httpStatusCode?: number
}

export interface AttributionReportingVerboseDebugReportSentEvent {
  url: string
  body?: Record<string, unknown>[]
  netError?: number
  netErrorName?: string
  httpStatusCode?: number
}
