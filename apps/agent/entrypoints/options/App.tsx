import type { FC } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AISettingsPage } from './ai-settings/AISettingsPage'
import { ConnectMCP } from './connect-mcp/ConnectMCP'
import { CreateGraph } from './create-graph/CreateGraph'
import { CustomizationPage } from './customization/CustomizationPage'
import { JTBDAgentPage } from './jtbd-agent/jtbd-agent-page'
import { DashboardLayout } from './layout/DashboardLayout'
import { LlmHubPage } from './llm-hub/LlmHubPage'
import { MCPSettingsPage } from './mcp-settings/MCPSettingsPage'
import { ScheduledTasksPage } from './scheduled-tasks/ScheduledTasksPage'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to="/ai" replace />} />
          <Route path="ai" element={<AISettingsPage key="ai" />} />
          <Route path="chat" element={<LlmHubPage />} />
          <Route path="search" element={null} />
          <Route path="connect-mcp" element={<ConnectMCP />} />
          <Route path="mcp" element={<MCPSettingsPage />} />
          <Route path="customization" element={<CustomizationPage />} />
          <Route
            path="onboarding"
            element={<AISettingsPage key="onboarding" />}
          />
          <Route path="scheduled" element={<ScheduledTasksPage />} />
          <Route path="jtbd-agent" element={<JTBDAgentPage />} />
        </Route>
        <Route path="create-graph" element={<CreateGraph />} />
      </Routes>
    </HashRouter>
  )
}
