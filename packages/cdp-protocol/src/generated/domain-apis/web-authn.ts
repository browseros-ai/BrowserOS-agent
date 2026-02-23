// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

import type {
  AddCredentialParams,
  AddVirtualAuthenticatorParams,
  AddVirtualAuthenticatorResult,
  ClearCredentialsParams,
  CredentialAddedEvent,
  CredentialAssertedEvent,
  CredentialDeletedEvent,
  CredentialUpdatedEvent,
  EnableParams,
  GetCredentialParams,
  GetCredentialResult,
  GetCredentialsParams,
  GetCredentialsResult,
  RemoveCredentialParams,
  RemoveVirtualAuthenticatorParams,
  SetAutomaticPresenceSimulationParams,
  SetCredentialPropertiesParams,
  SetResponseOverrideBitsParams,
  SetUserVerifiedParams,
} from '../domains/web-authn'

export interface WebAuthnApi {
  // ── Commands ──

  enable(params?: EnableParams): Promise<void>
  disable(): Promise<void>
  addVirtualAuthenticator(
    params: AddVirtualAuthenticatorParams,
  ): Promise<AddVirtualAuthenticatorResult>
  setResponseOverrideBits(params: SetResponseOverrideBitsParams): Promise<void>
  removeVirtualAuthenticator(
    params: RemoveVirtualAuthenticatorParams,
  ): Promise<void>
  addCredential(params: AddCredentialParams): Promise<void>
  getCredential(params: GetCredentialParams): Promise<GetCredentialResult>
  getCredentials(params: GetCredentialsParams): Promise<GetCredentialsResult>
  removeCredential(params: RemoveCredentialParams): Promise<void>
  clearCredentials(params: ClearCredentialsParams): Promise<void>
  setUserVerified(params: SetUserVerifiedParams): Promise<void>
  setAutomaticPresenceSimulation(
    params: SetAutomaticPresenceSimulationParams,
  ): Promise<void>
  setCredentialProperties(params: SetCredentialPropertiesParams): Promise<void>

  // ── Events ──

  on(
    event: 'credentialAdded',
    handler: (params: CredentialAddedEvent) => void,
  ): () => void
  on(
    event: 'credentialDeleted',
    handler: (params: CredentialDeletedEvent) => void,
  ): () => void
  on(
    event: 'credentialUpdated',
    handler: (params: CredentialUpdatedEvent) => void,
  ): () => void
  on(
    event: 'credentialAsserted',
    handler: (params: CredentialAssertedEvent) => void,
  ): () => void
}
