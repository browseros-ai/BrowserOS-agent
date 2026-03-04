import { MessageSquare, Send } from 'lucide-react'
import type { FC } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { openSidePanelWithSearch } from '@/lib/messaging/sidepanel/openSidepanelWithSearch'

interface Example {
  label: string
  query: string
}

const SOUL_EXAMPLES: Example[] = [
  {
    label: 'Set your tone',
    query:
      'Be more casual and direct with me. Skip formalities and just get to the point.',
  },
  {
    label: 'Add a boundary',
    query:
      'Never auto-close my tabs without asking first. Add this to your soul.',
  },
  {
    label: 'Change personality',
    query:
      'I want you to be witty and slightly sarcastic, like a smart coworker who enjoys their job.',
  },
  {
    label: 'Reset your soul',
    query:
      'Read your current soul file, then rewrite it from scratch. Ask me a few questions about how I want you to behave.',
  },
]

export const SoulExamples: FC = () => {
  const [editingQuery, setEditingQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleTryIt = (query: string) => {
    setEditingQuery(query)
    setDialogOpen(true)
  }

  const handleSend = () => {
    if (!editingQuery.trim()) return
    openSidePanelWithSearch('open', {
      query: editingQuery.trim(),
      mode: 'agent',
    })
    setDialogOpen(false)
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-medium text-sm">Shape your agent's soul</h3>
        <p className="mt-1 text-muted-foreground text-xs">
          Try these prompts to customize how your agent behaves. Edit the
          message before sending.
        </p>
      </div>

      <div className="grid gap-2">
        {SOUL_EXAMPLES.map((example) => (
          <div
            key={example.label}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50"
          >
            <div className="mr-3 min-w-0 flex-1">
              <p className="font-medium text-sm">{example.label}</p>
              <p className="mt-0.5 truncate text-muted-foreground text-xs">
                {example.query}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => handleTryIt(example.query)}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Try it
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit message</DialogTitle>
            <DialogDescription>
              Customize the prompt before sending it to your agent.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editingQuery}
            onChange={(e) => setEditingQuery(e.target.value)}
            rows={4}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={!editingQuery.trim()}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
