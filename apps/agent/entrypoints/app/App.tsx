import { type FC, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider'

import { NewTab } from '../newtab/index/NewTab'
import { NewTabLayout } from '../newtab/layout/NewTabLayout'
import { Personalize } from '../newtab/personalize/Personalize'

import { FeaturesPage } from '../onboarding/features/Features'
import { Onboarding } from '../onboarding/index/Onboarding'
import { StepsLayout } from '../onboarding/steps/StepsLayout'

import { AISettingsPage } from './ai-settings/AISettingsPage'
import { ConnectMCP } from './connect-mcp/ConnectMCP'
import { CreateGraph } from './create-graph/CreateGraph'
import { CustomizationPage } from './customization/CustomizationPage'
import { SurveyPage } from './jtbd-agent/SurveyPage'
import { DashboardLayout } from './layout/DashboardLayout'
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

function getOptionsInitialRoute(): string {
  const params = new URLSearchParams(window.location.search)
  const page = params.get('page')
  if (page === 'survey') return '/options/jtbd-agent'
  return '/options/ai'
}

const OptionsRouteWrapper: FC = () => {
  const surveyParams = getSurveyParams()

  return (
    <RpcClientProvider>
      <Routes>
        <Route element={<DashboardLayout />}>
          <Route
            index
            element={<Navigate to={getOptionsInitialRoute()} replace />}
          />
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
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="jtbd-agent" element={<SurveyPage {...surveyParams} />} />
        </Route>
        <Route path="create-graph" element={<CreateGraph />} />
      </Routes>
    </RpcClientProvider>
  )
}

export const App: FC = () => {
  return (
    <HashRouter>
      <Suspense fallback={<div className="h-dvh w-dvw bg-background" />}>
        <Routes>
          {/* Newtab routes (root) */}
          <Route element={<NewTabLayout />}>
            <Route index element={<NewTab />} />
            <Route path="personalize" element={<Personalize />} />
          </Route>

          {/* Onboarding routes */}
          <Route path="onboarding">
            <Route index element={<Onboarding />} />
            <Route path="steps/:stepId" element={<StepsLayout />} />
            <Route path="features" element={<FeaturesPage />} />
          </Route>

          {/* Options routes - wrapped with RpcClientProvider */}
          <Route path="options/*" element={<OptionsRouteWrapper />} />

          {/* Fallback to newtab */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
