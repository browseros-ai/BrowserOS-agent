export interface SharedSidepanelSession {
  id: string
  rootTabId: number
  conversationId: string
  tabIds: number[]
  updatedAt: number
}

interface SharedSidepanelTabLink {
  sessionId: string
}

export interface SharedSidepanelState {
  tabs: Record<string, SharedSidepanelTabLink>
  sessions: Record<string, SharedSidepanelSession>
}

interface EnsureSharedSidepanelSessionParams {
  tabId: number
  conversationId: string
  sessionId?: string
  rootTabId?: number
  updatedAt?: number
}

interface LinkTabToSharedSidepanelSessionParams {
  sourceTabId: number
  targetTabId: number
  conversationId: string
  sessionId?: string
  updatedAt?: number
}

export const EMPTY_SHARED_SIDEPANEL_STATE: SharedSidepanelState = {
  tabs: {},
  sessions: {},
}

function getTabKey(tabId: number): string {
  return String(tabId)
}

function uniqTabIds(tabIds: number[]): number[] {
  return [...new Set(tabIds)]
}

export function getSharedSidepanelSessionForTabFromState(
  state: SharedSidepanelState,
  tabId: number,
): SharedSidepanelSession | null {
  const sessionId = state.tabs[getTabKey(tabId)]?.sessionId
  if (!sessionId) return null
  return state.sessions[sessionId] ?? null
}

function removeTabLinkFromSession(
  state: SharedSidepanelState,
  tabId: number,
): SharedSidepanelState {
  const tabKey = getTabKey(tabId)
  const sessionId = state.tabs[tabKey]?.sessionId
  if (!sessionId) return state

  const session = state.sessions[sessionId]
  const nextTabs = { ...state.tabs }
  delete nextTabs[tabKey]

  if (!session) {
    return {
      tabs: nextTabs,
      sessions: state.sessions,
    }
  }

  const remainingTabIds = session.tabIds.filter((id) => id !== tabId)
  const nextSessions = { ...state.sessions }

  if (remainingTabIds.length === 0) {
    delete nextSessions[sessionId]
  } else {
    nextSessions[sessionId] = {
      ...session,
      tabIds: remainingTabIds,
      updatedAt: Date.now(),
    }
  }

  return {
    tabs: nextTabs,
    sessions: nextSessions,
  }
}

function upsertTabIntoSession(
  state: SharedSidepanelState,
  {
    tabId,
    sessionId,
    conversationId,
    rootTabId,
    updatedAt = Date.now(),
  }: Required<Pick<EnsureSharedSidepanelSessionParams, 'tabId' | 'sessionId'>> &
    Pick<
      EnsureSharedSidepanelSessionParams,
      'conversationId' | 'rootTabId' | 'updatedAt'
    >,
): SharedSidepanelState {
  const tabKey = getTabKey(tabId)
  const currentSessionId = state.tabs[tabKey]?.sessionId
  const currentSession = currentSessionId
    ? state.sessions[currentSessionId]
    : undefined
  const nextRootTabId = rootTabId ?? currentSession?.rootTabId ?? tabId
  let nextState = state

  if (currentSessionId && currentSessionId !== sessionId) {
    nextState = removeTabLinkFromSession(nextState, tabId)
  }

  const targetSession = nextState.sessions[sessionId]
  const nextTabIds = uniqTabIds([...(targetSession?.tabIds ?? []), tabId])
  const tabLinkChanged = nextState.tabs[tabKey]?.sessionId !== sessionId
  const sessionChanged =
    !targetSession ||
    targetSession.conversationId !== conversationId ||
    targetSession.rootTabId !== nextRootTabId ||
    targetSession.tabIds.length !== nextTabIds.length ||
    targetSession.tabIds.some(
      (existingTabId, index) => existingTabId !== nextTabIds[index],
    )

  if (!tabLinkChanged && !sessionChanged) {
    return nextState
  }

  return {
    tabs: tabLinkChanged
      ? {
          ...nextState.tabs,
          [tabKey]: { sessionId },
        }
      : nextState.tabs,
    sessions: {
      ...nextState.sessions,
      [sessionId]: {
        id: sessionId,
        rootTabId: nextRootTabId,
        conversationId,
        tabIds: nextTabIds,
        updatedAt,
      },
    },
  }
}

export function ensureSharedSidepanelSessionState(
  state: SharedSidepanelState,
  {
    tabId,
    conversationId,
    sessionId,
    rootTabId,
    updatedAt = Date.now(),
  }: EnsureSharedSidepanelSessionParams,
): SharedSidepanelState {
  const existingSession = getSharedSidepanelSessionForTabFromState(state, tabId)
  const resolvedSessionId = existingSession?.id ?? sessionId

  if (!resolvedSessionId) {
    throw new Error('sessionId is required when creating a new shared session')
  }

  return upsertTabIntoSession(state, {
    tabId,
    sessionId: resolvedSessionId,
    conversationId,
    rootTabId: existingSession?.rootTabId ?? rootTabId ?? tabId,
    updatedAt,
  })
}

export function linkTabToSharedSidepanelSessionState(
  state: SharedSidepanelState,
  {
    sourceTabId,
    targetTabId,
    conversationId,
    sessionId,
    updatedAt = Date.now(),
  }: LinkTabToSharedSidepanelSessionParams,
): SharedSidepanelState {
  const sourceSession = getSharedSidepanelSessionForTabFromState(
    state,
    sourceTabId,
  )
  const targetSession = getSharedSidepanelSessionForTabFromState(
    state,
    targetTabId,
  )
  const resolvedSessionId = sourceSession?.id ?? targetSession?.id ?? sessionId

  if (!resolvedSessionId) {
    throw new Error('sessionId is required when linking a new shared session')
  }

  const rootTabId =
    sourceSession?.rootTabId ?? targetSession?.rootTabId ?? sourceTabId

  let nextState = upsertTabIntoSession(state, {
    tabId: sourceTabId,
    sessionId: resolvedSessionId,
    conversationId,
    rootTabId,
    updatedAt,
  })

  nextState = upsertTabIntoSession(nextState, {
    tabId: targetTabId,
    sessionId: resolvedSessionId,
    conversationId,
    rootTabId,
    updatedAt,
  })

  return nextState
}

export function removeSharedSidepanelSessionTabState(
  state: SharedSidepanelState,
  tabId: number,
): SharedSidepanelState {
  return removeTabLinkFromSession(state, tabId)
}
