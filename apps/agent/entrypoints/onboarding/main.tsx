import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/styles/global.css'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { Toaster } from '@/components/ui/sonner'
import { AnalyticsProvider } from '@/lib/analytics/AnalyticsProvider.tsx'
import { sentryRootErrorHandler } from '@/lib/sentry/sentryRootErrorHandler.ts'
import { UnifiedApp } from '../shared/UnifiedApp'

const $root = document.getElementById('root')

if ($root) {
  ReactDOM.createRoot($root, sentryRootErrorHandler).render(
    <React.StrictMode>
      <AnalyticsProvider>
        <ThemeProvider>
          <UnifiedApp initialRoute="/onboarding" />
          <Toaster />
        </ThemeProvider>
      </AnalyticsProvider>
    </React.StrictMode>,
  )
}
