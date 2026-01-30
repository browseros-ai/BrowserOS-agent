import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import localforage from 'localforage'
import type { FC, ReactNode } from 'react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
  },
})

const asyncStoragePersister = createAsyncStoragePersister({
  storage: localforage,
})

export const QueryProvider: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <PersistQueryClientProvider
      persistOptions={{ persister: asyncStoragePersister }}
      client={queryClient}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
