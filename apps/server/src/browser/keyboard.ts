import type { CdpBackend } from './backends/types'

type KeyInfo = { code: string; keyCode: number | undefined }

const KEY_MAP: Record<string, KeyInfo> = {
  Backspace: { code: 'Backspace', keyCode: 8 },
  Tab: { code: 'Tab', keyCode: 9 },
  Enter: { code: 'Enter', keyCode: 13 },
  Escape: { code: 'Escape', keyCode: 27 },
  Space: { code: 'Space', keyCode: 32 },
  ' ': { code: 'Space', keyCode: 32 },
  PageUp: { code: 'PageUp', keyCode: 33 },
  PageDown: { code: 'PageDown', keyCode: 34 },
  End: { code: 'End', keyCode: 35 },
  Home: { code: 'Home', keyCode: 36 },
  ArrowLeft: { code: 'ArrowLeft', keyCode: 37 },
  ArrowUp: { code: 'ArrowUp', keyCode: 38 },
  ArrowRight: { code: 'ArrowRight', keyCode: 39 },
  ArrowDown: { code: 'ArrowDown', keyCode: 40 },
  Insert: { code: 'Insert', keyCode: 45 },
  Delete: { code: 'Delete', keyCode: 46 },
  Shift: { code: 'ShiftLeft', keyCode: 16 },
  Control: { code: 'ControlLeft', keyCode: 17 },
  Alt: { code: 'AltLeft', keyCode: 18 },
  Meta: { code: 'MetaLeft', keyCode: 91 },
  F1: { code: 'F1', keyCode: 112 },
  F2: { code: 'F2', keyCode: 113 },
  F3: { code: 'F3', keyCode: 114 },
  F4: { code: 'F4', keyCode: 115 },
  F5: { code: 'F5', keyCode: 116 },
  F6: { code: 'F6', keyCode: 117 },
  F7: { code: 'F7', keyCode: 118 },
  F8: { code: 'F8', keyCode: 119 },
  F9: { code: 'F9', keyCode: 120 },
  F10: { code: 'F10', keyCode: 121 },
  F11: { code: 'F11', keyCode: 122 },
  F12: { code: 'F12', keyCode: 123 },
}

const MODIFIER_BIT: Record<string, number> = {
  Alt: 1,
  Control: 2,
  Meta: 4,
  Shift: 8,
}

export function getKeyInfo(key: string): KeyInfo {
  if (KEY_MAP[key]) return KEY_MAP[key]

  if (key.length === 1) {
    if (key >= 'a' && key <= 'z')
      return {
        code: `Key${key.toUpperCase()}`,
        keyCode: key.toUpperCase().charCodeAt(0),
      }
    if (key >= 'A' && key <= 'Z')
      return { code: `Key${key}`, keyCode: key.charCodeAt(0) }
    if (key >= '0' && key <= '9')
      return { code: `Digit${key}`, keyCode: key.charCodeAt(0) }
  }

  return { code: key, keyCode: undefined }
}

export function modifierBitmask(modifiers: string[]): number {
  let mask = 0
  for (const mod of modifiers) {
    mask |= MODIFIER_BIT[mod] ?? 0
  }
  return mask
}

export async function typeText(
  cdp: CdpBackend,
  sessionId: string,
  text: string,
): Promise<void> {
  for (const char of text) {
    if (char === '\n') {
      await cdp.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
        },
        sessionId,
      )
      await cdp.send(
        'Input.dispatchKeyEvent',
        { type: 'char', text: '\r', key: 'Enter' },
        sessionId,
      )
      await cdp.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: 'Enter',
          code: 'Enter',
          windowsVirtualKeyCode: 13,
        },
        sessionId,
      )
    } else {
      const info = getKeyInfo(char)
      await cdp.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyDown',
          key: char,
          code: info.code,
          windowsVirtualKeyCode: info.keyCode,
        },
        sessionId,
      )
      await cdp.send(
        'Input.dispatchKeyEvent',
        { type: 'char', text: char, key: char },
        sessionId,
      )
      await cdp.send(
        'Input.dispatchKeyEvent',
        {
          type: 'keyUp',
          key: char,
          code: info.code,
          windowsVirtualKeyCode: info.keyCode,
        },
        sessionId,
      )
    }
  }
}

export async function clearField(
  cdp: CdpBackend,
  sessionId: string,
): Promise<void> {
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyDown',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      key: 'a',
      code: 'KeyA',
      modifiers: 2,
      windowsVirtualKeyCode: 65,
    },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyDown',
      key: 'Delete',
      code: 'Delete',
      windowsVirtualKeyCode: 46,
    },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      key: 'Delete',
      code: 'Delete',
      windowsVirtualKeyCode: 46,
    },
    sessionId,
  )
}

export async function pressCombo(
  cdp: CdpBackend,
  sessionId: string,
  key: string,
): Promise<void> {
  const parts = key.split('+')
  const mainKey = parts.at(-1) ?? key
  const modifiers = parts.slice(0, -1)
  const modBitmask = modifierBitmask(modifiers)

  for (const mod of modifiers) {
    const info = getKeyInfo(mod)
    await cdp.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyDown',
        key: mod,
        code: info.code,
        windowsVirtualKeyCode: info.keyCode,
      },
      sessionId,
    )
  }

  const mainInfo = getKeyInfo(mainKey)
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyDown',
      key: mainKey,
      code: mainInfo.code,
      modifiers: modBitmask,
      windowsVirtualKeyCode: mainInfo.keyCode,
    },
    sessionId,
  )
  await cdp.send(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      key: mainKey,
      code: mainInfo.code,
      modifiers: modBitmask,
      windowsVirtualKeyCode: mainInfo.keyCode,
    },
    sessionId,
  )

  for (const mod of modifiers.reverse()) {
    const info = getKeyInfo(mod)
    await cdp.send(
      'Input.dispatchKeyEvent',
      {
        type: 'keyUp',
        key: mod,
        code: info.code,
        windowsVirtualKeyCode: info.keyCode,
      },
      sessionId,
    )
  }
}
