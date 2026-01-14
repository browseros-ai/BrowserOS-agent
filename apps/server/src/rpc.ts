import type { createHttpServer } from './api/server'

// Export type for client inference (e.g., hono/client)
export type AppType = Awaited<ReturnType<typeof createHttpServer>>['app']
