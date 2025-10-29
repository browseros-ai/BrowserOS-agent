import React from 'react'
import { createRoot } from 'react-dom/client'
import { OnboardingApp } from './OnboardingApp'

try {
  const container = document.getElementById('root')
  if (!container) {
    throw new Error('Root element not found')
  }

  const root = createRoot(container)
  root.render(
    <React.StrictMode>
      <OnboardingApp />
    </React.StrictMode>
  )
} catch (error) {
  console.error('[Onboarding] Fatal error during initialization:', error)
  // Show error to user
  document.body.innerHTML = `
    <div style="padding: 20px; font-family: system-ui; max-width: 600px; margin: 50px auto;">
      <h1 style="color: #ff4444;">Onboarding Error</h1>
      <p>Failed to initialize onboarding:</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px;">${error}</pre>
      <p>Please check the console for more details.</p>
    </div>
  `
}
