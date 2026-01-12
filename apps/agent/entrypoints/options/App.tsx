import type { FC } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { AISettingsPage } from './ai-settings/AISettingsPage'
import { ConnectMCP } from './connect-mcp/ConnectMCP'
import { CustomizationPage } from './customization/CustomizationPage'
import { SurveyPage } from './jtbd-agent'
import { DashboardLayout } from './layout/DashboardLayout'
import { LlmHubPage } from './llm-hub/LlmHubPage'
import { MCPSettingsPage } from './mcp-settings/MCPSettingsPage'
import { ScheduledTasksPage } from './scheduled-tasks/ScheduledTasksPage'

// Check query params for direct page navigation
function getInitialRoute(): string {
  const params = new URLSearchParams(window.location.search)
  const page = params.get('page')
  if (page === 'survey') return '/jtbd-agent'
  return '/ai'
}

export const App: FC = () => {
  const initialRoute = getInitialRoute()

  return (
    <HashRouter>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route index element={<Navigate to={initialRoute} replace />} />
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
          <Route path="jtbd-agent" element={<SurveyPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
