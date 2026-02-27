import { describe, expect, it } from 'bun:test'
import {
  getKeyInfo,
  modifierBitmask,
  normalizeKey,
} from '../../src/browser/keyboard'

describe('normalizeKey', () => {
  it('returns exact KEY_MAP matches unchanged', () => {
    expect(normalizeKey('Enter')).toBe('Enter')
    expect(normalizeKey('Backspace')).toBe('Backspace')
    expect(normalizeKey('ArrowDown')).toBe('ArrowDown')
    expect(normalizeKey('F1')).toBe('F1')
    expect(normalizeKey('Meta')).toBe('Meta')
  })

  it('normalizes case-insensitive key names', () => {
    expect(normalizeKey('enter')).toBe('Enter')
    expect(normalizeKey('ENTER')).toBe('Enter')
    expect(normalizeKey('backspace')).toBe('Backspace')
    expect(normalizeKey('escape')).toBe('Escape')
    expect(normalizeKey('arrowdown')).toBe('ArrowDown')
    expect(normalizeKey('ARROWLEFT')).toBe('ArrowLeft')
    expect(normalizeKey('f12')).toBe('F12')
    expect(normalizeKey('shift')).toBe('Shift')
    expect(normalizeKey('control')).toBe('Control')
    expect(normalizeKey('pageup')).toBe('PageUp')
  })

  it('resolves common aliases', () => {
    expect(normalizeKey('Esc')).toBe('Escape')
    expect(normalizeKey('esc')).toBe('Escape')
    expect(normalizeKey('Del')).toBe('Delete')
    expect(normalizeKey('Ctrl')).toBe('Control')
    expect(normalizeKey('ctrl')).toBe('Control')
    expect(normalizeKey('Cmd')).toBe('Meta')
    expect(normalizeKey('Command')).toBe('Meta')
    expect(normalizeKey('Option')).toBe('Alt')
    expect(normalizeKey('Return')).toBe('Enter')
    expect(normalizeKey('Left')).toBe('ArrowLeft')
    expect(normalizeKey('Right')).toBe('ArrowRight')
    expect(normalizeKey('Up')).toBe('ArrowUp')
    expect(normalizeKey('Down')).toBe('ArrowDown')
  })

  it('passes through single characters unchanged', () => {
    expect(normalizeKey('a')).toBe('a')
    expect(normalizeKey('Z')).toBe('Z')
    expect(normalizeKey('5')).toBe('5')
    expect(normalizeKey(' ')).toBe(' ')
  })

  it('passes through unknown multi-char keys unchanged', () => {
    expect(normalizeKey('SomeUnknownKey')).toBe('SomeUnknownKey')
  })
})

describe('getKeyInfo', () => {
  it('returns correct info for known keys', () => {
    expect(getKeyInfo('Enter')).toEqual({ code: 'Enter', keyCode: 13 })
    expect(getKeyInfo('Backspace')).toEqual({ code: 'Backspace', keyCode: 8 })
    expect(getKeyInfo(' ')).toEqual({ code: 'Space', keyCode: 32 })
  })

  it('infers info for single characters', () => {
    expect(getKeyInfo('a')).toEqual({ code: 'KeyA', keyCode: 65 })
    expect(getKeyInfo('Z')).toEqual({ code: 'KeyZ', keyCode: 90 })
    expect(getKeyInfo('5')).toEqual({ code: 'Digit5', keyCode: 53 })
  })

  it('returns undefined keyCode for unknown keys', () => {
    expect(getKeyInfo('Unknown').keyCode).toBeUndefined()
  })
})

describe('modifierBitmask', () => {
  it('computes correct bitmask', () => {
    expect(modifierBitmask([])).toBe(0)
    expect(modifierBitmask(['Shift'])).toBe(8)
    expect(modifierBitmask(['Control'])).toBe(2)
    expect(modifierBitmask(['Alt'])).toBe(1)
    expect(modifierBitmask(['Meta'])).toBe(4)
    expect(modifierBitmask(['Control', 'Shift'])).toBe(10)
    expect(modifierBitmask(['Control', 'Alt', 'Shift'])).toBe(11)
  })
})
