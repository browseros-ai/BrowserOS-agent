import { Globe } from 'lucide-react'
import { type FC, useState } from 'react'
import { useTopSites } from './useTopSites'

const TopSiteIcon: FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <Globe className="h-7 w-7 text-foreground" />
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-7 w-7 object-contain"
      onError={() => {
        setFailed(true)
      }}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth === 0 || img.naturalHeight === 0) {
          setFailed(true)
        }
      }}
    />
  )
}

export const TopSites: FC = () => {
  const topSites = useTopSites()

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Top Sites
        </h2>
      </div>
      <div className="flex items-center justify-center gap-6">
        {topSites.map((site, idx) => (
          <a
            key={idx.toString()}
            href={site.url}
            className="group flex flex-col items-center gap-2 transition-transform hover:scale-110"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/50 bg-card shadow-sm transition-transform group-hover:border-[var(--accent-orange)]/30 group-hover:shadow-md">
              {site.icon ? (
                <TopSiteIcon src={site.icon} alt={site.name} />
              ) : (
                <Globe className="h-7 w-7 text-foreground" />
              )}
            </div>
            <span className="line-clamp-1 max-w-18 text-muted-foreground text-xs transition-colors group-hover:text-foreground">
              {site.name}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
