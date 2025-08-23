import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  className?: string
  minRows?: number
}

export const AutoResizeTextarea = forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, className, minRows = 1, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null)
    
    // Expose the internal ref to parent components
    useImperativeHandle(ref, () => internalRef.current as HTMLTextAreaElement)

    // Auto-resize function
    const autoResize = (): void => {
      const el = internalRef.current
      if (!el) return
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }

    // Resize on value change
    useEffect(() => {
      autoResize()
    }, [value])

    return (
      <textarea
        ref={internalRef}
        value={value}
        onChange={onChange}
        rows={minRows}
        className={className}
        {...props}
      />
    )
  }
)

AutoResizeTextarea.displayName = 'AutoResizeTextarea'