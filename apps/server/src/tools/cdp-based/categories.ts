/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export enum ToolCategory {
  INPUT = 'input',
  NAVIGATION = 'navigation',
  EMULATION = 'emulation',
  PERFORMANCE = 'performance',
  NETWORK = 'network',
  DEBUGGING = 'debugging',
  EXTENSIONS = 'extensions',
}

export const labels = {
  [ToolCategory.INPUT]: 'Input automation',
  [ToolCategory.NAVIGATION]: 'Navigation automation',
  [ToolCategory.EMULATION]: 'Emulation',
  [ToolCategory.PERFORMANCE]: 'Performance',
  [ToolCategory.NETWORK]: 'Network',
  [ToolCategory.DEBUGGING]: 'Debugging',
  [ToolCategory.EXTENSIONS]: 'Extensions',
}
