/** @public */
export const BROWSEROS_PREFS = {
  AGENT_PORT: 'browseros.server.agent_port',
  MCP_PORT: 'browseros.server.mcp_port',
  PROVIDERS: 'browseros.providers',
  THIRD_PARTY_LLM_PROVIDERS: 'browseros.third_party_llm.providers',
  ALLOW_REMOTE_MCP: 'browseros.server.allow_remote_in_mcp',
  RESTART_SERVER: 'browseros.server.restart_requested',
  SHOW_LLM_CHAT: 'browseros.show_llm_chat',
  SHOW_LLM_HUB: 'browseros.show_llm_hub',
  SHOW_TOOLBAR_LABELS: 'browseros.show_toolbar_labels',
  INSTALL_ID: 'browseros.metrics_install_id',
} as const
