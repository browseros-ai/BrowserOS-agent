import { type FC, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes, useParams } from 'react-router'

import { NewTab } from '../newtab/index/NewTab'
import { NewTabLayout } from '../newtab/layout/NewTabLayout'
import { Personalize } from '../newtab/personalize/Personalize'
import { FeaturesPage } from '../onboarding/features/Features'
import { Onboarding } from '../onboarding/index/Onboarding'
import { StepsLayout } from '../onboarding/steps/StepsLayout'
import { AISettingsPage } from './ai-settings/AISettingsPage'
import { ConnectMCP } from './connect-mcp/ConnectMCP'
import { CreateGraphWrapper } from './create-graph/CreateGraphWrapper'
import { CustomizationPage } from './customization/CustomizationPage'
import { SurveyPage } from './jtbd-agent/SurveyPage'
import { SettingsSidebarLayout } from './layout/SettingsSidebarLayout'
import { SidebarLayout } from './layout/SidebarLayout'
import { LlmHubPage } from './llm-hub/LlmHubPage'
import { MCPSettingsPage } from './mcp-settings/MCPSettingsPage'
import { ScheduledTasksPage } from './scheduled-tasks/ScheduledTasksPage'
import { WorkflowsPage } from './workflows/WorkflowsPage'

function getSurveyParams(): { maxTurns?: number; experimentId?: string } {
  const params = new URLSearchParams(window.location.search)
  const maxTurnsStr = params.get('maxTurns')
  const experimentId = params.get('experimentId') ?? 'default'
  const maxTurns = maxTurnsStr ? Number.parseInt(maxTurnsStr, 10) : 7
  return { maxTurns, experimentId }
}

const OptionsRedirect: FC = () => {
  const params = useParams()
  const path = params['*'] || ''

  const routeMap: Record<string, string> = {
    ai: '/settings/ai',
    chat: '/settings/chat',
    'connect-mcp': '/settings/connect-mcp',
    mcp: '/settings/mcp',
    customization: '/settings/customization',
    'jtbd-agent': '/settings/survey',
    workflows: '/workflows',
    scheduled: '/scheduled',
    'create-graph': '/workflows/create-graph',
  }

  const newPath = routeMap[path] || '/settings/ai'
  return <Navigate to={newPath} replace />
}

export const App: FC = () => {
  const surveyParams = getSurveyParams()

  return (
    <HashRouter>
      <Suspense fallback={<div className="h-dvh w-dvw bg-background" />}>
        <Routes>
          {/* Main app with sidebar */}
          <Route element={<SidebarLayout />}>
            {/* Home routes */}
            <Route path="home" element={<NewTabLayout />}>
              <Route index element={<NewTab />} />
              <Route path="personalize" element={<Personalize />} />
            </Route>

            {/* Primary nav routes */}
            <Route path="workflows" element={<WorkflowsPage />} />
            <Route path="scheduled" element={<ScheduledTasksPage />} />
          </Route>

          {/* Settings with dedicated sidebar */}
          <Route element={<SettingsSidebarLayout />}>
            <Route path="settings">
              <Route index element={<Navigate to="/settings/ai" replace />} />
              <Route path="ai" element={<AISettingsPage key="ai" />} />
              <Route path="chat" element={<LlmHubPage />} />
              <Route path="connect-mcp" element={<ConnectMCP />} />
              <Route path="mcp" element={<MCPSettingsPage />} />
              <Route path="customization" element={<CustomizationPage />} />
              <Route path="survey" element={<SurveyPage {...surveyParams} />} />
            </Route>
          </Route>

          {/* Full-screen without sidebar */}
          <Route
            path="workflows/create-graph"
            element={<CreateGraphWrapper />}
          />

          {/* Onboarding routes - no sidebar */}
          <Route path="onboarding">
            <Route index element={<Onboarding />} />
            <Route path="steps/:stepId" element={<StepsLayout />} />
            <Route path="features" element={<FeaturesPage />} />
          </Route>

          {/* Backward compatibility redirects */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/personalize"
            element={<Navigate to="/home/personalize" replace />}
          />
          <Route path="/options/*" element={<OptionsRedirect />} />

          {/* Fallback to home */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
