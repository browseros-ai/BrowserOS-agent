import { describe, expect, it } from 'bun:test'
import {
  EMPTY_SHARED_SIDEPANEL_STATE,
  ensureSharedSidepanelSessionState,
  getSharedSidepanelSessionForTabFromState,
  linkTabToSharedSidepanelSessionState,
  removeSharedSidepanelSessionTabState,
} from './shared-sidepanel-session-state'

describe('shared sidepanel session state', () => {
  it('creates a new shared session for the originating tab', () => {
    const nextState = ensureSharedSidepanelSessionState(
      EMPTY_SHARED_SIDEPANEL_STATE,
      {
        tabId: 11,
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        updatedAt: 100,
      },
    )

    expect(getSharedSidepanelSessionForTabFromState(nextState, 11)).toEqual({
      id: 'session-1',
      rootTabId: 11,
      conversationId: 'conversation-1',
      tabIds: [11],
      updatedAt: 100,
    })
  })

  it('links an agent-targeted tab into the source session', () => {
    const initialState = ensureSharedSidepanelSessionState(
      EMPTY_SHARED_SIDEPANEL_STATE,
      {
        tabId: 11,
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        updatedAt: 100,
      },
    )

    const nextState = linkTabToSharedSidepanelSessionState(initialState, {
      sourceTabId: 11,
      targetTabId: 42,
      conversationId: 'conversation-1',
      updatedAt: 200,
    })

    expect(getSharedSidepanelSessionForTabFromState(nextState, 42)).toEqual({
      id: 'session-1',
      rootTabId: 11,
      conversationId: 'conversation-1',
      tabIds: [11, 42],
      updatedAt: 200,
    })
  })

  it('updates the shared conversation for an existing session', () => {
    const initialState = ensureSharedSidepanelSessionState(
      EMPTY_SHARED_SIDEPANEL_STATE,
      {
        tabId: 11,
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        updatedAt: 100,
      },
    )

    const nextState = ensureSharedSidepanelSessionState(initialState, {
      tabId: 11,
      conversationId: 'conversation-2',
      updatedAt: 300,
    })

    expect(getSharedSidepanelSessionForTabFromState(nextState, 11)).toEqual({
      id: 'session-1',
      rootTabId: 11,
      conversationId: 'conversation-2',
      tabIds: [11],
      updatedAt: 300,
    })
  })

  it('moves a tab out of its previous session when re-linked', () => {
    const firstSession = ensureSharedSidepanelSessionState(
      EMPTY_SHARED_SIDEPANEL_STATE,
      {
        tabId: 11,
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        updatedAt: 100,
      },
    )

    const secondSession = ensureSharedSidepanelSessionState(firstSession, {
      tabId: 42,
      conversationId: 'conversation-2',
      sessionId: 'session-2',
      updatedAt: 150,
    })

    const relinkedState = linkTabToSharedSidepanelSessionState(secondSession, {
      sourceTabId: 11,
      targetTabId: 42,
      conversationId: 'conversation-1',
      updatedAt: 200,
    })

    expect(getSharedSidepanelSessionForTabFromState(relinkedState, 42)).toEqual(
      {
        id: 'session-1',
        rootTabId: 11,
        conversationId: 'conversation-1',
        tabIds: [11, 42],
        updatedAt: 200,
      },
    )
    expect(relinkedState.sessions['session-2']).toBeUndefined()
  })

  it('removes empty sessions when the last tab is cleared', () => {
    const initialState = ensureSharedSidepanelSessionState(
      EMPTY_SHARED_SIDEPANEL_STATE,
      {
        tabId: 11,
        conversationId: 'conversation-1',
        sessionId: 'session-1',
        updatedAt: 100,
      },
    )

    const nextState = removeSharedSidepanelSessionTabState(initialState, 11)

    expect(getSharedSidepanelSessionForTabFromState(nextState, 11)).toBeNull()
    expect(nextState.sessions['session-1']).toBeUndefined()
  })
})
