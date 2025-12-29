import type { FC, ReactNode } from 'react'

interface FeatureCardsProps {
  href: string
  title: string
  description: string
  icon: ReactNode
}

export const FeatureCards: FC<FeatureCardsProps> = ({
  href,
  title,
  description,
  icon,
}) => {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group relative cursor-pointer overflow-hidden rounded-xl border border-border/50 bg-card p-8 transition-all duration-300 hover:scale-[1.02] hover:border-[var(--accent-orange)]/50 hover:shadow-[var(--accent-orange)]/10 hover:shadow-xl`}
    >
      <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-0 animate-shine bg-gradient-to-br from-[var(--accent-orange)]/10 via-transparent to-transparent"></div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent/5 opacity-0 transition-opacity group-hover:opacity-100"></div>
      <div className="relative space-y-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent transition-all duration-300 group-hover:scale-110 group-hover:bg-[var(--accent-orange)]">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-card-foreground text-lg transition-colors group-hover:text-[var(--accent-orange)]">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </a>
  )
}
