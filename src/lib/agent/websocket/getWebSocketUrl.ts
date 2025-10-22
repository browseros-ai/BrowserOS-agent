/**
 * @license
 * Copyright 2025 BrowserOS
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { WS_AGENT_CONFIG } from "@/lib/agent/websocket/config";
import { Logging } from "@/lib/utils/Logging";
import { getBrowserOSAdapter } from "@/lib/browser/BrowserOSAdapter";

/**
 * Get the WebSocket URL from BrowserOS preferences
 * Returns WebSocket URL using browseros.server.agent_port preference value
 * Falls back to default URL from config if preference cannot be retrieved
 */
export async function getWebSocketUrl(): Promise<string> {
  const browserOS = getBrowserOSAdapter();

  try {
    // Get the agent port from BrowserOS preferences
    const pref = await browserOS.getPref('browseros.server.agent_port');

    if (pref && typeof pref.value === 'number') {
      const wsUrl = `ws://localhost:${pref.value}`;
      Logging.log(
        "WebSocketConfig",
        `Using agent port from BrowserOS preferences: ${pref.value}`,
        "info"
      );
      return wsUrl;
    }

    Logging.log(
      "WebSocketConfig",
      `Agent port preference not found or invalid, using default URL: ${WS_AGENT_CONFIG.url}`,
      "warning"
    );
    return WS_AGENT_CONFIG.url;
  } catch (error) {
    Logging.log(
      "WebSocketConfig",
      `Failed to get agent port from BrowserOS preferences: ${error}, using default URL: ${WS_AGENT_CONFIG.url}`,
      "error"
    );
    return WS_AGENT_CONFIG.url;
  }
}
