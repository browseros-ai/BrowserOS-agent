import type { ComponentProps } from 'react'
import { memo } from 'react'
import type { BundledTheme } from 'shiki'
import { Streamdown } from 'streamdown'
import { cn } from '@/lib/utils'

const themes = ['catppuccin-latte', 'catppuccin-mocha'] as [
  BundledTheme,
  BundledTheme,
]

export type MarkdownDocumentProps = ComponentProps<typeof Streamdown>

export const MarkdownDocument = memo(
  ({ className, ...props }: MarkdownDocumentProps) => (
    <Streamdown
      className={cn(
        'size-full break-words text-sm leading-7 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_[data-streamdown="code-block"]]:w-full! [&_[data-streamdown="table-wrapper"]]:w-full!',
        className,
      )}
      shikiTheme={themes}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.className === nextProps.className,
)

MarkdownDocument.displayName = 'MarkdownDocument'
