/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Centralized file system paths.
 */

export const PATHS = {
  DEFAULT_EXECUTION_DIR: process.cwd(),
  BROWSEROS_DIR_NAME: '.browseros',
  MEMORY_DIR_NAME: 'memory',
  SESSIONS_DIR_NAME: 'sessions',
  TOOL_OUTPUT_DIR_NAME: 'tool-output',
  SOUL_FILE_NAME: 'SOUL.md',
  CORE_MEMORY_FILE_NAME: 'CORE.md',
  MCP_CONFIG_FILE_NAME: 'mcp.json',
  SKILLS_DIR_NAME: 'skills',
  SOUL_MAX_LINES: 150,
  MEMORY_RETENTION_DAYS: 30,
  SESSION_RETENTION_DAYS: 30,
} as const
