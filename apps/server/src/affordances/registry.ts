import { matches, type Recipe } from './types'

/**
 * In-process registry of site-affordance recipes.
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

  findByUrl(url: string): Recipe | undefined {
    return this.recipes.find((r) => matches(r, url))
  }

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
