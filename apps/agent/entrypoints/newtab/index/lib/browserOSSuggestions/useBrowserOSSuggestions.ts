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
      mode: 'chat',
      message: query,
    },
    // TODO: Temporarily removed agent mode on search suggestions
    // {
    //   mode: 'agent',
    //   message: query,
    // },
  ]
}
