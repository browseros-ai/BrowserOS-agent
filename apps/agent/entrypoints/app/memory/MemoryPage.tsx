import type { FC } from 'react'
import { MemoryExamples } from './MemoryExamples'
import { MemoryHeader } from './MemoryHeader'
import { MemoryViewer } from './MemoryViewer'

export const MemoryPage: FC = () => {
  return (
    <div className="fade-in slide-in-from-bottom-5 mx-auto w-full max-w-3xl animate-in space-y-6 duration-500">
      <MemoryHeader />
      <MemoryViewer />
      <MemoryExamples />
    </div>
  )
}
