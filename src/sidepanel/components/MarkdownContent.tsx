import React from 'react'
import Markdown from 'markdown-to-jsx'
import styles from '../styles/components/MarkdownContent.module.scss'
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
        styles.container, 
        styles.plainText, 
        compact && styles.compact,
        className
      )}>
        <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
      </div>
    )
  }

  // Render with markdown-to-jsx - much simpler!
  return (
    <div className={cn(
      styles.container, 
      styles.markdown,
      compact && styles.compact,
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
                className: styles.table
              }
            },
            // Links open in new tab
            a: {
              component: 'a',
              props: {
                className: styles.link,
                target: '_blank',
                rel: 'noopener noreferrer'
              }
            },
            // Code blocks
            pre: {
              component: 'pre',
              props: {
                className: styles.codeBlock
              }
            },
            // Inline code
            code: {
              component: 'code',
              props: {
                className: styles.inlineCode
              }
            },
            // Blockquotes
            blockquote: {
              component: 'blockquote',
              props: {
                className: styles.blockquote
              }
            },
            // Lists
            ul: {
              component: 'ul',
              props: {
                className: styles.list
              }
            },
            ol: {
              component: 'ol',
              props: {
                className: styles.orderedList
              }
            },
            // Paragraphs - key change: minimal margin
            p: {
              component: 'p',
              props: {
                className: styles.paragraph,
                style: { margin: '0.25em 0' }  // Minimal margin
              }
            },
            // Headings
            h1: { component: 'h1', props: { className: styles.heading1 } },
            h2: { component: 'h2', props: { className: styles.heading2 } },
            h3: { component: 'h3', props: { className: styles.heading3 } },
            h4: { component: 'h4', props: { className: styles.heading4 } },
            h5: { component: 'h5', props: { className: styles.heading5 } },
            h6: { component: 'h6', props: { className: styles.heading6 } },
            // Horizontal rules
            hr: {
              component: 'hr',
              props: {
                className: styles.divider
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
