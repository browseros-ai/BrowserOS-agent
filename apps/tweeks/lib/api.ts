const SERVER_URL = 'http://127.0.0.1:9222'

export interface Tweek {
  id: string
  name: string
  description: string | null
  domain: string
  url_pattern: string
  script: string
  script_type: 'js' | 'css'
  enabled: number
  created_at: string
  updated_at: string
}

export async function fetchTweeks(domain?: string): Promise<Tweek[]> {
  const params = domain ? `?domain=${encodeURIComponent(domain)}` : ''
  const res = await fetch(`${SERVER_URL}/tweeks${params}`)
  const data = await res.json()
  return data.tweeks
}

export async function fetchMatchingTweeks(url: string): Promise<Tweek[]> {
  const res = await fetch(
    `${SERVER_URL}/tweeks/match?url=${encodeURIComponent(url)}`,
  )
  const data = await res.json()
  return data.tweeks
}

export async function createTweek(input: {
  name: string
  description?: string
  domain: string
  url_pattern: string
  script: string
  script_type?: 'js' | 'css'
}): Promise<Tweek> {
  const res = await fetch(`${SERVER_URL}/tweeks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  return data.tweek
}

export async function updateTweek(
  id: string,
  input: {
    name?: string
    description?: string
    script?: string
    enabled?: boolean
  },
): Promise<Tweek> {
  const res = await fetch(`${SERVER_URL}/tweeks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json()
  return data.tweek
}

export async function deleteTweek(id: string): Promise<void> {
  await fetch(`${SERVER_URL}/tweeks/${id}`, { method: 'DELETE' })
}
