import { storage } from '@wxt-dev/storage'

export interface JtbdPopupState {
  messageCount: number
  surveyTaken: boolean
  samplingId: number
}

export const jtbdPopupStorage = storage.defineItem<JtbdPopupState>(
  'local:jtbdPopupState',
  {
    fallback: {
      messageCount: 0,
      surveyTaken: false,
      samplingId: -1,
    },
  },
)
