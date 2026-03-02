// ── AUTO-GENERATED from CDP protocol. DO NOT EDIT. ──

// ══ Types ══

export type CentralState = 'absent' | 'powered-off' | 'powered-on'

export type GATTOperationType = 'connection' | 'discovery'

export type CharacteristicWriteType =
  | 'write-default-deprecated'
  | 'write-with-response'
  | 'write-without-response'

export type CharacteristicOperationType =
  | 'read'
  | 'write'
  | 'subscribe-to-notifications'
  | 'unsubscribe-from-notifications'

export type DescriptorOperationType = 'read' | 'write'

export interface ManufacturerData {
  key: number
  data: string
}

export interface ScanRecord {
  name?: string
  uuids?: string[]
  appearance?: number
  txPower?: number
  manufacturerData?: ManufacturerData[]
}

export interface ScanEntry {
  deviceAddress: string
  rssi: number
  scanRecord: ScanRecord
}

export interface CharacteristicProperties {
  broadcast?: boolean
  read?: boolean
  writeWithoutResponse?: boolean
  write?: boolean
  notify?: boolean
  indicate?: boolean
  authenticatedSignedWrites?: boolean
  extendedProperties?: boolean
}

// ══ Commands ══

export interface EnableParams {
  state: CentralState
  leSupported: boolean
}

export interface SetSimulatedCentralStateParams {
  state: CentralState
}

export interface SimulatePreconnectedPeripheralParams {
  address: string
  name: string
  manufacturerData: ManufacturerData[]
  knownServiceUuids: string[]
}

export interface SimulateAdvertisementParams {
  entry: ScanEntry
}

export interface SimulateGATTOperationResponseParams {
  address: string
  type: GATTOperationType
  code: number
}

export interface SimulateCharacteristicOperationResponseParams {
  characteristicId: string
  type: CharacteristicOperationType
  code: number
  data?: string
}

export interface SimulateDescriptorOperationResponseParams {
  descriptorId: string
  type: DescriptorOperationType
  code: number
  data?: string
}

export interface AddServiceParams {
  address: string
  serviceUuid: string
}

export interface AddServiceResult {
  serviceId: string
}

export interface RemoveServiceParams {
  serviceId: string
}

export interface AddCharacteristicParams {
  serviceId: string
  characteristicUuid: string
  properties: CharacteristicProperties
}

export interface AddCharacteristicResult {
  characteristicId: string
}

export interface RemoveCharacteristicParams {
  characteristicId: string
}

export interface AddDescriptorParams {
  characteristicId: string
  descriptorUuid: string
}

export interface AddDescriptorResult {
  descriptorId: string
}

export interface RemoveDescriptorParams {
  descriptorId: string
}

export interface SimulateGATTDisconnectionParams {
  address: string
}

// ══ Events ══

export interface GattOperationReceivedEvent {
  address: string
  type: GATTOperationType
}

export interface CharacteristicOperationReceivedEvent {
  characteristicId: string
  type: CharacteristicOperationType
  data?: string
  writeType?: CharacteristicWriteType
}

export interface DescriptorOperationReceivedEvent {
  descriptorId: string
  type: DescriptorOperationType
  data?: string
}
