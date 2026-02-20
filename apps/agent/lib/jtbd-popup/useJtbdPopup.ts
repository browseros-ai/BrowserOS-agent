import { useCallback, useEffect, useState } from 'react'
import {
  JTBD_POPUP_CLICKED_EVENT,
  JTBD_POPUP_DISMISSED_EVENT,
  JTBD_POPUP_SHOWN_EVENT,
} from '@/lib/constants/analyticsEvents'
import { track } from '@/lib/metrics/track'
import { JTBD_POPUP_CONSTANTS } from './constants'
import { type JtbdPopupState, jtbdPopupStorage } from './storage'

// Round 2 directions for random assignment (churn excluded — manual links only)
const R2_DIRECTIONS = [
  'competitor',
  'switching',
  'workflow',
  'activation',
] as const

function pickRandomDirection(): string {
  return R2_DIRECTIONS[Math.floor(Math.random() * R2_DIRECTIONS.length)]
}

const isEligible = (state: JtbdPopupState): boolean => {
  if (state.surveyTaken) return false
  if (state.messageCount < JTBD_POPUP_CONSTANTS.MESSAGE_THRESHOLD) return false
  if (state.messageCount % JTBD_POPUP_CONSTANTS.MESSAGE_THRESHOLD !== 0)
    return false
  if (state.samplingId % JTBD_POPUP_CONSTANTS.SAMPLING_DIVISOR !== 0)
    return false
  return true
}

export function useJtbdPopup() {
  const [popupVisible, setPopupVisible] = useState(false)

  useEffect(() => {
    jtbdPopupStorage.getValue().then(async (val) => {
      if (val.samplingId === -1) {
        const newVal = { ...val, samplingId: Math.floor(Math.random() * 100) }
        await jtbdPopupStorage.setValue(newVal)
      }
    })
  }, [])

  const recordMessageSent = useCallback(async () => {
    const current = await jtbdPopupStorage.getValue()
    const newState = { ...current, messageCount: current.messageCount + 1 }
    await jtbdPopupStorage.setValue(newState)
  }, [])

  const triggerIfEligible = useCallback(async () => {
    const current = await jtbdPopupStorage.getValue()
    if (isEligible(current)) {
      track(JTBD_POPUP_SHOWN_EVENT, { messageCount: current.messageCount })
      setPopupVisible(true)
    }
  }, [])

  const onTakeSurvey = useCallback(
    async ({
      maxTurns = 20,
      experimentId,
      direction,
    }: {
      maxTurns?: number
      experimentId?: string
      direction?: string
    } = {}) => {
      const dir = direction ?? pickRandomDirection()
      const expId = experimentId ?? `r2_${dir}`
      const current = await jtbdPopupStorage.getValue()
      track(JTBD_POPUP_CLICKED_EVENT, {
        messageCount: current.messageCount,
        direction: dir,
      })
      setPopupVisible(false)
      window.open(
        `/app.html?page=survey&maxTurns=${maxTurns}&experimentId=${expId}&direction=${dir}#/settings/survey`,
        '_blank',
      )
    },
    [],
  )

  const onDismiss = useCallback(async () => {
    const current = await jtbdPopupStorage.getValue()
    track(JTBD_POPUP_DISMISSED_EVENT, { messageCount: current.messageCount })
    setPopupVisible(false)
  }, [])

  return {
    popupVisible,
    recordMessageSent,
    triggerIfEligible,
    onTakeSurvey,
    onDismiss,
  }
}
