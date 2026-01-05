import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { NewTab } from './index/NewTab'
import { Personalize } from './personalize/Personalize'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route index element={<NewTab />} />
        <Route path="/personalize" element={<Personalize />} />
      </Routes>
    </HashRouter>
  )
}
