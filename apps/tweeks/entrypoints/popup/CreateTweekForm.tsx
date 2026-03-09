import { useState } from 'react'

interface CreateTweekFormProps {
  domain: string
  url: string
  onSubmit: (input: {
    name: string
    description: string
    script: string
    script_type: 'js' | 'css'
  }) => void
}

export function CreateTweekForm({ domain, onSubmit }: CreateTweekFormProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [script, setScript] = useState('')
  const [scriptType, setScriptType] = useState<'js' | 'css'>('js')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !script.trim()) return
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        script: script.trim(),
        script_type: scriptType,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 p-4">
      <div className="rounded-md bg-accent px-3 py-2 text-accent-foreground text-xs">
        Creating tweek for <strong>{domain}</strong>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tweek-name" className="font-medium text-xs">
          Name
        </label>
        <input
          id="tweek-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Hide Sidebar"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tweek-description" className="font-medium text-xs">
          Description
        </label>
        <input
          id="tweek-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this tweek do?"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label htmlFor="tweek-script" className="font-medium text-xs">
            Script
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setScriptType('js')}
              className={`rounded px-2 py-0.5 font-medium text-[10px] transition-colors ${
                scriptType === 'js'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              JS
            </button>
            <button
              type="button"
              onClick={() => setScriptType('css')}
              className={`rounded px-2 py-0.5 font-medium text-[10px] transition-colors ${
                scriptType === 'css'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              CSS
            </button>
          </div>
        </div>
        <textarea
          id="tweek-script"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder={
            scriptType === 'css'
              ? '.sidebar { display: none !important; }'
              : "document.querySelector('.sidebar')?.remove();"
          }
          rows={6}
          className="resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          required
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim() || !script.trim()}
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Creating...' : 'Create Tweek'}
      </button>
    </form>
  )
}
