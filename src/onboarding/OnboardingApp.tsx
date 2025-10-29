import React, { useEffect } from 'react'
import { useOnboardingStore } from './stores/onboardingStore'
import { useSettingsStore } from '@/sidepanel/stores/settingsStore'
import { OnboardingLayout } from './components/OnboardingLayout'
import { WelcomeStep } from './components/WelcomeStep'
import { StepOne } from './components/StepOne'
import { StepTwo } from './components/StepTwo'
import { StepThree } from './components/StepThree'
import { VideoStep } from './components/VideoStep'
import { CompletionScreen } from './components/CompletionScreen'
import { FeatureAgentMode } from './components/features/FeatureAgentMode'
import { FeatureSplitView } from './components/features/FeatureSplitView'
import { FeatureTeachMode } from './components/features/FeatureTeachMode'
import { FeatureQuickSearch } from './components/features/FeatureQuickSearch'
import './styles.css'

export function OnboardingApp() {
  const { currentStep } = useOnboardingStore()
  const { theme } = useSettingsStore()

  // Apply theme on mount and when it changes
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark', 'gray')
    if (theme === 'dark') root.classList.add('dark')
    if (theme === 'gray') root.classList.add('gray')
  }, [theme])

  // Render the appropriate step component
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />
      case 1:
        return <StepOne />
      case 2:
        return <StepTwo />
      case 3:
        return <StepThree />
      case 4:
        return <VideoStep />
      case 5:
        return <CompletionScreen />
      case 6:
        return <FeatureSplitView />
      case 7:
        return <FeatureAgentMode />
      case 8:
        return <FeatureTeachMode />
      case 9:
        return <FeatureQuickSearch />
      default:
        return <WelcomeStep />
    }
  }

  return (
    <OnboardingLayout>
      <div className="transition-all duration-300 ease-in-out">
        {renderStep()}
      </div>
    </OnboardingLayout>
  )
}
