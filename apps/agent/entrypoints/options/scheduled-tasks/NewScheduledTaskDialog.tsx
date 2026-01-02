import { zodResolver } from '@hookform/resolvers/zod'
import type { FC } from 'react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v3'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { ScheduledJob } from './types'

const formSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must be 100 characters or less'),
    query: z.string().min(1, 'Prompt is required'),
    scheduleType: z.enum(['daily', 'hourly', 'minutes']),
    scheduleTime: z.string().optional(),
    scheduleInterval: z.number().int().min(1).max(60).optional(),
    enabled: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.scheduleType === 'daily' && !data.scheduleTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Time is required for daily schedule',
        path: ['scheduleTime'],
      })
    }
    if (
      (data.scheduleType === 'hourly' || data.scheduleType === 'minutes') &&
      (!data.scheduleInterval || data.scheduleInterval < 1)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Interval must be at least 1',
        path: ['scheduleInterval'],
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

interface NewScheduledTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialValues?: ScheduledJob | null
  onSave: (data: Omit<ScheduledJob, 'id' | 'createdAt'>) => void
}

export const NewScheduledTaskDialog: FC<NewScheduledTaskDialogProps> = ({
  open,
  onOpenChange,
  initialValues,
  onSave,
}) => {
  const isEditing = !!initialValues

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      query: '',
      scheduleType: 'daily',
      scheduleTime: '09:00',
      scheduleInterval: 1,
      enabled: true,
    },
  })

  const scheduleType = form.watch('scheduleType')

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.reset({
          name: initialValues.name,
          query: initialValues.query,
          scheduleType: initialValues.scheduleType,
          scheduleTime: initialValues.scheduleTime || '09:00',
          scheduleInterval: initialValues.scheduleInterval || 1,
          enabled: initialValues.enabled,
        })
      } else {
        form.reset({
          name: '',
          query: '',
          scheduleType: 'daily',
          scheduleTime: '09:00',
          scheduleInterval: 1,
          enabled: true,
        })
      }
    }
  }, [open, initialValues, form])

  const onSubmit = (values: FormValues) => {
    onSave({
      name: values.name.trim(),
      query: values.query.trim(),
      scheduleType: values.scheduleType,
      scheduleTime:
        values.scheduleType === 'daily' ? values.scheduleTime : undefined,
      scheduleInterval:
        values.scheduleType !== 'daily' ? values.scheduleInterval : undefined,
      enabled: values.enabled,
    })
    form.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Scheduled Task' : 'Create Scheduled Task'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your scheduled task configuration.'
              : 'Create a new task that runs automatically on a schedule.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Morning Briefing" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prompt</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What should the agent do? e.g., Check my email and summarize important messages"
                      className="min-h-[100px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The instruction that will be sent to the agent
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="scheduleType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schedule</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select schedule type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="daily">Daily at time</SelectItem>
                        <SelectItem value="hourly">Every N hours</SelectItem>
                        <SelectItem value="minutes">Every N minutes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scheduleType === 'daily' ? (
                <FormField
                  control={form.control}
                  name="scheduleTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="scheduleInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Interval (
                        {scheduleType === 'hourly' ? 'hours' : 'minutes'})
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={scheduleType === 'hourly' ? 24 : 60}
                          value={field.value ?? ''}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value
                                ? Number(e.target.value)
                                : undefined,
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Enable this task
                  </FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
