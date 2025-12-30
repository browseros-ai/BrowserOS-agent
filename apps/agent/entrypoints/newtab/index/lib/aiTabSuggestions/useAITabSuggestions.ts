import { compact } from 'es-toolkit/array'
import {
  Bot,
  FileText,
  type LucideIcon,
  MessagesSquare,
  Scale,
  Tags,
} from 'lucide-react'

/**
 * @public
 */
export type AITabSuggestion = {
  name: string
  icon: LucideIcon
  minTabs: number
  maxTabs: number
  description: string
}

const actions: AITabSuggestion[] = [
  {
    name: 'Summarize this Page',
    icon: FileText,
    minTabs: 1,
    maxTabs: 1,
    description: 'Generate a concise summary of the current webpage content.',
  },
  {
    name: 'Summarize selected tabs',
    icon: FileText,
    minTabs: 2,
    maxTabs: 5,
    description:
      'Generate a concise summary of the content from all selected tabs.',
  },
  {
    name: 'What topics does this page talk about?',
    icon: Tags,
    minTabs: 1,
    maxTabs: 1,
    description:
      'Identify and list the main topics discussed on the current webpage.',
  },
  {
    name: 'Extract comments from this page',
    icon: MessagesSquare,
    minTabs: 1,
    maxTabs: 1,
    description:
      'Extract user comments or feedback present on the current webpage.',
  },
  {
    name: 'Compare selected tabs',
    icon: Scale,
    minTabs: 2,
    maxTabs: 5,
    description:
      'Analyze and highlight the differences and similarities between the selected tabs.',
  },
]

/**
 * @public
 */
export const useAITabSuggestions = ({
  selectedTabs,
  input,
}: {
  selectedTabs: chrome.tabs.Tab[]
  input: string
}) => {
  const tabsLength = selectedTabs.length

  const inputAction: AITabSuggestion | undefined = input
    ? {
        name: input,
        icon: Bot,
        description: '',
        minTabs: 1,
        maxTabs: Infinity,
      }
    : undefined

  return compact([inputAction, ...actions]).filter(
    (action) => tabsLength >= action.minTabs && tabsLength <= action.maxTabs,
  )
}
