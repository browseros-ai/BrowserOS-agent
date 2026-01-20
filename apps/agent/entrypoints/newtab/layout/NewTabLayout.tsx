import type { FC } from 'react'
import { Outlet } from 'react-router'
import { NewTabFocusGrid } from './NewTabFocusGrid'

export const NewTabLayout: FC = () => {
  return (
    <>
      <NewTabFocusGrid />
      <Outlet />
    </>
  )
}
