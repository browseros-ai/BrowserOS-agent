import '@mdxeditor/editor/style.css'
import {
  headingsPlugin,
  listsPlugin,
  MDXEditor,
  type MDXEditorMethods,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
} from '@mdxeditor/editor'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  readOnly?: boolean
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
}

const plugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  markdownShortcutPlugin(),
]

export const MarkdownEditor = ({
  value,
  onChange,
  placeholder,
  className,
  autoFocus,
  readOnly,
  onKeyDown,
}: MarkdownEditorProps) => {
  const editorRef = useRef<MDXEditorMethods>(null)

  useEffect(() => {
    const current = editorRef.current?.getMarkdown() ?? ''
    if (current !== value) {
      editorRef.current?.setMarkdown(value)
    }
  }, [value])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onKeyDown forwarding for Cmd+Enter
    <div className={cn('mdx-editor-themed', className)} onKeyDown={onKeyDown}>
      <MDXEditor
        ref={editorRef}
        markdown={value}
        onChange={onChange}
        placeholder={placeholder}
        plugins={plugins}
        autoFocus={autoFocus}
        readOnly={readOnly}
        contentEditableClassName="mdx-content-editable prose prose-sm max-w-none dark:prose-invert"
      />
    </div>
  )
}
