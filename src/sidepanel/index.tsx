import React from 'react'
import ReactDOM from 'react-dom/client'
import { SidePanelPage } from './pages/SidePanelPage'
import { App as AppV2 } from './v2/App'

// Feature flag for v2 sidepanel
const USE_V2 = true;

// Log which version is being used
console.log(`[Sidepanel] Using ${USE_V2 ? 'V2' : 'V1'} implementation`)

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
)

root.render(
  <React.StrictMode>
    {USE_V2 ? <AppV2 /> : <SidePanelPage />}
  </React.StrictMode>
) 
