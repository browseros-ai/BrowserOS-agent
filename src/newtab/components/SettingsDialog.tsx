import React, { useState, useEffect } from 'react'
import { X, Plus, Grip, ExternalLink, Github, BookOpen, MessageSquare } from 'lucide-react'
import { useProviderStore } from '../stores/providerStore'
import { getBrowserOSAdapter } from '@/lib/browser/BrowserOSAdapter'

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<'providers' | 'about'>('providers')
  const [browserOSVersion, setBrowserOSVersion] = useState<string | null>(null)
  const [agentVersion, setAgentVersion] = useState<string>('1.0.0')
  const [isAddingProvider, setIsAddingProvider] = useState(false)
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderUrl, setNewProviderUrl] = useState('')
  const [newProviderCategory, setNewProviderCategory] = useState<'search' | 'llm'>('search')
  const { getAllProviders, selectedProviderId, selectProvider, addCustomProvider, removeCustomProvider } = useProviderStore()
  
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
  
  const handleAddProvider = () => {
    if (newProviderName.trim() && newProviderUrl.trim()) {
      // Ensure URL has %s placeholder for query
      const urlPattern = newProviderUrl.includes('%s') 
        ? newProviderUrl 
        : newProviderUrl + (newProviderUrl.includes('?') ? '&q=%s' : '?q=%s')
      
      addCustomProvider({
        name: newProviderName.trim(),
        category: newProviderCategory,
        urlPattern
      })
      
      // Reset form
      setNewProviderName('')
      setNewProviderUrl('')
      setNewProviderCategory('search')
      setIsAddingProvider(false)
    }
  }
  
  const handleCancelAdd = () => {
    setNewProviderName('')
    setNewProviderUrl('')
    setNewProviderCategory('search')
    setIsAddingProvider(false)
  }
  
  const providers = getAllProviders()
  
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
              <div className="space-y-4">
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-foreground mb-2">Manage Search Providers</h3>
                  <p className="text-sm text-muted-foreground">
                    The first provider is your default.
                  </p>
                </div>
                
                {/* Provider List */}
                <div className="space-y-2">
                  {providers.map((provider, index) => (
                    <div
                      key={provider.id}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border
                        ${selectedProviderId === provider.id 
                          ? 'border-primary bg-accent/50' 
                          : 'border-border bg-card hover:bg-accent/30'
                        }
                        transition-all cursor-pointer
                      `}
                      onClick={() => selectProvider(provider.id)}
                    >
                      {/* Hidden drag handle for now */}
                      {/* <Grip size={16} className="text-muted-foreground cursor-move" /> */}
                      
                      <div className="flex-1">
                        <div className="font-medium text-sm text-foreground">
                          {provider.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {provider.category === 'llm' ? 'AI Assistant' : 'Search Engine'}
                        </div>
                      </div>
                      
                      {index === 0 && (
                        <span className="text-xs font-medium text-primary px-2 py-1 bg-primary/10 rounded">
                          Default
                        </span>
                      )}
                      
                      {provider.isCustom && (
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeCustomProvider(provider.id)
                          }}
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Add Provider Form or Button */}
                {isAddingProvider ? (
                  <div className="mt-4 p-4 rounded-lg border border-border bg-card space-y-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">Name</label>
                      <input
                        type="text"
                        value={newProviderName}
                        onChange={(e) => setNewProviderName(e.target.value)}
                        placeholder="e.g., DuckDuckGo"
                        className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                      />
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-foreground">
                        URL with %s in place of query
                      </label>
                      <input
                        type="text"
                        value={newProviderUrl}
                        onChange={(e) => setNewProviderUrl(e.target.value)}
                        placeholder="e.g., https://duckduckgo.com/?q=%s"
                        className="w-full mt-1 px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Use %s where the search query should go
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-xs font-medium text-foreground">Category</label>
                      <div className="flex gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setNewProviderCategory('search')}
                          className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                            newProviderCategory === 'search'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Search Engine
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewProviderCategory('llm')}
                          className={`flex-1 px-3 py-2 text-sm rounded-md border transition-colors ${
                            newProviderCategory === 'llm'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          AI Assistant
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleCancelAdd}
                        className="flex-1 px-3 py-2 text-sm rounded-md border border-border hover:bg-accent transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddProvider}
                        disabled={!newProviderName.trim() || !newProviderUrl.trim()}
                        className="flex-1 px-3 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsAddingProvider(true)}
                    className="
                      w-full mt-4 p-3 rounded-lg border border-dashed border-border
                      hover:border-primary hover:bg-accent/20 transition-all
                      flex items-center justify-center gap-2 text-sm text-muted-foreground
                      hover:text-foreground
                    "
                  >
                    <Plus size={16} />
                    Add Custom Provider
                  </button>
                )}
              </div>
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
