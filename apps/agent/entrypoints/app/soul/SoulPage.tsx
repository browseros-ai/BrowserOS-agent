import type { FC } from 'react'
import { NewTabBranding } from '@/entrypoints/newtab/index/NewTabBranding'
import { SoulExamples } from './SoulExamples'
import { SoulHeader } from './SoulHeader'
import { SoulInspiration } from './SoulInspiration'
import { SoulViewer } from './SoulViewer'

export const SoulPage: FC = () => {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <NewTabBranding />
      <SoulHeader />
      <SoulViewer />
      <SoulExamples />
      <SoulInspiration />
    </div>
  )
}
