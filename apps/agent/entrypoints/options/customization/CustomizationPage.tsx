import type { FC } from 'react'
import { CustomizationCard } from './CustomizationCard'

export const CustomizationPage: FC = () => {
  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <CustomizationCard />
    </div>
  )
}
