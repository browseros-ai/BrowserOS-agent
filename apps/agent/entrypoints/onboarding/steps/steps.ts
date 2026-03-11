import { StepConnectApps } from './StepConnectApps'
import { StepImport } from './StepImport'
import { StepOne } from './StepOne'
import { StepSignIn } from './StepSignIn'

export const steps = [
  { id: 1, name: 'Your Name', component: StepOne },
  { id: 2, name: 'Import', component: StepImport },
  { id: 3, name: 'Sign In', component: StepSignIn },
  { id: 4, name: 'Connect Apps', component: StepConnectApps },
]
