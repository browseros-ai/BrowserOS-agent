import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { Chat } from './index/Chat'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<Chat />} />
      </Routes>
    </HashRouter>
  )
}
