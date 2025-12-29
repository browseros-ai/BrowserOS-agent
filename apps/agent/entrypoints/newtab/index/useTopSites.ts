import { take } from 'es-toolkit/array'
import { useEffect, useState } from 'react'
import { getFavicons } from '@/lib/getFavicons'

interface TopSite {
  name: string
  icon?: string
  url: string
}

export const useTopSites = () => {
  const [topSites, setTopSites] = useState<TopSite[]>([])

  useEffect(() => {
    chrome.topSites.get().then((urls) => {
      const firstFive = take(urls, 5)
      setTopSites(
        firstFive.map((each) => {
          let icon: string | undefined
          try {
            const host = new URL(each.url).host
            icon = getFavicons(host)
          } catch {
            // invalid url - no action needed
          }
          return {
            name: each.title,
            url: each.url,
            icon,
          }
        }),
      )
    })
  }, [])

  return topSites
}
