import type { FC } from 'react'
import { Navigate } from 'react-router'

export const OnboardingDemo: FC = () => {
  return <Navigate to="/onboarding/steps/5" replace />
}
