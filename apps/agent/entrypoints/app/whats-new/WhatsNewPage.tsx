import {
  ArrowUpRight,
  BookText,
  Bot,
  Clock3,
  ExternalLink,
  Package,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getBrowserOSAdapter } from '@/lib/browseros/adapter'
import {
  WHATS_NEW_LINK_CLICKED_EVENT,
  WHATS_NEW_VIEWED_EVENT,
} from '@/lib/constants/analyticsEvents'
import { changelogUrl } from '@/lib/constants/productUrls'
import { track } from '@/lib/metrics/track'
import { cn } from '@/lib/utils'
import type {
  ReleaseFeature,
  ReleaseNote,
} from '@/lib/whats-new/whats-new-config'
import {
  getConfiguredReleaseForExtensionVersion,
  getLatestReleaseNote,
  getReleaseHistory,
  getReleaseNoteByBrowserosVersion,
  getReleaseNumber,
} from '@/lib/whats-new/whats-new-config'

const FEATURE_ICONS = [Bot, Wrench, ShieldCheck, Package]

function getFallbackRelease(extensionVersion: string): ReleaseNote {
  return (
    getConfiguredReleaseForExtensionVersion(extensionVersion)?.release ??
    getLatestReleaseNote()
  )
}

function getReleaseFeatures(release: ReleaseNote): ReleaseFeature[] {
  if (release.features?.length) {
    return release.features
  }

  return release.highlights.map((highlight, index) => ({
    id: `${release.id}-${index}`,
    title: `Update ${index + 1}`,
    description: highlight,
  }))
}

function ReleaseFeatureCard({
  feature,
  index,
  onLinkClick,
  release,
}: {
  feature: ReleaseFeature
  index: number
  onLinkClick: (linkType: string, release: ReleaseNote) => void
  release: ReleaseNote
}) {
  const FeatureIcon = FEATURE_ICONS[index % FEATURE_ICONS.length]

  return (
    <Card
      className={cn(
        'gap-4 rounded-[1.6rem] border border-border/70 bg-card/95 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        index === 0 && 'md:col-span-2 xl:col-span-2',
      )}
    >
      <CardHeader className="gap-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/12 text-[var(--accent-orange)] shadow-[0_16px_30px_-22px_rgba(245,121,36,0.7)]">
            <FeatureIcon className="size-5" />
          </div>
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
              Featured update
            </div>
            <CardTitle className="text-xl">{feature.title}</CardTitle>
          </div>
        </div>
        <CardDescription className="max-w-2xl text-sm leading-6">
          {feature.description}
        </CardDescription>
      </CardHeader>
      {feature.linkUrl && (
        <CardContent className="pt-0">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <a
              href={feature.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                onLinkClick(feature.linkType ?? 'feature-link', release)
              }
            >
              {feature.linkLabel ?? 'Read more'}
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

function ReleaseHistoryCard({
  onDocsClick,
  release,
}: {
  onDocsClick: (release: ReleaseNote) => void
  release: ReleaseNote
}) {
  return (
    <Card className="gap-4 rounded-[1.5rem] border border-border/70 bg-card/95 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">
            Release {getReleaseNumber(release.browserosVersion)}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {release.releaseDate}
          </span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              BrowserOS v{release.browserosVersion}
            </CardTitle>
            <CardDescription className="max-w-3xl leading-6">
              {release.summary}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <a
              href={release.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onDocsClick(release)}
            >
              Read in docs
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="grid gap-2 md:grid-cols-2">
          {release.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/55 px-3 py-3 text-sm leading-6"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent-orange)]" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

export const WhatsNewPage = () => {
  const location = useLocation()
  const extensionVersion = chrome.runtime.getManifest().version
  const [installedBrowserosVersion, setInstalledBrowserosVersion] = useState<
    string | null
  >(null)
  const params = new URLSearchParams(location.search)
  const source = params.get('source') ?? 'direct'
  const requestedRelease = getReleaseNoteByBrowserosVersion(
    params.get('release'),
  )
  const installedRelease = getReleaseNoteByBrowserosVersion(
    installedBrowserosVersion,
  )
  const activeRelease =
    requestedRelease ?? installedRelease ?? getFallbackRelease(extensionVersion)
  const featureSpotlights = getReleaseFeatures(activeRelease)
  const previousReleases = getReleaseHistory(activeRelease.id).filter(
    (release) => release.id !== activeRelease.id,
  )
  const installedVersionMatchesActive =
    installedBrowserosVersion === activeRelease.browserosVersion

  useEffect(() => {
    let cancelled = false
    const adapter = getBrowserOSAdapter()

    adapter
      .getBrowserosVersion()
      .then((version) => {
        if (!cancelled) {
          setInstalledBrowserosVersion(version)
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!requestedRelease && installedBrowserosVersion === null) {
      return
    }

    track(WHATS_NEW_VIEWED_EVENT, {
      release_version: activeRelease.browserosVersion,
      source,
    })
  }, [
    activeRelease.browserosVersion,
    installedBrowserosVersion,
    requestedRelease,
    source,
  ])

  const handleLinkClick = (linkType: string, release: ReleaseNote) => {
    track(WHATS_NEW_LINK_CLICKED_EVENT, {
      link_type: linkType,
      release_version: release.browserosVersion,
      source,
    })
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 mx-auto max-w-6xl animate-in space-y-8 duration-500">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-[2rem] border border-[var(--accent-orange)]/18 bg-gradient-to-br from-[var(--accent-orange)]/12 via-background to-background py-0 shadow-[0_28px_90px_-54px_rgba(245,121,36,0.7)]">
          <CardContent className="space-y-5 p-6 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full px-3 py-1 text-xs">
                <Sparkles className="mr-1 size-3.5" />
                What's New
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Release {getReleaseNumber(activeRelease.browserosVersion)}
              </Badge>
              <span className="text-muted-foreground text-xs">
                {activeRelease.releaseDate}
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="max-w-4xl font-semibold text-3xl tracking-tight sm:text-4xl">
                BrowserOS v{activeRelease.browserosVersion}
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground leading-7">
                {activeRelease.summary}
              </p>
            </div>

            {installedBrowserosVersion && !installedVersionMatchesActive && (
              <div className="flex items-start gap-3 rounded-[1.4rem] border border-[var(--accent-orange)]/16 bg-background/78 px-4 py-3 text-sm leading-6 shadow-sm">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-[var(--accent-orange)]" />
                <p className="text-muted-foreground">
                  BrowserOS currently reports{' '}
                  <span className="font-semibold text-foreground">
                    v{installedBrowserosVersion}
                  </span>
                  . You are viewing the notes for{' '}
                  <span className="font-semibold text-foreground">
                    v{activeRelease.browserosVersion}
                  </span>
                  .
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button asChild className="rounded-xl">
                <a
                  href={activeRelease.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('docs', activeRelease)}
                >
                  <BookText className="size-4" />
                  Read docs
                </a>
              </Button>

              {activeRelease.talksUrl && (
                <Button asChild variant="outline" className="rounded-xl">
                  <a
                    href={activeRelease.talksUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => handleLinkClick('talks', activeRelease)}
                  >
                    <PlayCircle className="size-4" />
                    {activeRelease.talksLabel ?? 'Watch talk'}
                  </a>
                </Button>
              )}

              <Button asChild variant="ghost" className="rounded-xl">
                <a
                  href={changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleLinkClick('full-history', activeRelease)}
                >
                  <ArrowUpRight className="size-4" />
                  Full changelog
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-4 rounded-[1.8rem] border border-border/70 bg-card/95 py-6 shadow-sm">
          <CardHeader className="gap-2">
            <CardTitle className="text-lg">Release snapshot</CardTitle>
            <CardDescription>
              Quick context while you browse the update.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.4rem] border border-border/70 bg-background/70 p-4">
              <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                Viewing release
              </div>
              <div className="mt-2 font-semibold text-3xl">
                v{activeRelease.browserosVersion}
              </div>
              <p className="mt-1 text-muted-foreground text-sm">
                {activeRelease.releaseDate}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[1.3rem] border border-border/70 bg-muted/25 p-4">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  Installed BrowserOS
                </div>
                <div className="mt-2 font-semibold text-xl">
                  {installedBrowserosVersion
                    ? `v${installedBrowserosVersion}`
                    : 'Checking...'}
                </div>
              </div>
              <div className="rounded-[1.3rem] border border-border/70 bg-muted/25 p-4">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  Extension package
                </div>
                <div className="mt-2 font-semibold text-xl">
                  v{extensionVersion}
                </div>
              </div>
            </div>

            <p className="text-muted-foreground text-sm leading-6">
              {installedBrowserosVersion === null
                ? 'Checking the installed BrowserOS release so this page can confirm whether you are viewing the latest notes.'
                : installedVersionMatchesActive
                  ? 'These notes match the release currently installed in BrowserOS.'
                  : 'The installed BrowserOS release is different from the notes you are viewing, which is useful when you revisit earlier release changes from the new tab entry point.'}
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold text-2xl tracking-tight">
            Featured in this release
          </h2>
          <p className="max-w-3xl text-muted-foreground text-sm leading-6">
            The update is broken into product-level highlights so each major
            change has its own surface instead of being buried inside one large
            release card.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {featureSpotlights.map((feature, index) => (
            <ReleaseFeatureCard
              key={feature.id}
              feature={feature}
              index={index}
              onLinkClick={handleLinkClick}
              release={activeRelease}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl tracking-tight">
              Release history
            </h2>
            <p className="text-muted-foreground text-sm leading-6">
              A compact in-product archive with links back to the full BrowserOS
              docs whenever you want deeper release detail.
            </p>
          </div>
          <Button asChild variant="outline" className="rounded-xl">
            <a
              href={changelogUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleLinkClick('history-index', activeRelease)}
            >
              Browse docs changelog
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        <div className="space-y-4">
          {previousReleases.map((release) => (
            <ReleaseHistoryCard
              key={release.id}
              release={release}
              onDocsClick={(selectedRelease) =>
                handleLinkClick('history-docs', selectedRelease)
              }
            />
          ))}
        </div>
      </section>
    </div>
  )
}
