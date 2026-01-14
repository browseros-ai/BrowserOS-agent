import React from 'react'
import ReactDOM from 'react-dom/client'
import '@/styles/global.css'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { Toaster } from '@/components/ui/sonner'
import { AnalyticsProvider } from '@/lib/analytics/AnalyticsProvider.tsx'
import { RpcClientProvider } from '@/lib/rpc/RpcClientProvider.tsx'
import { sentryRootErrorHandler } from '@/lib/sentry/sentryRootErrorHandler.ts'
import { App } from './App.tsx'

const $root = document.getElementById('root')

if ($root) {
  ReactDOM.createRoot($root, sentryRootErrorHandler).render(
    <React.StrictMode>
      <AnalyticsProvider>
        <RpcClientProvider>
          <ThemeProvider>
            <App />
            <Toaster />
          </ThemeProvider>
        </RpcClientProvider>
      </AnalyticsProvider>
    </React.StrictMode>,
  )
}
