import {
  ArrowUpRight,
  BookText,
  Clock3,
  ExternalLink,
  PlayCircle,
  Sparkles,
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
import type { ReleaseNote } from '@/lib/whats-new/whats-new-config'
import {
  getConfiguredReleaseForExtensionVersion,
  getLatestReleaseNote,
  getReleaseHistory,
  getReleaseNoteByBrowserosVersion,
  getReleaseNumber,
} from '@/lib/whats-new/whats-new-config'

function getFallbackRelease(extensionVersion: string): ReleaseNote {
  return (
    getConfiguredReleaseForExtensionVersion(extensionVersion)?.release ??
    getLatestReleaseNote()
  )
}

function ReleaseHistoryCard({
  isCurrent,
  onDocsClick,
  release,
}: {
  isCurrent?: boolean
  onDocsClick: (release: ReleaseNote) => void
  release: ReleaseNote
}) {
  return (
    <Card
      className={cn(
        'gap-4 border-border/70 bg-card/95 py-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        isCurrent &&
          'border-[var(--accent-orange)]/25 bg-[var(--accent-orange)]/6',
      )}
    >
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isCurrent ? 'default' : 'secondary'}>
            {isCurrent
              ? 'Current release'
              : `Release ${getReleaseNumber(release.browserosVersion)}`}
          </Badge>
          <span className="text-muted-foreground text-xs">
            {release.releaseDate}
          </span>
        </div>
        <div className="space-y-1">
          <CardTitle className="text-lg">
            BrowserOS v{release.browserosVersion}
          </CardTitle>
          <CardDescription className="leading-6">
            {release.summary}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {release.highlights.map((highlight) => (
            <li
              key={highlight}
              className="flex items-start gap-3 text-sm leading-6"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--accent-orange)]" />
              <span>{highlight}</span>
            </li>
          ))}
        </ul>
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
  const previousReleases = getReleaseHistory(activeRelease.id).filter(
    (release) => release.id !== activeRelease.id,
  )

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
    track(WHATS_NEW_VIEWED_EVENT, {
      release_version: activeRelease.browserosVersion,
      source,
    })
  }, [activeRelease.browserosVersion, source])

  const handleLinkClick = (linkType: string, release: ReleaseNote) => {
    track(WHATS_NEW_LINK_CLICKED_EVENT, {
      link_type: linkType,
      release_version: release.browserosVersion,
      source,
    })
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <section className="relative overflow-hidden rounded-[2rem] border border-[var(--accent-orange)]/20 bg-gradient-to-br from-[var(--accent-orange)]/14 via-background to-background p-6 shadow-[0_32px_90px_-50px_rgba(245,121,36,0.7)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,121,36,0.18),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(245,121,36,0.08),transparent_30%)]" />
        <div className="relative grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
          <div className="space-y-5">
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
              <h1 className="max-w-3xl font-semibold text-3xl tracking-tight sm:text-4xl">
                BrowserOS v{activeRelease.browserosVersion}
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground leading-7">
                {activeRelease.summary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {activeRelease.highlights.map((highlight) => (
                <div
                  key={highlight}
                  className="rounded-2xl border border-white/40 bg-background/75 p-4 shadow-sm backdrop-blur"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--accent-orange)]" />
                    <p className="text-sm leading-6">{highlight}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Card className="gap-5 rounded-[1.5rem] border-white/50 bg-background/82 py-6 shadow-lg backdrop-blur">
            <CardHeader className="gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-orange)]/12">
                  <Clock3 className="size-5 text-[var(--accent-orange)]" />
                </div>
                <div>
                  <CardTitle>Installed now</CardTitle>
                  <CardDescription>
                    Your update package is v{extensionVersion}.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
                <div className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
                  Current BrowserOS release
                </div>
                <div className="mt-2 font-semibold text-2xl">
                  {installedBrowserosVersion
                    ? `v${installedBrowserosVersion}`
                    : `v${activeRelease.browserosVersion}`}
                </div>
                <p className="mt-1 text-muted-foreground text-sm leading-6">
                  This page keeps the current release pinned at the top and
                  links the full history back to the BrowserOS docs.
                </p>
              </div>

              <div className="grid gap-3">
                <Button asChild className="w-full rounded-xl">
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
                  <Button
                    asChild
                    variant="outline"
                    className="w-full rounded-xl"
                  >
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

                <Button asChild variant="ghost" className="w-full rounded-xl">
                  <a
                    href={changelogUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      handleLinkClick('full-history', activeRelease)
                    }
                  >
                    <ArrowUpRight className="size-4" />
                    Full changelog
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold text-2xl tracking-tight">
              Previous releases
            </h2>
            <p className="text-muted-foreground text-sm leading-6">
              A text-only history inside BrowserOS, with links back to the docs
              whenever you want the fuller release notes.
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
