import React, { useState, useEffect } from 'react'
import { X, ExternalLink, Github, BookOpen, MessageSquare } from 'lucide-react'
import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'
import { ProviderSettings } from './ProviderSettings'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'about'>('providers')
  const [browserOSVersion, setBrowserOSVersion] = useState<string | null>(null)
  const [agentVersion, setAgentVersion] = useState<string>('1.0.0')
  
  useEffect(() => {
    if (isOpen) {
      // Get BrowserOS version from API if available
      if ('getVersionNumber' in chrome.browserOS && typeof chrome.browserOS.getVersionNumber === 'function') {
        getBrowserOSAdapter().getVersion()
          .then(v => setBrowserOSVersion(v))
          .catch(() => setBrowserOSVersion(null))
      }
      
      // Get Agent version from manifest
      const manifest = chrome.runtime.getManifest()
      setAgentVersion(manifest.version || '1.0.0')
    }
  }, [isOpen])
  
  if (!isOpen) return null
  
  const tabs = [
    { id: 'providers' as const, label: 'Search Providers' },
    { id: 'about' as const, label: 'About' }
  ]
  
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
      url: 'https://browseros.notion.site/',
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
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <h2 className="text-xl font-semibold text-foreground">Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground"
              aria-label="Close settings"
            >
              <X size={20} />
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex border-b border-border">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 text-sm font-medium transition-colors
                  ${activeTab === tab.id 
                    ? 'text-foreground border-b-2 border-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'providers' && (
              <ProviderSettings />
            )}
            
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <img 
                      src="/assets/browseros.svg" 
                      alt="BrowserOS" 
                      className="w-10 h-10"
                    />
                    <h3 className="text-lg font-medium text-foreground">BrowserOS</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    An AI-powered browser automation tool that helps you navigate and interact with the web using natural language.
                  </p>
                </div>
                
                <div className="space-y-3">
                  {links.map((link) => (
                    <button
                      key={link.title}
                      onClick={() => window.open(link.url, '_blank')}
                      className="
                        w-full flex items-center gap-4 p-4 rounded-lg
                        border border-border bg-card hover:bg-accent/30
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
                
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="text-xs text-muted-foreground text-center space-y-1">
                    {browserOSVersion && (
                      <p>BrowserOS Version {browserOSVersion}</p>
                    )}
                    <p>Agent Version {agentVersion}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
