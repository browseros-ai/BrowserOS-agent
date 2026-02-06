/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { ToolCategories } from '../types/tool-categories'
import { zod } from './third-party'
import { defineTool } from './tool-definition'

const EXTENSIONS_CONDITION = 'experimentalExtensionSupport'

export const installExtension = defineTool({
  name: 'install_extension',
  description: 'Installs a Chrome extension from the given path.',
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.EXTENSIONS,
    readOnlyHint: false,
    conditions: [EXTENSIONS_CONDITION],
  },
  schema: {
    path: zod
      .string()
      .describe('Absolute path to the unpacked extension folder.'),
  },
  handler: async (request, response, context) => {
    const { path } = request.params
    const id = await context.installExtension(path)
    response.appendResponseLine(`Extension installed. Id: ${id}`)
  },
})

export const uninstallExtension = defineTool({
  name: 'uninstall_extension',
  description: 'Uninstalls a Chrome extension by its ID.',
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.EXTENSIONS,
    readOnlyHint: false,
    conditions: [EXTENSIONS_CONDITION],
  },
  schema: {
    id: zod.string().describe('ID of the extension to uninstall.'),
  },
  handler: async (request, response, context) => {
    const { id } = request.params
    await context.uninstallExtension(id)
    response.appendResponseLine(`Extension uninstalled. Id: ${id}`)
  },
})

export const listExtensions = defineTool({
  name: 'list_extensions',
  description:
    'Lists all extensions via this server, including their name, ID, version, and enabled status.',
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.EXTENSIONS,
    readOnlyHint: true,
    conditions: [EXTENSIONS_CONDITION],
  },
  schema: {},
  handler: async (_request, response, _context) => {
    response.setListExtensions()
  },
})

export const reloadExtension = defineTool({
  name: 'reload_extension',
  description: 'Reloads an unpacked Chrome extension by its ID.',
  kind: 'cdp' as const,
  annotations: {
    category: ToolCategories.EXTENSIONS,
    readOnlyHint: false,
    conditions: [EXTENSIONS_CONDITION],
  },
  schema: {
    id: zod.string().describe('ID of the extension to reload.'),
  },
  handler: async (request, response, context) => {
    const { id } = request.params
    const extension = context.getExtension(id)
    if (!extension) {
      throw new Error(`Extension with ID ${id} not found.`)
    }
    await context.installExtension(extension.path)
    response.appendResponseLine('Extension reloaded.')
  },
})
