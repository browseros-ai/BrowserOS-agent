import { magicLinkClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'
import { env } from '../env'

export const { signIn, signUp, useSession } = createAuthClient({
  baseURL: env.VITE_PUBLIC_BROWSEROS_API,
  plugins: [magicLinkClient()],
})
