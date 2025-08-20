import React, { useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { type Template } from '@/newtab/schemas/template.schema'
import { TemplateCard } from './TemplateCard'
import { TemplatePreviewModal } from './TemplatePreviewModal'
import TEMPLATES from '@/newtab/data/templates'

interface TemplateGridProps {
  onUseTemplate: (template: Template) => void
}

export function TemplateGrid ({ onUseTemplate }: TemplateGridProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('agentTemplates.collapsed') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('agentTemplates.collapsed', String(collapsed))
  }, [collapsed])

  const handleUseTemplate = (template: Template): void => {
    setSelectedTemplate(null)
    onUseTemplate(template)
  }

  const toggleCollapsed = (): void => {
    setCollapsed(!collapsed)
  }

  return (
    <>
      <section>
        <div className='flex items-center mb-4 cursor-pointer select-none group' onClick={toggleCollapsed}>
          <ChevronRight 
            className={`w-5 h-5 mr-1 text-muted-foreground group-hover:text-foreground transition-all duration-200 ${!collapsed ? 'rotate-90' : ''}`}
          />
          <h2 className='text-[18px] font-semibold tracking-tight'>Agent templates</h2>
        </div>
        {!collapsed && (
          <div className='grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'>
            {TEMPLATES.map(template => (
              <TemplateCard
                key={template.id}
                template={template}
                onPreview={setSelectedTemplate}
                onUse={onUseTemplate}
              />
            ))}
          </div>
        )}
      </section>

      {/* Template Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onUse={handleUseTemplate}
        />
      )}
    </>
  )
}