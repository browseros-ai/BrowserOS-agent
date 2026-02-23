// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  GetAXNodeAndAncestorsParams,
  GetAXNodeAndAncestorsResult,
  GetChildAXNodesParams,
  GetChildAXNodesResult,
  GetFullAXTreeParams,
  GetFullAXTreeResult,
  GetPartialAXTreeParams,
  GetPartialAXTreeResult,
  GetRootAXNodeParams,
  GetRootAXNodeResult,
  LoadCompleteEvent,
  NodesUpdatedEvent,
  QueryAXTreeParams,
  QueryAXTreeResult,
} from '../domains/accessibility'

export interface AccessibilityApi {
  // ── Commands ──

  disable(): Promise<void>
  enable(): Promise<void>
  getPartialAXTree(
    params?: GetPartialAXTreeParams,
  ): Promise<GetPartialAXTreeResult>
  getFullAXTree(params?: GetFullAXTreeParams): Promise<GetFullAXTreeResult>
  getRootAXNode(params?: GetRootAXNodeParams): Promise<GetRootAXNodeResult>
  getAXNodeAndAncestors(
    params?: GetAXNodeAndAncestorsParams,
  ): Promise<GetAXNodeAndAncestorsResult>
  getChildAXNodes(params: GetChildAXNodesParams): Promise<GetChildAXNodesResult>
  queryAXTree(params?: QueryAXTreeParams): Promise<QueryAXTreeResult>

  // ── Events ──

  on(
    event: 'loadComplete',
    handler: (params: LoadCompleteEvent) => void,
  ): () => void
  on(
    event: 'nodesUpdated',
    handler: (params: NodesUpdatedEvent) => void,
  ): () => void
}
