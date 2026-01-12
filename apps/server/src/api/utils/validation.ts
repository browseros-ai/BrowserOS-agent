/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { z } from 'zod'

const SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/

export const SessionIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(SESSION_ID_PATTERN, 'Invalid session ID format')

export const SessionIdParamSchema = z.object({
  id: SessionIdSchema,
})

export const ConversationIdParamSchema = z.object({
  conversationId: z.string().uuid(),
})
