import { DialogClose, DialogContent } from '@radix-ui/react-dialog'
import { ArrowRight, type LucideIcon, X } from 'lucide-react'
import type { FC, ReactNode } from 'react'
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { VideoFrame } from './VideoFrame'

export interface Feature {
  id: string
  Icon: LucideIcon
  tag: string
  title: string
  description: string | ReactNode
  highlights: {
    title: string
    description: string | ReactNode
    Icon: LucideIcon
  }[]
  videoDuration?: string
  tip: string
  gridClass: string
  videoUrl?: string
  gifUrl?: string
}

interface BentoCardProps {
  feature: Feature
  mounted: boolean
  index: number
}

export const BentoCard: FC<BentoCardProps> = ({ feature, mounted, index }) => {
  const { Icon } = feature

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            'feature-card group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-[var(--accent-orange)]/50 hover:shadow-[var(--accent-orange)]/5 hover:shadow-xl',
            feature.gridClass,
          )}
          style={{
            animation: mounted
              ? `fadeInUp 0.6s ease-out ${index * 0.1}s both`
              : 'none',
          }}
        >
          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-orange)]/0 via-[var(--accent-orange)]/0 to-[var(--accent-orange)]/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Shine effect */}
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            <div className="feature-shine" />
          </div>

          <div className="space-between relative z-10 flex h-full flex-col space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <span className="inline-block rounded-md bg-[var(--accent-orange)]/10 px-2.5 py-0.5 font-semibold text-[var(--accent-orange)] text-xs">
                  {feature.tag}
                </span>
                <h3 className="font-bold text-xl transition-colors group-hover:text-[var(--accent-orange)]">
                  {feature.title}
                </h3>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-orange)]/10 transition-all group-hover:scale-110 group-hover:bg-[var(--accent-orange)]">
                <Icon className="h-5 w-5 text-[var(--accent-orange)] transition-colors group-hover:text-white" />
              </div>
            </div>

            {/* Description */}
            <p className="text-muted-foreground text-sm leading-relaxed">
              {feature.description}
            </p>

            {/* Footer */}
            <div className="flex flex-1 items-end justify-between pt-2">
              {feature.videoDuration && (
                <span className="font-mono text-muted-foreground text-xs">
                  Video: {feature.videoDuration} mins
                </span>
              )}
              <div className="flex items-center gap-1 font-medium text-[var(--accent-orange)] text-xs transition-all group-hover:gap-2">
                Open details
                <ArrowRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </div>
      </DialogTrigger>
      <DialogPortal data-slot="dialog-portal">
        <DialogOverlay />
        <DialogContent
          data-slot="dialog-content"
          className={cn(
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=open]:animate-in',
            'fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]',
          )}
        >
          <div className="fade-in zoom-in-95 relative max-h-[90vh] w-full max-w-4xl animate-in overflow-hidden overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl duration-300">
            {/* Close button */}
            <DialogClose asChild>
              <button
                type="button"
                className="absolute top-4 right-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-border bg-background/80 backdrop-blur transition-colors hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </DialogClose>

            {/* Video at Top - Large */}
            <div className="bg-muted p-8 pb-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="inline-block rounded-md bg-[var(--accent-orange)]/10 px-2.5 py-0.5 font-semibold text-[var(--accent-orange)] text-xs">
                    {feature.tag}
                  </span>
                  <h2 className="font-bold text-2xl">{feature.title}</h2>
                </div>

                {/* Large Video placeholder */}
                {feature.videoUrl && (
                  <VideoFrame title={feature.title}>
                    <video
                      className="h-full w-full rounded-xl object-cover"
                      src={feature.videoUrl}
                      title={feature.title}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                    />
                  </VideoFrame>
                )}
                {feature.gifUrl && !feature.videoUrl && (
                  <div className="relative overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                    <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-muted to-background">
                      <div className="space-y-3 text-center">
                        <img
                          className="h-full w-full object-cover"
                          src={feature.gifUrl}
                          alt={feature.title}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Feature Highlights - Bento Layout */}
            <div className="space-y-6 p-8 pt-6">
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>

              {/* Bento Grid for Highlights */}
              <div className="grid grid-cols-2 gap-3">
                {feature.highlights.map((highlight, index) => (
                  <div
                    key={`${highlight.title} ${index.toString()}`}
                    className="group flex gap-3 rounded-lg border border-border/50 bg-muted/50 p-4 transition-all hover:border-[var(--accent-orange)]/30 hover:bg-muted"
                  >
                    {typeof highlight.description === 'string' &&
                      highlight.description?.length < 70 && (
                        <highlight.Icon className="h-5 w-5 text-[var(--accent-orange)] transition-colors group-hover:text-white" />
                      )}

                    <div>
                      <h4 className="mb-1 font-semibold text-sm transition-colors group-hover:text-[var(--accent-orange)]">
                        {highlight.title}
                      </h4>
                      <p className="text-muted-foreground text-xs leading-relaxed">
                        {highlight.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-border border-t pt-4">
                <p className="text-center text-muted-foreground text-xs">
                  💡 Tip: {feature.tip}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}
