import { CapabilitiesStep } from './CapabilitiesStep'
import { ImportChromeStep } from './ImportChromeStep'
import { LaunchStep } from './LaunchStep'
import { StepOne } from './StepOne'
import { StepTwo } from './StepTwo'

export const steps = [
  {
    id: 1,
    name: 'About You',
    component: StepOne,
  },
  {
    id: 2,
    name: 'Import Chrome',
    component: ImportChromeStep,
  },
  {
    id: 3,
    name: 'Connect Google',
    component: StepTwo,
  },
  {
    id: 4,
    name: 'Teach Your Agent',
    component: CapabilitiesStep,
  },
  {
    id: 5,
    name: 'Launch',
    component: LaunchStep,
  },
]
