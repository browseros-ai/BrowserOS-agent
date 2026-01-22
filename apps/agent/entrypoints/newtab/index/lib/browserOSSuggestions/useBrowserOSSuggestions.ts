/**
 * @public
 */
export interface BrowserOSSuggestion {
  mode: 'chat' | 'agent'
  message: string
}

/**
 * @public
 */
export const useBrowserOSSuggestions = ({
  query,
}: {
  query: string
}): BrowserOSSuggestion[] => {
  return [
    {
      mode: 'agent',
      message: query,
    },
  ]
}
