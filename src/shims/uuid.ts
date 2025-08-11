// Minimal shim to satisfy uuid v4 import in browser bundle
export function v4(): string {
  // Simple RFC4122-ish random UUID
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  return tpl.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export function v5(_namespace?: string, _name?: string): string {
  // Non-cryptographic stub; reuse v4 for bundling
  return v4()
}

export function validate(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

const defaultExport = { v4, v5, validate }
export default defaultExport


