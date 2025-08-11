import React from 'react'

interface RecentsListProps {
  type: 'tasks' | 'tabs'
}

export function RecentsList({ type }: RecentsListProps) {
  // Mock data - will be replaced with actual data from stores
  const items = type === 'tasks' 
    ? [
        { id: '1', title: 'Summarized article on AI', time: '2 min ago' },
        { id: '2', title: 'Filled contact form', time: '1 hour ago' },
        { id: '3', title: 'Extracted links from page', time: '3 hours ago' }
      ]
    : [
        { id: '1', title: 'Documentation - TypeScript', url: 'typescript.org' },
        { id: '2', title: 'GitHub - Nxtscape', url: 'github.com' },
        { id: '3', title: 'Stack Overflow', url: 'stackoverflow.com' }
      ]
  
  return (
    <div className="space-y-2">
      {items.map(item => (
        <button
          key={item.id}
          className="
            w-full p-2 text-left
            rounded-lg
            hover:bg-accent
            transition-colors
            focus:ring-2 focus:ring-primary focus:outline-none
          "
        >
          <div className="text-sm text-foreground line-clamp-1">
            {item.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {'time' in item ? item.time : item.url}
          </div>
        </button>
      ))}
    </div>
  )
}