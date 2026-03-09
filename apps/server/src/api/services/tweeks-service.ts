import { getDb } from '../../lib/db'
import { logger } from '../../lib/logger'

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

export interface CreateTweekInput {
  name: string
  description?: string
  domain: string
  url_pattern: string
  script: string
  script_type?: 'js' | 'css'
}

export interface UpdateTweekInput {
  name?: string
  description?: string
  script?: string
  url_pattern?: string
  enabled?: boolean
}

export class TweeksService {
  list(domain?: string): Tweek[] {
    const db = getDb()
    if (domain) {
      return db
        .query<Tweek, [string]>(
          'SELECT * FROM tweeks WHERE domain = ? ORDER BY created_at DESC',
        )
        .all(domain)
    }
    return db
      .query<Tweek, []>('SELECT * FROM tweeks ORDER BY created_at DESC')
      .all()
  }

  getById(id: string): Tweek | null {
    const db = getDb()
    return db
      .query<Tweek, [string]>('SELECT * FROM tweeks WHERE id = ?')
      .get(id)
  }

  create(input: CreateTweekInput): Tweek {
    const db = getDb()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.query(
      `INSERT INTO tweeks (id, name, description, domain, url_pattern, script, script_type, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(
      id,
      input.name,
      input.description ?? null,
      input.domain,
      input.url_pattern,
      input.script,
      input.script_type ?? 'js',
      now,
      now,
    )

    logger.info('Tweek created', { id, name: input.name, domain: input.domain })
    // biome-ignore lint/style/noNonNullAssertion: row was just inserted
    return this.getById(id)!
  }

  update(id: string, input: UpdateTweekInput): Tweek | null {
    const existing = this.getById(id)
    if (!existing) return null

    const db = getDb()
    const now = new Date().toISOString()

    const fields: string[] = ['updated_at = ?']
    const values: (string | number)[] = [now]

    if (input.name !== undefined) {
      fields.push('name = ?')
      values.push(input.name)
    }
    if (input.description !== undefined) {
      fields.push('description = ?')
      values.push(input.description)
    }
    if (input.script !== undefined) {
      fields.push('script = ?')
      values.push(input.script)
    }
    if (input.url_pattern !== undefined) {
      fields.push('url_pattern = ?')
      values.push(input.url_pattern)
    }
    if (input.enabled !== undefined) {
      fields.push('enabled = ?')
      values.push(input.enabled ? 1 : 0)
    }

    values.push(id)
    db.query(`UPDATE tweeks SET ${fields.join(', ')} WHERE id = ?`).run(
      ...values,
    )

    logger.info('Tweek updated', { id })
    return this.getById(id)
  }

  delete(id: string): boolean {
    const db = getDb()
    const result = db.query('DELETE FROM tweeks WHERE id = ?').run(id)
    if (result.changes > 0) {
      logger.info('Tweek deleted', { id })
      return true
    }
    return false
  }

  getMatchingTweeks(url: string): Tweek[] {
    const db = getDb()
    const allEnabled = db
      .query<Tweek, []>('SELECT * FROM tweeks WHERE enabled = 1')
      .all()

    return allEnabled.filter((tweek) => this.matchesUrl(tweek.url_pattern, url))
  }

  private matchesUrl(pattern: string, url: string): boolean {
    try {
      const regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
      return new RegExp(`^${regexStr}$`).test(url)
    } catch {
      return false
    }
  }
}
