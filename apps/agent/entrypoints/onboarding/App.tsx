import type { FC } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { FeaturesPage } from './features/Features'
import { Onboarding } from './index/Onboarding'
import { StepsLayout } from './steps/StepsLayout'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<Onboarding />} />
        <Route path="steps/:stepId" element={<StepsLayout />} />
        <Route path="features" element={<FeaturesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
