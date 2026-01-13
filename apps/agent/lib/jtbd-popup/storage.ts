import { storage } from '@wxt-dev/storage'

export interface JtbdPopupState {
  conversationCount: number
  surveyTaken: boolean
  samplingId: number
}

export const jtbdPopupStorage = storage.defineItem<JtbdPopupState>(
  'local:jtbdPopupState',
  {
    fallback: {
      conversationCount: 0,
      surveyTaken: false,
      samplingId: -1,
    },
  },
)
