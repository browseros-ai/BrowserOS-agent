import React, { useState, useEffect } from 'react'
import { z } from 'zod'
import { Monitor, X, Pause, RefreshCw, HelpCircle, ExternalLink } from 'lucide-react'

// Props schema
const HelpSectionPropsSchema = z.object({
  isOpen: z.boolean(), // Whether the help section is open
  onClose: z.function().args().returns(z.void()), // Close handler
  className: z.string().optional() // Additional CSS classes
})

type HelpSectionProps = z.infer<typeof HelpSectionPropsSchema>

// Agent examples
const AGENT_EXAMPLES = {
  browse: {
    title: 'Web Navigation & Automation',
    description:
      'I can navigate websites, fill forms, click buttons, and automate complex web tasks',
    examples: [
      'Open amazon.com and search for wireless headphones under $100',
      'Accept all LinkedIn connection requests on this page',
      'Add this item to my shopping cart and complete the purchase'
    ]
  },
  answer: {
    title: 'Data Extraction & Analysis',
    description:
      "I can read, analyze, and extract information from any webpage you're viewing",
    examples: [
      'Summarize this research paper in bullet points',
      'Extract all email addresses from this page',
      'What are the key features mentioned in this product description?'
    ]
  },
  productivity: {
    title: 'Tab & Browser Management',
    description:
      'I can organize your tabs, manage bookmarks, and help you work more efficiently',
    examples: [
      'List all tabs in this window',
      'Close all YouTube tabs',
      'Organize my tabs by topic',
      "Save current tabs as 'Work' session",
      "Resume my 'Work' session from yesterday"
    ]
  }
}

/**
 * Help section component displaying comprehensive usage instructions
 */
export function HelpSection ({
  isOpen,
  onClose,
  className
}: HelpSectionProps): JSX.Element | null {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    // Get version from manifest
    const manifest = chrome.runtime.getManifest()
    setVersion(manifest.version || '')
  }, [])

  // Lock background scroll while modal is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (!isOpen) return null

     return (
     <div 
       className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-4"
       onClick={onClose}
     >
       <div
         className={`bg-background/95 backdrop-blur-sm border border-border/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto ${className || ''}`}
         onClick={e => e.stopPropagation()}
       >
        {/* Header */}
         <div className="flex items-center justify-between p-5 border-b border-border/30">
           <div className="flex items-center gap-1">
             <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand/20 to-brand/10 flex items-center justify-center">
               <Monitor className="w-4 h-4" />
             </div>
             <div className="flex items-center gap-2">
               <h2 className="text-lg font-semibold text-foreground">BrowserOS Agent</h2>
               {version && <span className="text-xs text-muted-foreground/70">v{version}</span>}
             </div>
           </div>
           <button
             onClick={onClose}
             className="p-2 hover:bg-muted/50 rounded-xl transition-all duration-200"
             title="Close help"
           >
             <X className="w-4 h-4" />
           </button>
         </div>

         {/* Content */}
         <div className="p-5 space-y-4">
           {/* Introduction */}
           <div className="text-center">
             <p className="text-sm text-muted-foreground/80 leading-relaxed">
               I'm your intelligent browser automation assistant. I can navigate
               websites, extract information, and manage your browsing
               productivity—all through natural conversation.
             </p>
           </div>

            {/* Quick Controls */}
           <div className="space-y-3">
             <h3 className="text-base font-semibold text-foreground">Quick Controls</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                 <div className="flex items-center gap-2 p-3 bg-muted/60 dark:bg-muted/30 rounded-xl border border-border/60 dark:border-border/30 shadow-sm">
                   <div className="w-7 h-7 bg-gradient-to-br from-brand/20 to-brand/10 rounded-xl flex items-center justify-center">
                     <Pause className="w-3 h-3" fill="currentColor" />
                   </div>
                   <div>
                     <div className="font-medium text-sm text-foreground">Pause</div>
                     <div className="text-xs text-muted-foreground/70">Stop execution at any time</div>
                   </div>
                 </div>

                 <div className="flex items-center gap-2 p-3 bg-muted/60 dark:bg-muted/30 rounded-xl border border-border/60 dark:border-border/30 shadow-sm">
                   <div className="w-7 h-7 bg-gradient-to-br from-brand/20 to-brand/10 rounded-xl flex items-center justify-center">
                     <RefreshCw className="w-3 h-3" />
                   </div>
                   <div>
                     <div className="font-medium text-sm text-foreground">Reset</div>
                     <div className="text-xs text-muted-foreground/70">Start a fresh conversation</div>
                   </div>
                 </div>
               </div>

              <div className="p-4 bg-gradient-to-r from-brand/5 to-brand/10 border border-brand/20 rounded-xl">
               <div className="flex items-start gap-2">
                 <div className="w-5 h-5 bg-brand/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                   <HelpCircle className="w-3 h-3" />
                 </div>
                 <div>
                   <div className="font-medium text-sm text-foreground">Pro tip</div>
                   <div className="text-xs text-muted-foreground/80 leading-relaxed">
                     You can interrupt me anytime by typing a new instruction. I'll pause what I'm doing and switch to your new task immediately.
                   </div>
                 </div>
               </div>
             </div>
           </div>

            {/* Agent Capabilities */}
           <div className="space-y-3">
             <h3 className="text-base font-semibold text-foreground">What I Can Do</h3>

              {Object.entries(AGENT_EXAMPLES).map(([key, agent]) => (
               <div key={key} className="space-y-1">
                 <div className="flex items-center gap-1">
                   <div className="w-1.5 h-1.5 bg-brand rounded-full"></div>
                   <h4 className="text-sm font-semibold text-foreground">{agent.title}</h4>
                 </div>
                 <p className="text-xs text-muted-foreground/80 ml-3.5">{agent.description}</p>
                                   <div className="grid grid-cols-1 gap-1 ml-3.5 mt-1">
                    {agent.examples.map((example, index) => (
                      <div 
                        key={index} 
                        className="p-3 bg-brand/10 border border-brand/20 rounded-xl cursor-pointer hover:bg-brand/20 hover:border-brand/30 transition-all duration-200"
                        onClick={() => {
                          // Dispatch custom event to set input value
                          window.dispatchEvent(new CustomEvent('setInputValue', {
                            detail: example
                          }))
                          // Close the help section
                          onClose()
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            window.dispatchEvent(new CustomEvent('setInputValue', {
                              detail: example
                            }))
                            onClose()
                          }
                        }}
                        aria-label={`Use prompt: ${example}`}
                      >
                        <span className="text-xs text-foreground">"{example}"</span>
                      </div>
                    ))}
                  </div>
               </div>
             ))}
           </div>

           {/* Learn More */}
           <div className="pt-4 border-t border-border/30">
             <a
               href="https://bit.ly/BrowserOS-setup"
               target="_blank"
               rel="noopener noreferrer"
               className="inline-flex items-center gap-2.5 text-brand hover:text-brand/80 transition-all duration-200 group"
             >
               <div className="w-6 h-6 bg-brand/10 rounded-lg flex items-center justify-center group-hover:bg-brand/20 transition-colors">
                 <ExternalLink className="w-3 h-3" />
               </div>
               <span className="text-xs font-medium">View detailed usage guide</span>
             </a>
           </div>
        </div>
      </div>
    </div>
  )
}
