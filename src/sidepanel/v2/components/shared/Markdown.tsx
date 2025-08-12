import React from 'react'
import Markdown from 'markdown-to-jsx'
import { cn } from '@/sidepanel/lib/utils'

interface MarkdownContentProps {
  content: string
  className?: string
  forceMarkdown?: boolean  // Kept for backward compatibility but ignored
  skipMarkdown?: boolean  // Skip markdown rendering - plain text only
  compact?: boolean  // Control compact mode styling
}

/**
 * Simplified markdown renderer using markdown-to-jsx
 * Provides clean rendering without excessive spacing issues
 */
export function MarkdownContent({ 
  content, 
  className, 
  forceMarkdown = false,  // Ignored - we always render as markdown
  skipMarkdown = false,
  compact = false  // Default to false for better readability
}: MarkdownContentProps): JSX.Element {
  // Only render as plain text if explicitly requested
  if (skipMarkdown) {
    return (
      <div className={cn(
        'text-sm',
        compact && 'space-y-1',
        className
      )}>
        <span className="whitespace-pre-wrap">{content}</span>
      </div>
    )
  }

  // Render with markdown-to-jsx - much simpler!
  return (
    <div className={cn(
      'text-sm space-y-2 [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-border [&_table]:rounded-lg [&_table]:my-4 [&_table]:min-w-full [&_th]:border [&_th]:border-border [&_th]:bg-muted/80 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-sm [&_th]:text-foreground [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_td]:text-foreground [&_tr:hover]:bg-muted/30 [&_tr]:transition-colors',
      compact && 'space-y-1',
      className
    )}>
      <Markdown
        options={{
          // Override specific elements with minimal styling
          overrides: {
            // Tables with minimal wrapper
            table: {
              component: 'table',
              props: {
                className: 'w-full border-collapse border border-border rounded-lg my-4 min-w-full'
              }
            },
            // Links open in new tab
            a: {
              component: 'a',
              props: {
                className: 'text-primary hover:underline',
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            },
            // Code blocks
            pre: {
              component: 'pre',
              props: {
                className: 'bg-muted p-3 rounded-md overflow-x-auto text-xs'
              }
            },
            // Inline code
            code: {
              component: 'code',
              props: {
                className: 'bg-muted px-1 py-0.5 rounded text-xs'
              }
            },
            // Blockquotes
            blockquote: {
              component: 'blockquote',
              props: {
                className: 'border-l-4 border-primary pl-4 italic'
              }
            },
            // Lists
            ul: {
              component: 'ul',
              props: {
                className: 'list-disc pl-6 space-y-1'
              }
            },
            ol: {
              component: 'ol',
              props: {
                className: 'list-decimal pl-6 space-y-1'
              }
            },
            // Paragraphs - key change: minimal margin
            p: {
              component: 'p',
              props: {
                className: 'mb-2 last:mb-0'
              }
            },
            // Headings
            h1: { component: 'h1', props: { className: 'text-2xl font-bold mb-3' } },
            h2: { component: 'h2', props: { className: 'text-xl font-semibold mb-2' } },
            h3: { component: 'h3', props: { className: 'text-lg font-semibold mb-2' } },
            h4: { component: 'h4', props: { className: 'text-base font-semibold mb-1' } },
            h5: { component: 'h5', props: { className: 'text-sm font-semibold mb-1' } },
            h6: { component: 'h6', props: { className: 'text-sm font-semibold mb-1' } },
            // Horizontal rules
            hr: {
              component: 'hr',
              props: {
                className: 'border-t border-border my-4'
              }
            },
            // Table headers
            th: {
              component: 'th',
              props: {
                className: 'border border-border bg-muted/80 px-3 py-2 text-left font-medium text-sm text-foreground'
              }
            },
            // Table cells
            td: {
              component: 'td',
              props: {
                className: 'border border-border px-3 py-2 text-sm text-foreground'
              }
            },
            // Table rows
            tr: {
              component: 'tr',
              props: {
                className: 'hover:bg-muted/30 transition-colors'
              }
            }
          },
          // Disable wrapper paragraph for single line content
          forceWrapper: false,
          // Allow all HTML elements (we trust our own markdown)
          disableParsingRawHTML: false
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
