import React, { useEffect, useState } from 'react'
import { ExternalLink, Github, BookOpen, MessageSquare } from 'lucide-react'
import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'

export function AboutSection() {
  const [browserOSVersion, setBrowserOSVersion] = useState<string | null>(null)
  const [agentVersion, setAgentVersion] = useState<string>('1.0.0')

  useEffect(() => {
    // Get BrowserOS version from API if available
    if (chrome.browserOS && 'getVersionNumber' in chrome.browserOS && typeof chrome.browserOS.getVersionNumber === 'function') {
      getBrowserOSAdapter().getVersion()
        .then(v => setBrowserOSVersion(v))
        .catch(() => setBrowserOSVersion(null))
    }

    // Get Agent version from manifest
    const manifest = chrome.runtime.getManifest()
    setAgentVersion(manifest.version || '1.0.0')
  }, [])

  const links = [
    {
      title: 'GitHub Repository',
      description: 'View source code and contribute',
      url: 'https://github.com/browseros-ai/BrowserOS/',
      icon: <Github size={20} />
    },
    {
      title: 'Documentation',
      description: 'Installation guides and tips',
      url: 'https://docs.browseros.com/',
      icon: <BookOpen size={20} />
    },
    {
      title: 'Discord Community',
      description: 'Join our Discord server for support',
      url: 'https://discord.gg/browseros',
      icon: <MessageSquare size={20} />
    }
  ]

  return (
    <section className="bg-card rounded-lg px-6 py-5 border border-border shadow-sm">
      {/* Header with Logo */}
      <div className="flex items-start gap-4 mb-6">
        {/* BrowserOS Logo */}
        <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0 shadow-md overflow-hidden">
          <img
            src="/assets/browseros.svg"
            alt="BrowserOS"
            className="w-10 h-10 object-contain"
          />
        </div>

        {/* Header Text */}
        <div className="flex-1">
          <h2 className="text-foreground text-[18px] font-medium leading-tight mb-1">
            About BrowserOS
          </h2>
          <p className="text-muted-foreground text-[14px] leading-normal">
            An AI-powered browser automation tool that helps you navigate and interact with the web using natural language.
          </p>
        </div>
      </div>

      {/* Links Section */}
      <div className="space-y-3 mb-6">
        {links.map((link) => (
          <button
            key={link.title}
            onClick={() => window.open(link.url, '_blank')}
            className="
              w-full flex items-center gap-4 p-4 rounded-lg
              border border-border bg-background hover:bg-accent/30
              transition-all text-left group
            "
          >
            <div className="text-muted-foreground group-hover:text-foreground transition-colors">
              {link.icon}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm text-foreground">
                {link.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {link.description}
              </div>
            </div>
            <ExternalLink size={14} className="text-muted-foreground" />
          </button>
        ))}
      </div>

      {/* Version Info */}
      <div className="pt-6 border-t border-border">
        <div className="text-xs text-muted-foreground text-center space-y-1">
          {browserOSVersion && (
            <p>BrowserOS Version {browserOSVersion}</p>
          )}
          <p>Agent Version {agentVersion}</p>
        </div>
      </div>
    </section>
  )
}
