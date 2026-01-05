import { ArrowLeft, Check, ChevronDown, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink } from 'react-router'
import { NewTabBranding } from '../index/NewTabBranding'
import { templates } from './templates'

export const Personalize = () => {
  const [mounted, setMounted] = useState(false)
  const [personalInfo, setPersonalInfo] = useState('')
  const [expandedSection, setExpandedSection] = useState<string | null>(null)
  const [copiedSection, setCopiedSection] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('browserOS_personalization')
    if (saved) {
      setPersonalInfo(saved)
    }
  }, [])

  useEffect(() => {
    if (personalInfo) {
      localStorage.setItem('browserOS_personalization', personalInfo)
    }
  }, [personalInfo])

  const copyTemplate = (templateKey: keyof typeof templates) => {
    const template = templates[templateKey].template
    navigator.clipboard.writeText(template)
    setCopiedSection(templateKey)
    setTimeout(() => setCopiedSection(null), 2000)
  }

  const sections = [
    {
      key: 'aboutYou' as const,
      title: 'Add more info about you',
      description: 'Help BrowserOS understand who you are',
    },
    {
      key: 'expectations' as const,
      title: 'What you expect from the browser',
      description: 'Share your preferences and needs',
    },
    {
      key: 'commonActions' as const,
      title: 'Your commonly performed actions',
      description: 'Describe your daily workflows',
    },
  ]

  return (
    <>
      <div className="absolute top-6 left-6 z-10">
        <NavLink
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border/50 bg-card px-4 py-2 font-medium text-foreground text-sm shadow-sm transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </NavLink>
      </div>

      {/* Main content */}
      <div className="relative flex min-h-screen items-center justify-center px-4 py-16">
        <div
          className={`w-full max-w-3xl space-y-8 transition-all duration-700 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
        >
          {/* Logo and title */}
          <NewTabBranding />

          {/* Main text area */}
          <div className="space-y-3">
            <label
              htmlFor="personalization"
              className="block font-medium text-foreground text-sm"
            >
              Your Information
            </label>
            <textarea
              id="personalization"
              value={personalInfo}
              onChange={(e) => setPersonalInfo(e.target.value)}
              placeholder="Tell BrowserOS about yourself... (Supports Markdown)"
              className="styled-scrollbar h-96 w-full resize-none rounded-2xl border-2 border-border/50 bg-card px-4 py-3 text-foreground transition-all placeholder:text-muted-foreground focus:border-[var(--accent-orange)]/30 focus:outline-none focus:ring-4 focus:ring-[var(--accent-orange)]/10"
            />
            <p className="text-muted-foreground text-xs">
              Your information is saved locally and never leaves your device.
              Markdown formatting is supported.
            </p>
          </div>

          {/* Template hints */}
          <div className="space-y-3">
            <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
              Need help getting started?
            </h2>
            <div className="space-y-2">
              {sections.map((section) => (
                <div
                  key={section.key}
                  className="overflow-hidden rounded-xl border border-border/50 bg-card transition-colors hover:border-border"
                >
                  <button
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === section.key ? null : section.key,
                      )
                    }
                    className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-1">
                      <h3 className="mb-1 font-medium text-foreground text-sm">
                        {section.title}
                      </h3>
                      <p className="text-muted-foreground text-xs">
                        {section.description}
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSection === section.key ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {expandedSection === section.key && (
                    <div className="animate-fadeInUp space-y-3 px-4 pb-4">
                      <div>
                        <p className="mb-2 font-medium text-muted-foreground text-xs">
                          Template (click to copy):
                        </p>
                        <div className="relative">
                          <pre className="styled-scrollbar overflow-x-auto rounded-lg border border-border bg-accent/50 p-4 text-foreground text-xs">
                            {templates[section.key].template}
                          </pre>
                          <button
                            onClick={() => copyTemplate(section.key)}
                            className="absolute top-3 right-3 rounded-lg border border-border bg-background p-2 transition-colors hover:bg-accent"
                            title="Copy template"
                          >
                            {copiedSection === section.key ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 font-medium text-muted-foreground text-xs">
                          Example:
                        </p>
                        <pre className="styled-scrollbar overflow-x-auto rounded-lg border border-border/30 bg-muted/30 p-4 text-muted-foreground text-xs">
                          {templates[section.key].example}
                        </pre>
                      </div>

                      <p className="text-muted-foreground text-xs">
                        Click the copy button to add this template to your
                        clipboard, then paste it into the text area above and
                        customize it.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
