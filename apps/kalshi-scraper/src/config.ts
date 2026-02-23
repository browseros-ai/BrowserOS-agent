import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string(),
  BROWSERBASE_API_KEY: z.string(),
  BROWSERBASE_PROJECT_ID: z.string(),
  SCRAPE_SECRET: z.string().default('dev-secret'),
  PORT: z.coerce.number().default(3001),
})

function parseConfig() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  return result.data
}

export const config = parseConfig()
export type Config = z.infer<typeof envSchema>
