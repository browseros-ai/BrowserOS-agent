import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { NewTab } from './index/NewTab'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<NewTab />} />
      </Routes>
    </HashRouter>
  )
}
