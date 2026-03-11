import type { FC } from 'react'
import { ChatSessionProvider } from '@/entrypoints/sidepanel/layout/ChatSessionContext'
import { OnboardingChat } from '../chat/OnboardingChat'
import type { StepDirection } from './StepTransition'

interface StepChatProps {
  direction: StepDirection
  onContinue: () => void
}

export const StepChat: FC<StepChatProps> = (_props) => {
  const handleComplete = () => {
    window.location.href = chrome.runtime.getURL('app.html#/home')
  }

  return (
    <ChatSessionProvider origin="onboarding">
      <OnboardingChat onComplete={handleComplete} />
    </ChatSessionProvider>
  )
}
