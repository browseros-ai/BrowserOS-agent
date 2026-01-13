import { useCallback, useEffect, useRef, useState } from 'react'
import {
  JTBD_POPUP_CLICKED_EVENT,
  JTBD_POPUP_DISMISSED_EVENT,
  JTBD_POPUP_SHOWN_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { JTBD_POPUP_CONSTANTS } from './constants'
import { type JtbdPopupState, jtbdPopupStorage } from './storage'

const DEFAULT_STATE: JtbdPopupState = {
  conversationCount: 0,
  surveyTaken: false,
  samplingId: -1,
}

const isEligible = (state: JtbdPopupState): boolean => {
  if (state.surveyTaken) return false
  if (state.conversationCount < JTBD_POPUP_CONSTANTS.CONVERSATION_THRESHOLD)
    return false
  if (state.samplingId % JTBD_POPUP_CONSTANTS.SAMPLING_DIVISOR !== 0)
    return false
  return true
}

export function useJtbdPopup() {
  const [state, setState] = useState<JtbdPopupState>(DEFAULT_STATE)
  const [popupVisible, setPopupVisible] = useState(false)
  const stateRef = useRef(state)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    jtbdPopupStorage.getValue().then(async (val) => {
      if (val.samplingId === -1) {
        const newVal = { ...val, samplingId: Math.floor(Math.random() * 100) }
        await jtbdPopupStorage.setValue(newVal)
        setState(newVal)
      } else {
        setState(val)
      }
    })
    const unwatch = jtbdPopupStorage.watch((newValue) => {
      setState(newValue ?? DEFAULT_STATE)
    })
    return unwatch
  }, [])

  const recordConversationStart = useCallback(async () => {
    const currentState = stateRef.current
    const newState = {
      ...currentState,
      conversationCount: currentState.conversationCount + 1,
    }
    await jtbdPopupStorage.setValue(newState)
  }, [])

  const triggerIfEligible = useCallback(() => {
    const currentState = stateRef.current
    if (isEligible(currentState)) {
      track(JTBD_POPUP_SHOWN_EVENT, {
        conversationCount: currentState.conversationCount,
      })
      setPopupVisible(true)
    }
  }, [])

  const onTakeSurvey = useCallback(async () => {
    const currentState = stateRef.current
    track(JTBD_POPUP_CLICKED_EVENT, {
      conversationCount: currentState.conversationCount,
    })
    await jtbdPopupStorage.setValue({ ...currentState, surveyTaken: true })
    setPopupVisible(false)
    window.open('/options.html?page=survey', '_blank')
  }, [])

  const onDismiss = useCallback(() => {
    const currentState = stateRef.current
    track(JTBD_POPUP_DISMISSED_EVENT, {
      conversationCount: currentState.conversationCount,
    })
    setPopupVisible(false)
  }, [])

  return {
    popupVisible,
    recordConversationStart,
    triggerIfEligible,
    onTakeSurvey,
    onDismiss,
  }
}
