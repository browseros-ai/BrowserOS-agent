import React from 'react'
import ReactDOM from 'react-dom/client'
import { NewTab } from './NewTab'
import { ErrorBoundary } from '@/sidepanel/components/ErrorBoundary'
import { initializeMetrics } from '@/lib/utils/Posthog'
import './styles.css'

initializeMetrics()

const root = ReactDOM.createRoot(document.getElementById('root')!)

root.render(
  <React.StrictMode>
    <ErrorBoundary onError={(error) => console.error('NewTab Error:', error)}>
      <NewTab />
    </ErrorBoundary>
  </React.StrictMode>
)
