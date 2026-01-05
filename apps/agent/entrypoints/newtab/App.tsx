import type { FC } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { NewTab } from './index/NewTab'
import { NewTabLayout } from './layout/NewTabLayout'
import { Personalize } from './personalize/Personalize'

export const App: FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<NewTabLayout />}>
          <Route index element={<NewTab />} />
          <Route path="/personalize" element={<Personalize />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
