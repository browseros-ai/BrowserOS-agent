/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { describe, it } from 'bun:test'
import assert from 'node:assert'

import { transformCodeForExecution } from '../../src/graph/executor'

describe('transformCodeForExecution', () => {
  describe('single-line imports', () => {
    it('removes default import', () => {
      const code = `import foo from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes named import', () => {
      const code = `import { foo } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes multiple named imports', () => {
      const code = `import { foo, bar, baz } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes namespace import', () => {
      const code = `import * as pkg from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes side-effect import', () => {
      const code = `import 'side-effect'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes default + named import', () => {
      const code = `import foo, { bar } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes import with alias', () => {
      const code = `import { foo as f } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('type imports', () => {
    it('removes type import', () => {
      const code = `import type { Foo } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes type default import', () => {
      const code = `import type Foo from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes inline type specifier', () => {
      const code = `import { type Foo, bar } from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('multi-line imports', () => {
    it('removes multi-line named imports', () => {
      const code = `import {
  foo,
  bar,
} from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes multi-line type imports', () => {
      const code = `import type {
  Foo,
  Bar,
} from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes multi-line imports with aliases', () => {
      const code = `import {
  foo as f,
  bar as b,
} from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes deeply nested multi-line imports', () => {
      const code = `import {
  foo,
  bar,
  baz,
  qux,
} from '@scoped/package-name'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('quote styles', () => {
    it('handles single quotes', () => {
      const code = `import foo from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('handles double quotes', () => {
      const code = `import foo from "pkg"
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('multiple imports', () => {
    it('removes all imports from different packages', () => {
      const code = `import { z } from 'zod'
import { Agent } from '@browseros-ai/agent-sdk'
import type { Config } from './types'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes mixed single and multi-line imports', () => {
      const code = `import foo from 'foo'
import {
  bar,
  baz,
} from 'bar'
import qux from 'qux'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('indentation', () => {
    it('removes indented imports', () => {
      const code = `  import foo from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes tab-indented imports', () => {
      const code = `\timport foo from 'pkg'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('preserves non-import code', () => {
    it('preserves all code after imports', () => {
      const code = `import foo from 'pkg'

export async function run(agent) {
  await agent.navigate('https://example.com')
  return 'done'
}`
      const result = transformCodeForExecution(code)
      assert.ok(result.includes('export async function run(agent)'))
      assert.ok(result.includes("await agent.navigate('https://example.com')"))
      assert.ok(result.includes("return 'done'"))
      assert.ok(!result.includes('import'))
    })

    it('preserves code with import-like strings', () => {
      const code = `import foo from 'pkg'
const str = "import { x } from 'y'"
const x = 1`
      const result = transformCodeForExecution(code)
      assert.ok(result.includes(`const str = "import { x } from 'y'"`))
      assert.ok(result.includes('const x = 1'))
    })

    it('preserves dynamic imports', () => {
      const code = `import foo from 'pkg'
const mod = await import('./dynamic')
const x = 1`
      const result = transformCodeForExecution(code)
      assert.ok(result.includes("const mod = await import('./dynamic')"))
      assert.ok(result.includes('const x = 1'))
    })
  })

  describe('scoped packages', () => {
    it('removes @scoped/package imports', () => {
      const code = `import { Agent } from '@browseros-ai/agent-sdk'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes deeply scoped package imports', () => {
      const code = `import { foo } from '@org/pkg/sub/path'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('relative imports', () => {
    it('removes relative imports', () => {
      const code = `import foo from './foo'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('removes parent directory imports', () => {
      const code = `import foo from '../foo'
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })

  describe('edge cases', () => {
    it('handles empty code', () => {
      const result = transformCodeForExecution('')
      assert.strictEqual(result, '')
    })

    it('handles code with no imports', () => {
      const code = `const x = 1
const y = 2`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result, code)
    })

    it('handles code with only imports', () => {
      const code = `import foo from 'foo'
import bar from 'bar'`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), '')
    })

    it('handles imports with trailing semicolons', () => {
      const code = `import foo from 'pkg';
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })

    it('handles imports with trailing comments', () => {
      const code = `import foo from 'pkg' // comment
const x = 1`
      const result = transformCodeForExecution(code)
      assert.strictEqual(result.trim(), 'const x = 1')
    })
  })
})
