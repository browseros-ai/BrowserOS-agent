// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type LoginState = 'SignIn' | 'SignUp'

export type DialogType =
  | 'AccountChooser'
  | 'AutoReauthn'
  | 'ConfirmIdpLogin'
  | 'Error'

export type DialogButton =
  | 'ConfirmIdpLoginContinue'
  | 'ErrorGotIt'
  | 'ErrorMoreDetails'

export type AccountUrlType = 'TermsOfService' | 'PrivacyPolicy'

export interface Account {
  accountId: string
  email: string
  name: string
  givenName: string
  pictureUrl: string
  idpConfigUrl: string
  idpLoginUrl: string
  loginState: LoginState
  termsOfServiceUrl?: string
  privacyPolicyUrl?: string
}

// ══ Commands ══

export interface EnableParams {
  disableRejectionDelay?: boolean
}

export interface SelectAccountParams {
  dialogId: string
  accountIndex: number
}

export interface ClickDialogButtonParams {
  dialogId: string
  dialogButton: DialogButton
}

export interface OpenUrlParams {
  dialogId: string
  accountIndex: number
  accountUrlType: AccountUrlType
}

export interface DismissDialogParams {
  dialogId: string
  triggerCooldown?: boolean
}

// ══ Events ══

export interface DialogShownEvent {
  dialogId: string
  dialogType: DialogType
  accounts: Account[]
  title: string
  subtitle?: string
}

export interface DialogClosedEvent {
  dialogId: string
}
