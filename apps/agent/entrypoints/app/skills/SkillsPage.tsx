import { Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import { type FC, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { type SkillDetail, type SkillMeta, useSkills } from './useSkills'

export const SkillsPage: FC = () => {
  const {
    skills,
    isLoading,
    createSkill,
    updateSkill,
    deleteSkill,
    fetchSkillDetail,
  } = useSkills()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<SkillDetail | null>(null)
  const [skillToDelete, setSkillToDelete] = useState<SkillMeta | null>(null)

  const handleCreate = () => {
    setEditingSkill(null)
    setIsDialogOpen(true)
  }

  const handleEdit = async (skill: SkillMeta) => {
    try {
      const detail = await fetchSkillDetail(skill.id)
      setEditingSkill(detail)
      setIsDialogOpen(true)
    } catch {
      toast.error('Failed to load skill details')
    }
  }

  const handleToggle = async (skill: SkillMeta, enabled: boolean) => {
    try {
      await updateSkill(skill.id, { enabled })
    } catch {
      toast.error('Failed to toggle skill')
    }
  }

  const handleDelete = async () => {
    if (!skillToDelete) return
    try {
      await deleteSkill(skillToDelete.id)
      toast.success(`Deleted "${skillToDelete.name}"`)
    } catch {
      toast.error('Failed to delete skill')
    }
    setSkillToDelete(null)
  }

  if (isLoading) {
    return (
      <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
        <SkillsHeader onCreateClick={handleCreate} />
        <div className="text-muted-foreground text-sm">Loading skills...</div>
      </div>
    )
  }

  return (
    <div className="fade-in slide-in-from-bottom-5 animate-in space-y-6 duration-500">
      <SkillsHeader onCreateClick={handleCreate} />

      {skills.length === 0 ? (
        <EmptyState onCreateClick={handleCreate} />
      ) : (
        <div className="space-y-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onEdit={() => handleEdit(skill)}
              onDelete={() => setSkillToDelete(skill)}
              onToggle={(enabled) => handleToggle(skill, enabled)}
            />
          ))}
        </div>
      )}

      <SkillDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingSkill={editingSkill}
        onSave={async (data) => {
          try {
            if (editingSkill) {
              await updateSkill(editingSkill.id, data)
              toast.success('Skill updated')
            } else {
              await createSkill(data)
              toast.success('Skill created')
            }
            setIsDialogOpen(false)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to save')
          }
        }}
      />

      <AlertDialog
        open={!!skillToDelete}
        onOpenChange={(open) => !open && setSkillToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{skillToDelete?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const SkillsHeader: FC<{ onCreateClick: () => void }> = ({ onCreateClick }) => (
  <div className="flex items-center justify-between">
    <div>
      <h1 className="font-semibold text-2xl tracking-tight">Skills</h1>
      <p className="text-muted-foreground text-sm">
        Define custom skills to extend your agent's capabilities.
      </p>
    </div>
    <Button onClick={onCreateClick} size="sm">
      <Plus className="mr-1.5 size-4" />
      New Skill
    </Button>
  </div>
)

const EmptyState: FC<{ onCreateClick: () => void }> = ({ onCreateClick }) => (
  <Card className="border-dashed">
    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
      <Wand2 className="mb-4 size-10 text-muted-foreground" />
      <h3 className="mb-1 font-medium text-lg">No skills yet</h3>
      <p className="mb-4 max-w-sm text-muted-foreground text-sm">
        Skills are instructions that teach your agent how to handle specific
        tasks like creating PDFs, processing data, or drafting emails.
      </p>
      <Button onClick={onCreateClick} size="sm">
        <Plus className="mr-1.5 size-4" />
        Create your first skill
      </Button>
    </CardContent>
  </Card>
)

const SkillCard: FC<{
  skill: SkillMeta
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
}> = ({ skill, onEdit, onDelete, onToggle }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="font-medium text-base">{skill.name}</CardTitle>
      <div className="flex items-center gap-2">
        <Switch
          checked={skill.enabled}
          onCheckedChange={onToggle}
          aria-label={`Toggle ${skill.name}`}
        />
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}>
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </CardHeader>
    <CardContent>
      <p className="line-clamp-2 text-muted-foreground text-sm">
        {skill.description}
      </p>
    </CardContent>
  </Card>
)

const SkillDialog: FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  editingSkill: SkillDetail | null
  onSave: (data: {
    name: string
    description: string
    content: string
  }) => Promise<void>
}> = ({ open, onOpenChange, editingSkill, onSave }) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(editingSkill?.name ?? '')
    setDescription(editingSkill?.description ?? '')
    setContent(editingSkill?.content ?? '')
  }, [editingSkill])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSave({ name, description, content })
    } finally {
      setSaving(false)
    }
  }

  const isValid = name.trim() && description.trim() && content.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingSkill ? 'Edit Skill' : 'Create Skill'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-name">Name</Label>
            <Input
              id="skill-name"
              placeholder="e.g., PDF Processing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-description">Description</Label>
            <Input
              id="skill-description"
              placeholder="When should the agent use this skill?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="skill-content">Instructions (Markdown)</Label>
            <Textarea
              id="skill-content"
              placeholder="Write instructions for the agent. Use markdown for formatting."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || saving}>
            {saving ? 'Saving...' : editingSkill ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
