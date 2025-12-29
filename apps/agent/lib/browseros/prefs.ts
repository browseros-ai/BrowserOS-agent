/** @public */
export const BROWSEROS_PREFS = {
  AGENT_PORT: 'browseros.server.agent_port',
  MCP_PORT: 'browseros.server.mcp_port',
  PROVIDERS: 'browseros.providers',
  THIRD_PARTY_LLM_PROVIDERS: 'browseros.third_party_llm.providers',
  THIRD_PARTY_LLM_SELECTED: 'browseros.third_party_llm.selected_provider',
  ALLOW_REMOTE_MCP: 'browseros.server.allow_remote_in_mcp',
  RESTART_SERVER: 'browseros.server.restart_requested',
} as const
