import React from 'react'
import { createRoot } from 'react-dom/client'
import { OptionsNew } from './OptionsNew'

// Initialize React root
const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element not found')
}

const root = createRoot(container)

// Render the Options component
root.render(
  <React.StrictMode>
    <OptionsNew />
  </React.StrictMode>
)