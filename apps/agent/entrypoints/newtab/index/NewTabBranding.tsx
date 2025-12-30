import type { FC } from 'react'
import ProductLogoSvg from '@/assets/product_logo.svg'

export const NewTabBranding: FC = () => {
  return (
    <div className="space-y-4 text-center">
      <div className="mb-2 flex items-center justify-center gap-3">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-transparent">
          <img src={ProductLogoSvg} alt="BrowserOS" className="h-20 w-20" />
        </div>
      </div>
    </div>
  )
}
