import { storage } from '@wxt-dev/storage'
import {
  EMPTY_SHARED_SIDEPANEL_STATE,
  ensureSharedSidepanelSessionState,
  getSharedSidepanelSessionForTabFromState,
  linkTabToSharedSidepanelSessionState,
  removeSharedSidepanelSessionTabState,
  type SharedSidepanelSession,
  type SharedSidepanelState,
} from './shared-sidepanel-session-state'

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

const sharedSidepanelSessionStorage = storage.defineItem<SharedSidepanelState>(
  'local:shared-sidepanel-sessions',
  {
    fallback: EMPTY_SHARED_SIDEPANEL_STATE,
  },
)

async function updateSharedSidepanelState(
  updater: (state: SharedSidepanelState) => SharedSidepanelState,
): Promise<SharedSidepanelState> {
  const currentState = await sharedSidepanelSessionStorage.getValue()
  const safeState = currentState ?? EMPTY_SHARED_SIDEPANEL_STATE
  const nextState = updater(safeState)

  if (nextState !== safeState) {
    await sharedSidepanelSessionStorage.setValue(nextState)
  }

  return nextState
}

export async function getSharedSidepanelSessionForTab(
  tabId: number,
): Promise<SharedSidepanelSession | null> {
  const state = await sharedSidepanelSessionStorage.getValue()
  return getSharedSidepanelSessionForTabFromState(
    state ?? EMPTY_SHARED_SIDEPANEL_STATE,
    tabId,
  )
}

export async function ensureSharedSidepanelSession(
  params: Omit<EnsureSharedSidepanelSessionParams, 'sessionId'>,
): Promise<SharedSidepanelSession | null> {
  const nextState = await updateSharedSidepanelState((state) =>
    ensureSharedSidepanelSessionState(state, {
      ...params,
      sessionId: crypto.randomUUID(),
    }),
  )

  return getSharedSidepanelSessionForTabFromState(nextState, params.tabId)
}

export async function linkTabToSharedSidepanelSession(
  params: Omit<LinkTabToSharedSidepanelSessionParams, 'sessionId'>,
): Promise<SharedSidepanelSession | null> {
  const nextState = await updateSharedSidepanelState((state) =>
    linkTabToSharedSidepanelSessionState(state, {
      ...params,
      sessionId: crypto.randomUUID(),
    }),
  )

  return getSharedSidepanelSessionForTabFromState(nextState, params.targetTabId)
}

export async function removeTabFromSharedSidepanelSession(
  tabId: number,
): Promise<void> {
  await updateSharedSidepanelState((state) =>
    removeSharedSidepanelSessionTabState(state, tabId),
  )
}

export function watchSharedSidepanelSessionForTab(
  tabId: number,
  callback: (session: SharedSidepanelSession | null) => void,
): () => void {
  return sharedSidepanelSessionStorage.watch((state) => {
    callback(
      getSharedSidepanelSessionForTabFromState(
        state ?? EMPTY_SHARED_SIDEPANEL_STATE,
        tabId,
      ),
    )
  })
}
