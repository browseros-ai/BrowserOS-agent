import type { FC } from 'react'
import { SoulExamples } from './SoulExamples'
import { SoulHeader } from './SoulHeader'
import { SoulInspiration } from './SoulInspiration'
import { SoulViewer } from './SoulViewer'

export const SoulPage: FC = () => {
  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <SoulHeader />
      <SoulViewer />
      <SoulExamples />
      <SoulInspiration />
    </div>
  )
}
