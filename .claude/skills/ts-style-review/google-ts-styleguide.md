Here is the Google TypeScript Style Guide converted to Markdown.

# Google TypeScript Style Guide

This guide is based on the internal Google TypeScript style guide, but it has been slightly adjusted to remove Google-internal sections. Google's internal environment has different constraints on TypeScript than you might find outside of Google. The advice here is specifically useful for people authoring code they intend to import into Google, but otherwise may not apply in your external environment.

There is no automatic deployment process for this version as it's pushed on-demand by volunteers.

---

## 1. Introduction

### Terminology notes

This Style Guide uses [RFC 2119](https://tools.ietf.org/html/rfc2119) terminology when using the phrases *must*, *must not*, *should*, *should not*, and *may*. The terms *prefer* and *avoid* correspond to *should* and *should not*, respectively. Imperative and declarative statements are prescriptive and correspond to *must*.

### Guide notes

All examples given are **non-normative** and serve only to illustrate the normative language of the style guide. That is, while the examples are in Google Style, they may not illustrate the *only* stylish way to represent the code. Optional formatting choices made in examples must not be enforced as rules.

## 2. Source file basics

### File encoding: UTF-8

Source files are encoded in **UTF-8**.

#### Whitespace characters

Aside from the line terminator sequence, the ASCII horizontal space character (0x20) is the only whitespace character that appears anywhere in a source file. This implies that all other whitespace characters in string literals are escaped.

#### Special escape sequences

For any character that has a special escape sequence (`\'`, `\"`, `\\`, `\b`, `\f`, `\n`, `\r`, `\t`, `\v`), that sequence is used rather than the corresponding numeric escape (e.g `\x0a`, `\u000a`, or `\u{a}`). Legacy octal escapes are never used.

#### Non-ASCII characters

For the remaining non-ASCII characters, use the actual Unicode character (e.g. `∞`). For non-printable characters, the equivalent hex or Unicode escapes (e.g. `\u221e`) can be used along with an explanatory comment.

**Good:**
```ts
// Perfectly clear, even without a comment.
const units = 'μs';

// Use escapes for non-printable characters.
const output = '\ufeff' + content;  // byte order mark
```

**Bad:**
```ts
// Hard to read and prone to mistakes, even with the comment.
const units = '\u03bcs'; // Greek letter mu, 's'

// The reader has no idea what this is.
const output = '\ufeff' + content;
```

## 3. Source file structure

Files consist of the following, **in order**:

1.  Copyright information, if present
2.  JSDoc with `@fileoverview`, if present
3.  Imports, if present
4.  The file’s implementation

**Exactly one blank line** separates each section that is present.

### Copyright information

If license or copyright information is necessary in a file, add it in a JSDoc at the top of the file.

### `@fileoverview` JSDoc

A file may have a top-level `@fileoverview` JSDoc. If present, it may provide a description of the file's content, its uses, or information about its dependencies. Wrapped lines are not indented.

**Example:**
```ts
/**
 * @fileoverview Description of file. Lorem ipsum dolor sit amet, consectetur
 * adipiscing elit, sed do eiusmod tempor incididunt.
 */
```

### Imports

There are four variants of import statements in ES6 and TypeScript:

| Import type | Example | Use for |
| :--- | :--- | :--- |
| module | `import * as foo from '...';` | TypeScript imports |
| named | `import {SomeThing} from '...';` | TypeScript imports |
| default | `import SomeThing from '...';` | Only for other external code that requires them |
| side-effect | `import '...';` | Only to import libraries for their side-effects on load (such as custom elements) |

```ts
// Good: choose between two options as appropriate (see below).
import * as ng from '@angular/core';
import {Foo} from './foo';

// Only when needed: default imports.
import Button from 'Button';

// Sometimes needed to import libraries for their side effects:
import 'jasmine';
import '@polymer/paper-button';
```

#### Import paths

TypeScript code *must* use paths to import other TypeScript code. Paths *may* be relative, i.e. starting with `.` or `..`, or rooted at the base directory, e.g. `root/path/to/file`.

Code *should* use relative imports (`./foo`) rather than absolute imports `path/to/foo` when referring to files within the same (logical) project as this allows to move the project around without introducing changes in these imports.

Consider limiting the number of parent steps (`../../../`) as those can make module and path structures hard to understand.

```ts
import {Symbol1} from 'path/from/root';
import {Symbol2} from '../parent/file';
import {Symbol3} from './sibling';
```

#### Namespace versus named imports

Both namespace and named imports can be used.

Prefer named imports for symbols used frequently in a file or for symbols that have clear names, for example Jasmine's `describe` and `it`. Named imports can be aliased to clearer names as needed with `as`.

Prefer namespace imports when using many different symbols from large APIs. A namespace import, despite using the `*` character, is not comparable to a "wildcard" import as seen in other languages. Instead, namespace imports give a name to all the exports of a module, and each exported symbol from the module becomes a property on the module name. Namespace imports can aid readability for exported symbols that have common names like `Model` or `Controller` without the need to declare aliases.

**Bad:**
```ts
// Bad: overlong import statement of needlessly namespaced names.
import {Item as TableviewItem, Header as TableviewHeader, Row as TableviewRow,
  Model as TableviewModel, Renderer as TableviewRenderer} from './tableview';

let item: TableviewItem|undefined;
```

**Good:**
```ts
// Better: use the module for namespacing.
import * as tableview from './tableview';

let item: tableview.Item|undefined;
```

**Bad:**
```ts
import * as testing from './testing';

// Bad: The module name does not improve readability.
testing.describe('foo', () => {
  testing.it('bar', () => {
    testing.expect(null).toBeNull();
    testing.expect(undefined).toBeUndefined();
  });
});
```

**Good:**
```ts
// Better: give local names for these common functions.
import {describe, it, expect} from './testing';

describe('foo', () => {
  it('bar', () => {
    expect(null).toBeNull();
    expect(undefined).toBeUndefined();
  });
});
```

**Special case: Apps JSPB protos**

Apps JSPB protos must use named imports, even when it leads to long import lines. This rule exists to aid in build performance and dead code elimination.

```ts
// Good: import the exact set of symbols you need from the proto file.
import {Foo, Bar} from './foo.proto';

function copyFooBar(foo: Foo, bar: Bar) {...}
```

#### Renaming imports

Code *should* fix name collisions by using a namespace import or renaming the exports themselves. Code *may* rename imports (`import {SomeThing as SomeOtherThing}`) if needed.

Three examples where renaming can be helpful:
1.  If it's necessary to avoid collisions with other imported symbols.
2.  If the imported symbol name is generated.
3.  If importing symbols whose names are unclear by themselves, renaming can improve code clarity.

### Exports

Use named exports in all code:

```ts
// Use named exports:
export class Foo { ... }
```

Do not use default exports. This ensures that all imports follow a uniform pattern.

**Bad:**
```ts
// Do not use default exports:
export default class Foo { ... } // BAD!
```

> **Why?** Default exports provide no canonical name, which makes central maintenance difficult with relatively little benefit to code owners. Named exports have the benefit of erroring when import statements try to import something that hasn't been declared.

#### Export visibility

TypeScript does not support restricting the visibility for exported symbols. Only export symbols that are used outside of the module. Generally minimize the exported API surface of modules.

#### Mutable exports

Regardless of technical support, mutable exports can create hard to understand and debug code. One way to paraphrase this style point is that `export let` is not allowed.

**Bad:**
```ts
export let foo = 3;
// In pure ES6, foo is mutable and importers will observe the value change after a second.
// In TS, if foo is re-exported by a second file, importers will not see the value change.
window.setTimeout(() => {
  foo = 4;
}, 1000 /* ms */);
```

If one needs to support externally accessible and mutable bindings, they *should* instead use explicit getter functions.

**Good:**
```ts
let foo = 3;
window.setTimeout(() => {
  foo = 4;
}, 1000 /* ms */);
// Use an explicit getter to access the mutable export.
export function getFoo() { return foo; };
```

#### Container classes

Do not create container classes with static methods or properties for the sake of namespacing.

**Bad:**
```ts
export class Container {
  static FOO = 1;
  static bar() { return 1; }
}
```

Instead, export individual constants and functions:

**Good:**
```ts
export const FOO = 1;
export function bar() { return 1; }
```

### Import and export type

#### Import type

You may use `import type {...}` when you use the imported symbol only as a type. Use regular imports for values:

```ts
import type {Foo} from './foo';
import {Bar} from './foo';

import {type Foo, Bar} from './foo';
```

> **Why?** The TypeScript compiler automatically handles the distinction and does not insert runtime loads for type references. This distinction is useful for compiler modes (`isolatedModules`) and build tools.

#### Export type

Use `export type` when re-exporting a type, e.g.:

```ts
export type {AnInterface} from './foo';
```

### Use modules not namespaces

TypeScript supports two methods to organize code: *namespaces* and *modules*, but namespaces are disallowed. Your code *must* refer to code in other files using imports and exports.

Your code *must not* use the `namespace Foo { ... }` construct. `namespace`s *may* only be used when required to interface with external, third party code.

Code *must not* use `require` (as in `import x = require('...');`) for imports. Use ES6 module syntax.

**Bad:**
```ts
// Bad: do not use namespaces:
namespace Rocket {
  function launch() { ... }
}

// Bad: do not use <reference>
/// <reference path="..."/>

// Bad: do not use require()
import x = require('mydep');
```

## 4. Language features

### Local variable declarations

#### Use const and let

Always use `const` or `let` to declare variables. Use `const` by default, unless a variable needs to be reassigned. Never use `var`.

```ts
const foo = otherValue;  // Use if "foo" never changes.
let bar = someValue;     // Use if "bar" is ever assigned into later on.
```

**Bad:**
```ts
var foo = someValue;     // Don't use - var scoping is complex and causes bugs.
```

#### One variable per declaration

Every local variable declaration declares only one variable: declarations such as `let a = 1, b = 2;` are not used.

### Array literals

#### Do not use the `Array` constructor

*Do not* use the `Array()` constructor, with or without `new`. It has confusing and contradictory usage.

**Bad:**
```ts
const a = new Array(2); // [undefined, undefined]
const b = new Array(2, 3); // [2, 3];
```

**Good:**
```ts
const a = [2];
const b = [2, 3];

// Equivalent to Array(2):
const c = [];
c.length = 2;

// [0, 0, 0, 0, 0]
Array.from<number>({length: 5}).fill(0);
```

#### Do not define properties on arrays

Do not define or use non-numeric properties on an array (other than `length`). Use a `Map` (or `Object`) instead.

#### Using spread syntax

Using spread syntax `[...foo];` is a convenient shorthand for shallow-copying or concatenating iterables.

When using spread syntax, the value being spread *must* match what is being created. When creating an array, only spread iterables. Primitives (including `null` and `undefined`) *must not* be spread.

#### Array destructuring

Array literals may be used on the left-hand side of an assignment to perform destructuring.

```ts
const [a, b, c, ...rest] = generateResults();
let [, b,, d] = someArray;
```

Destructuring may also be used for function parameters. Always specify `[]` as the default value if a destructured array parameter is optional.

**Good:**
```ts
function destructured([a = 4, b = 2] = []) { … }
```

**Disallowed:**
```ts
function badDestructuring([a, b] = [4, 2]) { … }
```

### Object literals

#### Do not use the `Object` constructor

The `Object` constructor is disallowed. Use an object literal (`{}` or `{a: 0, b: 1, c: 2}`) instead.

#### Iterating objects

Iterating objects with `for (... in ...)` is error prone. It will include enumerable properties from the prototype chain. Either filter values explicitly with an `if` statement, or use `for (... of Object.keys(...))`.

**Bad:**
```ts
for (const x in someObj) {
  // x could come from some parent prototype!
}
```

**Good:**
```ts
for (const x in someObj) {
  if (!someObj.hasOwnProperty(x)) continue;
  // now x was definitely defined on someObj
}
for (const x of Object.keys(someObj)) { // note: for _of_!
  // now x was definitely defined on someObj
}
for (const [key, value] of Object.entries(someObj)) { // note: for _of_!
  // now key was definitely defined on someObj
}
```

#### Using spread syntax

Using spread syntax `[...foo]` is a convenient shorthand for creating a shallow copy of an object. When creating an object, only objects may be spread; arrays and primitives *must not* be spread.

#### Computed property names

Computed property names (e.g. `{['key' + foo()]: 42}`) are allowed.

#### Object destructuring

Object destructuring patterns may be used on the left-hand side of an assignment.

Destructured objects may also be used as function parameters, but should be kept as simple as possible: a single level of unquoted shorthand properties.

**Good:**
```ts
interface Options {
  num?: number;
  str?: string;
}

function destructured({num, str = 'default'}: Options = {}) {}
```

**Disallowed:**
```ts
function nestedTooDeeply({x: {num, str}}: {x: Options}) {}
function nontrivialDefault({num, str}: Options = {num: 42, str: 'default'}) {}
```

### Classes

#### Class declarations

Class declarations *must not* be terminated with semicolons.

**Good:**
```ts
class Foo {
}
```

**Bad:**
```ts
class Foo {
}; // Unnecessary semicolon
```

Statements that contain class expressions *must* be terminated with a semicolon.

#### Class method declarations

Class method declarations *must not* use a semicolon to separate individual method declarations. Method declarations should be separated from surrounding code by a single blank line.

**Good:**
```ts
class Foo {
  doThing() {
    console.log("A");
  }

  getOtherThing(): number {
    return 4;
  }
}
```

##### Overriding toString

The `toString` method may be overridden, but must always succeed and never have visible side effects.

#### Static methods

**Avoid private static methods:** Prefer module-local functions over private static methods.
**Do not rely on dynamic dispatch:** Code *should not* rely on dynamic dispatch of static methods.
**Avoid static `this` references:** Code *must not* use `this` in a static context.

#### Constructors

Constructor calls *must* use parentheses, even when no arguments are passed: `const x = new Foo();`.

It is unnecessary to provide an empty constructor or one that simply delegates into its parent class because ES2015 provides a default class constructor. However constructors with parameter properties, visibility modifiers or parameter decorators *should not* be omitted.

The constructor should be separated from surrounding code both above and below by a single blank line.

#### Class members

**No #private fields:** Do not use private fields (also known as private identifiers like `#ident`). Instead, use TypeScript's visibility annotations (`private ident`).
**Use readonly:** Mark properties that are never reassigned outside of the constructor with the `readonly` modifier.
**Parameter properties:** Use TypeScript parameter properties rather than plumbing an obvious initializer through to a class member.

**Good:**
```ts
class Foo {
  constructor(private readonly barService: BarService) {}
}
```

**Field initializers:** If a class member is not a parameter, initialize it where it's declared.

**Properties used outside of class lexical scope:** Properties used from outside the lexical scope (e.g. Angular templates) *must not* use `private` visibility. Use `protected` or `public`.

##### Getters and setters

Getters and setters *may* be used. The getter method *must* be a pure function.

##### Computed properties

Computed properties may only be used in classes when the property is a symbol.

#### Visibility

Restricting visibility helps with keeping code decoupled.
*   Limit symbol visibility as much as possible.
*   TypeScript symbols are public by default. Never use the `public` modifier except when declaring non-readonly public parameter properties.

#### Disallowed class patterns

**Class prototypes:** Do not manipulate `prototype`s directly.

### Functions

#### Prefer function declarations for named functions

Prefer function declarations over arrow functions or function expressions when defining named functions.

**Good:**
```ts
function foo() {
  return 42;
}
```

**Bad:**
```ts
const foo = () => 42;
```

#### Nested functions

Functions nested within other methods or functions *may* use function declarations or arrow functions. In method bodies, arrow functions are preferred because they have access to the outer `this`.

#### Do not use function expressions

Do not use function expressions. Use arrow functions instead.

#### Arrow function bodies

Use arrow functions with concise bodies (expressions) or block bodies as appropriate. Only use a concise body if the return value of the function is actually used.

**Good:**
```ts
// GOOD: return value is unused, use a block body.
myPromise.then(v => {
  console.log(v);
});
// GOOD: explicit `void` ensures no leaked return value
myPromise.then(v => void console.log(v));
```

#### Rebinding `this`

Function expressions and function declarations *must not* use `this` unless they specifically exist to rebind the `this` pointer. Prefer arrow functions.

#### Prefer passing arrow functions as callbacks

Callbacks can be invoked with unexpected arguments. Prefer passing an arrow-function that explicitly forwards parameters to the named callback.

```ts
// GOOD: Arguments are explicitly passed to the callback
const numbers = ['11', '5', '3'].map((n) => parseInt(n));
```

#### Arrow functions as properties

Classes usually *should not* contain properties initialized to arrow functions. Code *should* always use arrow functions to call instance methods.

#### Event handlers

Event handlers *may* use arrow functions when there is no need to uninstall the handler. If the handler requires uninstallation, arrow function properties are the right approach.

#### Parameter initializers

Optional function parameters *may* be given a default initializer. Initializers *must not* have any observable side effects.

#### Rest and spread

Use a *rest* parameter instead of accessing `arguments`. Use function spread syntax instead of `Function.prototype.apply`.

### this

Only use `this` in class constructors and methods, functions that have an explicit `this` type declared, or in arrow functions defined in a scope where `this` may be used. Never use `this` to refer to the global object.

### Primitive literals

#### String literals

**Use single quotes:** Ordinary string literals are delimited with single quotes (`'`), rather than double quotes (`"`).
**No line continuations:** Do not use line continuations (`\`) in string literals.
**Template literals:** Use template literals (delimited with `` ` ``) over complex string concatenation.

#### Number literals

Numbers may be specified in decimal, hex, octal, or binary. Use exactly `0x`, `0o`, and `0b` prefixes. Never include a leading zero unless it is immediately followed by `x`, `o`, or `b`.

#### Type coercion

TypeScript code *may* use the `String()` and `Boolean()` functions, string template literals, or `!!` to coerce types.

Values of enum types *must not* be converted to booleans with `Boolean()` or `!!`, and must instead be compared explicitly.

Code *must* use `Number()` to parse numeric values, and *must* check its return for `NaN` values explicitly. Code *must not* use unary plus (`+`) to coerce strings to numbers. Code *must not* use `parseInt` or `parseFloat` to parse numbers, except for non-base-10 strings.

### Control structures

#### Control flow statements and blocks

Control flow statements (`if`, `else`, `for`, `do`, `while`, etc) always use braced blocks, even if the body contains only a single statement.

**Exception:** `if` statements fitting on one line *may* elide the block.

**Assignment in control statements:** Prefer to avoid assignment of variables inside control statements.

#### Iterating containers

Prefer `for (... of someArr)` to iterate over arrays. Do not use `for (... in ...)` to iterate over arrays.

#### Grouping parentheses

Optional grouping parentheses are omitted only when the author and reviewer agree that there is no reasonable chance that the code will be misinterpreted without them.

#### Exception handling

**Instantiate errors using `new`:** Always use `new Error()` when instantiating exceptions.
**Only throw errors:** Only throw (subclasses of) `Error`. Do not throw strings or raw objects.
**Catching and rethrowing:** When catching errors, code *should* assume that all thrown errors are instances of `Error`.
**Empty catch blocks:** It is very rarely correct to do nothing in response to a caught exception. Add a comment if it is intentional.

#### Switch statements

All `switch` statements *must* contain a `default` statement group. Non-empty statement groups *must not* fall through.

#### Equality checks

Always use triple equals (`===`) and not equals (`!==`).

**Exception:** Comparisons to the literal `null` value *may* use the `==` and `!=` operators to cover both `null` and `undefined`.

#### Type and non-nullability assertions

Type assertions (`x as SomeType`) and non-nullability assertions (`y!`) are unsafe. You *should not* use them without an obvious or explicit reason.

**Syntax:** Type assertions *must* use the `as` syntax (as opposed to `<Foo>`).

### Decorators

Do not define new decorators. Only use the decorators defined by frameworks (Angular, Polymer).

When using decorators, the decorator *must* immediately precede the symbol it decorates, with no empty lines between.

### Disallowed features

*   **Wrapper objects:** TypeScript code *must not* instantiate the wrapper classes for the primitive types `String`, `Boolean`, and `Number`.
*   **Automatic Semicolon Insertion:** Explicitly end all statements using a semicolon.
*   **Const enums:** Code *must not* use `const enum`; use plain `enum` instead.
*   **Debugger statements:** *Must not* be included in production code.
*   **`with`:** Do not use the `with` keyword.
*   **Dynamic code evaluation:** Do not use `eval` or the `Function(...string)` constructor.
*   **Non-standard features:** Do not use non-standard ECMAScript or Web Platform features.
*   **Modifying builtin objects:** Never modify builtin types.

## 5. Naming

### Identifiers

Identifiers *must* use only ASCII letters, digits, underscores, and (rarely) the '$' sign.

**Descriptive names:** Names *must* be descriptive and clear. Do not use abbreviations that are ambiguous.
**Camel case:** Treat abbreviations like acronyms as whole words (e.g., `loadHttpUrl`, not `loadHTTPURL`).

### Rules by identifier type

| Style | Category |
| :--- | :--- |
| `UpperCamelCase` | class / interface / type / enum / decorator / type parameters / component functions in TSX |
| `lowerCamelCase` | variable / parameter / function / method / property / module alias |
| `CONSTANT_CASE` | global constant values, including enum values |
| `#ident` | private identifiers are never used |

**Type parameters:** Like in `Array<T>`, *may* use a single upper case character (`T`) or `UpperCamelCase`.
**Private properties:** Do not use trailing or leading underscores for private properties.
**Constants:** `CONSTANT_CASE` indicates that a value is *intended* to not be changed.
**Imports:** Module namespace imports are `lowerCamelCase` (e.g. `import * as fooBar`).

## 6. Type system

### Type inference

Code *may* rely on type inference. Leave out type annotations for trivially inferred types. Explicitly specifying types may be required to prevent generic type parameters from being inferred as `unknown`.

### Undefined and null

TypeScript supports `undefined` and `null` types. TypeScript code can use either.

**Nullable/undefined type aliases:** Type aliases *must not* include `|null` or `|undefined` in a union type. Code *must* only add them when the alias is actually used.

**Prefer optional over `|undefined`:** Use optional fields (`?`) rather than a `|undefined` type.

### Use structural types

Use interfaces to define structural types, not classes.

### Prefer interfaces over type literal aliases

When declaring types for objects, use interfaces instead of a type alias (`type Foo = {...}`) for the object literal expression.

### `Array<T>` Type

For simple types, use the syntax sugar `T[]`. For anything more complex, use the longer form `Array<T>`.

### Indexable types

In TypeScript, provide a meaningful label for the key in index signatures (e.g. `{[userName: string]: number}`).

### Mapped and conditional types

Always use the simplest type construct that can possibly express your code. Mapped & conditional types may be used, but avoid complexity.

### `any` Type

**Consider *not* to use `any`.** In circumstances where you want to use `any`, consider:
*   Providing a more specific type (interfaces, inline types).
*   Using `unknown`.
*   Suppressing the lint warning and documenting why.

### `unknown` over `any`

Use `unknown` when a type is truly unknown. Narrow the type using a type guard to use it safely.

### `{}​` Type

Google3 code **should not** use `{}` for most use cases. Use `unknown`, `Record<string, T>`, or `object` instead.

### Tuple types

Use tuple types `[string, string]` instead of creating specific "Pair" interfaces if appropriate.

### Wrapper types

Never use `String`, `Boolean`, `Number`, or `Object` types. Use `string`, `boolean`, `number`, `{}`, or `object`.

## 7. Toolchain requirements

### TypeScript compiler

All TypeScript files must pass type checking using the standard tool chain.

**`@ts-ignore`:** Do not use `@ts-ignore`, `@ts-expect-error`, or `@ts-nocheck`. You *may* use `@ts-expect-error` in unit tests, though generally *should not*.

## 8. Comments and documentation

### JSDoc versus comments

*   Use `/** JSDoc */` comments for documentation (users of the code).
*   Use `// line comments` for implementation comments.

### JSDoc general form

```ts
/**
 * Multiple lines of JSDoc text are written here,
 * wrapped normally.
 * @param arg A number to do something to.
 */
function doSomething(arg: number) { … }
```

### JSDoc tags

Most tags must occupy their own line.

### Document all top-level exports of modules

Use `/** JSDoc */` comments to communicate information to the users of your code.

### Class comments

JSDoc comments for classes should provide the reader with enough information to know how and when to use the class.

### Parameter property comments

To document parameter properties (e.g. `constructor(private readonly foo: Foo)`), use JSDoc's `@param` annotation on the constructor.

### JSDoc type annotations

JSDoc type annotations are redundant in TypeScript. Do not declare types in `@param` or `@return` blocks.

## 9. Policies

### Consistency

For any style question that isn't settled definitively by this specification, do what the other code in the same file is already doing ("be consistent").

### Deprecation

Mark deprecated methods, classes or interfaces with an `@deprecated` JSDoc annotation.