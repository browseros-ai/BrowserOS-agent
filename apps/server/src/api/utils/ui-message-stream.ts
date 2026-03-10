/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { UIMessageStreamEvent } from '@browseros/shared/schemas/ui-stream'

export function formatUIMessageStreamEvent(
  event: UIMessageStreamEvent,
): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function formatUIMessageStreamDone(): string {
  return 'data: [DONE]\n\n'
}
