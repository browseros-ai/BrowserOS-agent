import {
  createContext,
  type FC,
  type ReactNode,
  useContext,
  useState,
} from 'react'
import { ShortcutsDialog } from '../index/ShortcutsDialog'

interface ShortcutsContextValue {
  openShortcuts: () => void
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null)

interface ShortcutsProviderProps {
  children: ReactNode
}

export const ShortcutsProvider: FC<ShortcutsProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false)

  const openShortcuts = () => setOpen(true)

  return (
    <ShortcutsContext.Provider value={{ openShortcuts }}>
      {children}
      <ShortcutsDialog open={open} onOpenChange={setOpen} />
    </ShortcutsContext.Provider>
  )
}

export const useShortcuts = () => {
  const context = useContext(ShortcutsContext)
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutsProvider')
  }
  return context
}
