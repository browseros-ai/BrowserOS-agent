import type { FC } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AISettingsPage } from './ai-settings/AISettingsPage'
import { ConnectMCP } from './connect-mcp/ConnectMCP'
import { DashboardLayout } from './layout/DashboardLayout'
import { LlmHubPage } from './llm-hub/LlmHubPage'
import { MCPSettingsPage } from './mcp-settings/MCPSettingsPage'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/ai" replace />} />
          <Route path="ai" element={<AISettingsPage key="ai" />} />
          <Route path="chat" element={<LlmHubPage />} />
          <Route path="search" element={<></>} />
          <Route path="connect-mcp" element={<ConnectMCP />} />
          <Route path="mcp" element={<MCPSettingsPage />} />
          <Route
            path="onboarding"
            element={<AISettingsPage key="onboarding" />}
          />
        </Route>
      </Routes>
    </HashRouter>
  )
}
