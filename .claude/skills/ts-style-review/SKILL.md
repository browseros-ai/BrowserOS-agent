---
name: ts-style-review
description: Review TypeScript code against the Google TypeScript Style Guide plus team conventions. Use when reviewing TS code for style, naming, imports, type usage, or quality.
---

# TypeScript Style Guide Review

When reviewing TypeScript code, check against these sections. For full rules and examples, see [google-ts-styleguide.md](google-ts-styleguide.md).

## 1. Source File Structure
- File order: copyright, `@fileoverview`, imports, implementation
- Use named exports only — no default exports
- Use ES6 modules — no `namespace`, no `require()`
- Prefer namespace imports for large APIs, named imports for frequently used symbols
- No mutable exports (`export let`) — use getter functions instead
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 3. Source file structure

## 2. Variables & Literals
- `const` by default, `let` when reassigned, never `var`
- One variable per declaration
- Single quotes for strings, template literals for concatenation
- No `Array()` or `Object()` constructors
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 4. Language features

## 3. Classes
- Use `readonly` for properties never reassigned after constructor
- Use parameter properties (`constructor(private readonly foo: Foo)`)
- No `public` keyword — TypeScript is public by default
- No `#private` fields — use `private` modifier
- No prototype manipulation
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 4. Classes

## 4. Functions
- Prefer function declarations for named functions
- Arrow functions for callbacks and nested functions — never function expressions
- Use rest parameters, not `arguments`
- Use spread syntax, not `Function.prototype.apply`
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 4. Functions

## 5. Control Flow & Error Handling
- Always use braces for control flow blocks
- Always `===` and `!==` (exception: `== null` for null/undefined check)
- `for...of` for arrays, never `for...in`
- Only throw `Error` instances (or subclasses), never strings
- All `switch` must have `default`, no fall-through
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 4. Control structures

## 6. Naming
- `UpperCamelCase`: classes, interfaces, types, enums, decorators, TSX components
- `lowerCamelCase`: variables, parameters, functions, methods, properties
- `CONSTANT_CASE`: global constants, enum values
- Descriptive names — no ambiguous abbreviations
- Treat acronyms as words (`loadHttpUrl`, not `loadHTTPURL`)
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 5. Naming

## 7. Type System
- Prefer `interface` over `type` alias for object shapes
- Use `unknown` over `any` — narrow with type guards
- Use optional (`?`) over `| undefined`
- `T[]` for simple types, `Array<T>` for complex
- No wrapper types (`String`, `Boolean`, `Number`) — use primitives
- No `@ts-ignore` or `@ts-nocheck`
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 6. Type system

## 8. Schema & Type Definitions (Team Convention)
- Use **Zod** for defining schemas, then derive TypeScript types with `z.infer<typeof schema>`
- If types are **not shared** across files, define the Zod schema and inferred type at the **top of the same file** that uses them
- If types **are shared**, place them in a shared types/schemas module
- Example:
  ```ts
  import { z } from 'zod';

  const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  });

  type User = z.infer<typeof UserSchema>;
  ```

## 9. Comments & Documentation
- `/** JSDoc */` for public API documentation
- `//` for implementation comments
- No type annotations in JSDoc — TypeScript handles types
- Mark deprecated code with `@deprecated`
- See [google-ts-styleguide.md](google-ts-styleguide.md) § 8. Comments and documentation
