import { matches, type Recipe } from './types'

/**
 * In-process registry of site-affordance recipes.
 *
 * Recipes are pure metadata — this registry is a lookup table, not an
 * execution engine. The actual deterministic work happens in whatever
 * site-MCP / API / script each recipe points at via `intents`.
 */
export class RecipeRegistry {
  private recipes: Recipe[] = []

  register(recipe: Recipe): this {
    if (this.recipes.some((r) => r.id === recipe.id)) {
      throw new Error(`Duplicate recipe id: "${recipe.id}"`)
    }
    this.recipes.push(recipe)
    return this
  }

  registerMany(recipes: Recipe[]): this {
    for (const r of recipes) this.register(r)
    return this
  }

  /** Return the first recipe whose URL patterns match `url`, or undefined. */
  findByUrl(url: string): Recipe | undefined {
    return this.recipes.find((r) => matches(r, url))
  }

  /** Look up by recipe id or by `siteMcp` name. */
  findById(id: string): Recipe | undefined {
    return this.recipes.find((r) => r.id === id || r.siteMcp === id)
  }

  all(): readonly Recipe[] {
    return this.recipes
  }
}

/** Return tool hints that apply to the current URL fragment. */
export function contextIntentsFor(recipe: Recipe, url: string): string[] {
  const out: string[] = []
  for (const [sub, tools] of Object.entries(recipe.contextHints)) {
    if (url.includes(sub)) out.push(...tools)
  }
  return out
}
