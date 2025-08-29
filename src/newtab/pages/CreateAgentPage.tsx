import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Play, Save } from 'lucide-react'
import { useAgentsStore } from '@/newtab/stores/agentsStore'
import { useProviderStore } from '@/newtab/stores/providerStore'
import { type Agent } from '@/newtab/schemas/agent.schema'
import { type Template } from '@/newtab/schemas/template.schema'
import { AgentEditor, type AgentEditorHandle } from '@/newtab/components/agents/AgentEditor'
import { AgentEditorHeader } from '@/newtab/components/agents/AgentEditor/AgentEditorHeader'
import { AgentList } from '@/newtab/components/agents/AgentList'
import { TemplateGrid } from '@/newtab/components/agents/Templates/TemplateGrid'
import { AgentSidebar } from '@/newtab/components/agents/AgentSidebar'
import { PlanGenerator } from '@/newtab/components/PlanGenerator'

interface CreateAgentPageProps {
  onBack: () => void
}

const DEFAULT_TITLE = 'Untitled agent'

export function CreateAgentPage ({ onBack }: CreateAgentPageProps) {
  const { agents, addAgent, updateAgent, deleteAgent } = useAgentsStore()
  const { executeAgent } = useProviderStore()
  const editorRef = useRef<AgentEditorHandle | null>(null)

  // Editor state
  const [mode, setMode] = useState<'index' | 'editor'>('index')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null)
  const [headerNotification, setHeaderNotification] = useState<string>('')
  const [waitingForNewAgent, setWaitingForNewAgent] = useState<string | null>(null)
  const [planVersion, setPlanVersion] = useState<number>(0)
  const [isFromTemplate, setIsFromTemplate] = useState<boolean>(false)

  // Computed display title
  const displayTitle: string = currentAgent?.name || DEFAULT_TITLE

  // Watch for new agent creation
  useEffect(() => {
    if (waitingForNewAgent && agents.length > 0) {
      const newAgent = agents.find(a => a.name === waitingForNewAgent)
      if (newAgent) {
        setActiveAgentId(newAgent.id)
        setCurrentAgent(newAgent)
        setWaitingForNewAgent(null)
      }
    }
  }, [agents, waitingForNewAgent])

  // Load an existing agent into the editor
  const loadAgent = (agent: Agent): void => {
    setMode('editor')
    setActiveAgentId(agent.id)
    setCurrentAgent(agent)
    setCurrentTemplate(null)
    setIsFromTemplate(false)
    setHeaderNotification('')
  }

  // Create new blank editor
  const newAgent = (): void => {
    setActiveAgentId(null)
    setCurrentAgent(null)
    setCurrentTemplate(null)
    setWaitingForNewAgent(null)
    setIsFromTemplate(false)
    localStorage.removeItem('agent-draft')
    setMode('editor')
    setHeaderNotification('Save to enable Run')
    setPlanVersion(v => v + 1)
  }

  // Use template
  const useTemplate = (template: Template): void => {
    localStorage.removeItem('agent-draft')
    setActiveAgentId(null)
    setCurrentAgent(null)
    setCurrentTemplate(template)
    setIsFromTemplate(true)
    setHeaderNotification('Copy template to run')
    setMode('editor')
  }

  // Save to store (create or update)
  const handleSave = (data: any): void => {
    if (activeAgentId) {
      updateAgent(activeAgentId, {
        ...data,
        tools: []
      })
    } else {
      // Generate unique name if duplicate exists
      let finalName = data.name
      const existingNames = agents.map(a => a.name)
      if (existingNames.includes(finalName)) {
        let counter = 1
        while (existingNames.includes(`${data.name} #${counter}`)) {
          counter++
        }
        finalName = `${data.name} #${counter}`
      }
      
      setWaitingForNewAgent(finalName)
      addAgent({
        ...data,
        name: finalName,
        tools: [],
        isPinned: false,
        lastUsed: null
      })
    }
    
    setIsFromTemplate(false)
    setHeaderNotification('Saved')
    setTimeout(() => setHeaderNotification(''), 2500)
  }

  // Run agent
  const handleRun = async (): Promise<void> => {
    if (!activeAgentId) return
    const agent = agents.find(a => a.id === activeAgentId)
    if (!agent) return
    await executeAgent(agent, agent.goal, true)
  }

  // Delete agent
  const handleDelete = (id: string): void => {
    const confirmed = window.confirm('Delete this agent?')
    if (!confirmed) return
    deleteAgent(id)
    if (activeAgentId === id) newAgent()
  }

  return (
    <div className='h-screen flex flex-col bg-background'>
      {/* Top header */}
      <header className='sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur'>
        <div className='h-12 px-4 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-2'>
            <button 
              onClick={mode === 'editor' ? () => setMode('index') : onBack} 
              className='p-1.5 rounded hover:bg-accent' 
              aria-label='Go back'
            >
              <ChevronLeft className='w-5 h-5' />
            </button>
            <div className='flex items-center gap-1.5 text-sm'>
              <button onClick={() => setMode('index')} className='font-medium hover:underline'>
                Agents
              </button>
              {mode === 'editor' && (
                <>
                  <span className='text-muted-foreground'>›</span>
                  <span className='font-medium'>{activeAgentId ? displayTitle : 'New'}</span>
                </>
              )}
            </div>
          </div>
          {mode === 'editor' && (
            <AgentEditorHeader
              notification={headerNotification}
              canRun={!!activeAgentId}
              isFromTemplate={isFromTemplate}
              onRun={handleRun}
              onSave={() => {
                // Trigger save in AgentEditor by calling its internal save
                const saveButton = document.querySelector('[data-save-trigger]') as HTMLElement
                if (saveButton) saveButton.click()
              }}
            />
          )}
        </div>
      </header>

      {/* Index view */}
      {mode === 'index' && (
        <div className='flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-[1100px] px-10 py-10 space-y-10'>
            <AgentList
              agents={agents}
              onEdit={loadAgent}
              onDelete={handleDelete}
              onNew={newAgent}
            />
            <TemplateGrid onUseTemplate={useTemplate} />
          </div>
        </div>
      )}

      {/* Editor view */}
      {mode === 'editor' && (
        <div className='flex flex-1 min-h-0'>
          <AgentSidebar
            agents={agents}
            activeAgentId={activeAgentId}
            onSelectAgent={loadAgent}
            onDeleteAgent={handleDelete}
            onNewAgent={newAgent}
          />
          <main className='flex-1 min-w-0'>
            <div className='h-full flex'>
              <div className='flex-1 overflow-y-auto'>
              <AgentEditor
                ref={editorRef}
                agentId={activeAgentId}
                agent={currentAgent}
                template={currentTemplate}
                onSave={handleSave}
                onRun={handleRun}
                onPlanChange={() => setPlanVersion(v => v + 1)}
              />
              </div>
              <aside className='w-[420px] max-w-[50vw] border-l border-border bg-background'>
                <PlanGenerator
                  refreshKey={planVersion}
                  getCurrentPlan={() => ({
                    name: editorRef.current?.getName() || '',
                    goal: editorRef.current?.getGoal() || '',
                    steps: editorRef.current?.getSteps() || []
                  })}
                  onReplacePlan={(plan: { name?: string, goal: string, steps: string[] }) => {
                    if (plan.name) editorRef.current?.setName(plan.name)
                    editorRef.current?.applyPlan({ goal: plan.goal, steps: plan.steps }, { save: true })
                  }}
                  onAppendSteps={(steps: string[]) => {
                    editorRef.current?.appendSteps(steps, { save: true })
                  }}
                />
              </aside>
            </div>
          </main>
        </div>
      )}
      
      {/* Plan Assistant is pinned in the editor layout above */}
    </div>
  )
}
