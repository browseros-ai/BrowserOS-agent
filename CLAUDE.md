# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules
#  ALWAYS FOLLOW THESE RULES.
- DO NOT automatically create or update, README.md file for changes.
- DO NOT automatically generate example file to use the code unless asked.
- DO NOT automatically generate tests for the code unless asked.
- IMPORTANT: When asked a question or given a task, ALWAYS first generate a rough plan with pseudo code or design. DO NOT make changes without asking for approval first.
- IMPORTANT: Never use optional defaults like `|| "default-value"` in code. Always define constants at the top of the file for any default values (e.g., `const DEFAULT_MODEL = "gpt-4o-mini"`)

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.

# Code Style & Formatting
- Use English for all code and documentation.
- Write concise, technical TypeScript. Follow Standard.js rules.
- Always declare the type of each variable and function (parameters and return value).
- Avoid using any.
- Create necessary types.
- Keep interfaces in the same file as their components rather than in a separate types directory.
- Use JSDoc to document public classes and methods.
- For interfaces, class properties, and smaller logic use inline comments, give two spaces and "// <comment>".
- DO NOT use JSDoc-style comments (`/** ... */`) for class properties or schema definitions, use inline comments instead.
- IMPORTANT: Follow this commenting style for clean, readable code:
  - Keep related code blocks compact and grouped together
  - Add brief comments only at the top of logical sections (e.g., "// Get the tool", "// Execute tool and handle result")
  - Avoid obvious comments - let the code be self-documenting
  - Comment spacing: Add comments to separate logical blocks within longer methods (5-10 lines per block)
  - Only comment where intent isn't immediately clear from the code
  - Examples of good comments:
    - Section separators: "// Check for task completion"
    - Non-obvious logic: "// Re-plan if execution failed"
    - TODO items or warnings about gotchas
  - Examples of bad comments to avoid:
    - "// Log tool call" (obvious from code)
    - "// Set result" (self-evident)
    - "// Call function" (redundant)
- Favor loops and small helper modules over duplicate code.
- Use descriptive names with auxiliary verbs (e.g. isLoading, hasError).
- File layout: exported component → subcomponents → hooks/helpers → static content.
- IMPORTANT: All imports must use path aliases like "@/lib" instead of relative paths like "./" or "../"
- IMPORTANT: Private methods must be prefixed with underscore (e.g., `_privateMethod()`)

# Naming Conventions
- Use PascalCase for classes.
- Use camelCase for variables, functions, and methods.
- Directories: Use kebab-case (e.g. components/auth-wizard).
- Files: 
  - Use PascalCase ONLY for files that export a class with the same name (e.g. BrowserContext.ts exports class BrowserContext)
  - Use lowercase for all other files: utilities, functions, interfaces, types, enums (e.g. profiler.ts, types.ts, tool.interface.ts)
  - Components (.tsx files) always use PascalCase (e.g. UserProfile.tsx)
- Use UPPERCASE for environment variables.
- Avoid magic numbers and define constants.
- File extensions:
  - Components → .tsx
  - Hooks/Utils → .ts
  - Styles → .css (using Tailwind CSS)
- Prefer named exports for components
- Types/Interfaces in PascalCase (e.g. User, ButtonProps)
- OUR PRODUCT NAME IS BrowserOS -- so use that name correctly when naming things.

# Functions & Logic
- Keep functions short and single-purpose (<20 lines).
- Avoid deeply nested blocks by:
  - Using early returns.
  - Extracting logic into utility functions.
- Use higher-order functions (map, filter, reduce) to simplify logic.
- Use arrow functions for simple cases (<3 instructions), named functions otherwise.
- Use default parameter values instead of null/undefined checks.
- Use RO-RO (Receive Object, Return Object) for passing and returning multiple parameters.
- IMPORTANT: Order methods using "Operation-based grouping" (hybrid approach):
  ```typescript
  class Example {
    // 1. Constructor/Initialization
    constructor() {}
    init() {}
    
    // 2. Public getter methods
    getData() {}
    getStatus() {}
    
    // 3. Public creator/builder methods
    createItem() {}
    buildConfig() {}
    
    // 4. Public action/command methods
    save() {}
    delete() {}
    refresh() {}
    
    // 5. Public predicate methods
    isReady() {}
    hasData() {}
    
    // 6. Private helper methods (with _ prefix)
    private _validateData() {}
    private _formatOutput() {}
  }
  ```

# Data Handling
- Avoid excessive use of primitive types; encapsulate data in composite types.
- Avoid placing validation inside functions—use classes with internal validation instead.
- Prefer immutability for data:
  - Use readonly for immutable properties.
  - Use as const for literals that never change.

# TypeScript & Zod
- ALWAYS define data structures using Zod schemas instead of interfaces or types.
- NEVER use plain TypeScript interfaces; always convert them to Zod schemas.
- ALWAYS use inline comments with two spaces followed by `// <comment>` next to each key in Zod schemas, NOT JSDoc-style comments (`/** ... */`).
- Use the following pattern for all data structures:
  ```ts
  // First, import Zod
  import { z } from "zod";

  // Define your schema using Zod
  export const UserSchema = z.object({
    id: z.string().uuid(),  // Unique identifier for the user
    name: z.string().min(2),  // User's full name
    email: z.string().email(),  // User's email address
    age: z.number().int().positive().optional(),  // User's age in years
    role: z.enum(["admin", "user", "editor"]),  // User's permission role
    metadata: z.record(z.string(), z.unknown()).optional(),  // Additional user metadata
    createdAt: z.date()  // When the user was created
  })

  // For enums, place comments on the same line as enum values
  export const StatusSchema = z.enum([
    'PENDING',  // Awaiting processing
    'ACTIVE',   // Currently active
    'INACTIVE', // No longer active
    'DELETED'   // Marked for deletion
  ])

  // Infer the TypeScript type from the Zod schema
  export type User = z.infer<typeof UserSchema>;
  ```
- Naming conventions for Zod schemas:
  - Schema variables: PascalCase with "Schema" suffix (e.g., `UserSchema`, `ConfigSchema`)
  - Inferred types: PascalCase without suffix (e.g., `type User = z.infer<typeof UserSchema>`)
- Use appropriate Zod validators to ensure runtime safety:
  - String validation: `.min()`, `.max()`, `.email()`, `.url()`, etc.
  - Number validation: `.int()`, `.positive()`, `.min()`, `.max()`, etc.
  - Object validation: `.strict()` when appropriate
- For optional properties, use `.optional()` instead of the TypeScript `?` syntax
- For nullable values, use `.nullable()` instead of TypeScript union with `null`
- For recursive types, provide a type hint:
  ```ts
  const baseCategorySchema = z.object({
    name: z.string(),
  });

  type Category = z.infer<typeof baseCategorySchema> & {
    subcategories: Category[];
  };

  const categorySchema: z.ZodType<Category> = baseCategorySchema.extend({
    subcategories: z.lazy(() => categorySchema.array()),
  });
  ```
- For discriminated unions, use `z.discriminatedUnion()` with the discriminator field
- For enums, use `z.enum()` or `z.nativeEnum()` for TypeScript enums

# Standard.js Rules
- 2‑space indentation
- Single quotes (except to avoid escaping)
- No semicolons (unless disambiguation requires)
- No unused variables
- Space after keywords (if (… ))
- Space before function's (
- Always use === / !==
- Operators spaced (a + b)
- Commas followed by space
- else on same line as closing }
- Multi‑line if blocks always use { }
- Always handle error callback parameters
- camelCase for variables/functions; PascalCase for components and interfaces

# Error Handling & Validation
- Validate inputs and preconditions early (guard clauses).
- Place happy-path logic last.
- Provide clear, user‑friendly error messages.
- Log or report unexpected errors.

# React + TypeScript Best Practices
- Define props with Zod schemas, not interfaces:
  ```ts
  // Define the props schema with Zod
  const ButtonPropsSchema = z.object({
    label: z.string(),
    onClick: z.function().args().returns(z.void()).optional(),
    variant: z.enum(['primary', 'secondary', 'ghost']).optional()
  });

  // Infer the type from the schema
  type ButtonProps = z.infer<typeof ButtonPropsSchema>;

  export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
    return (
      <button 
        onClick={onClick}
        className={cn(
          "px-4 py-2 rounded-md font-medium transition-colors",
          variant === 'primary' && "bg-primary text-primary-foreground hover:bg-primary/90",
          variant === 'secondary' && "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          variant === 'ghost' && "hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {label}
      </button>
    )
  }
  ```
- Call hooks (useState, useEffect, etc.) only at the top level.
- Extract reusable logic into custom hooks (useAuth, useFormValidation).
- Memoize with React.memo, useCallback, useMemo where appropriate.
- Avoid inline functions in JSX—pull handlers out or wrap in useCallback.
- Favor composition (render props, children) over inheritance.
- Use React.lazy + Suspense for code splitting.
- Use refs only for direct DOM access.
- Prefer controlled components for forms.
- Implement an error boundary component.
- Clean up effects in useEffect to prevent leaks.
- Use guard clauses (early returns) for error handling.

# UI & Styling (Tailwind CSS)
- Use Tailwind CSS utility classes directly in components
- Single `styles.css` file per UI module (sidepanel, newtab)
- Define CSS custom properties (variables) for theming:
  - Theme variables in `:root`, `.dark`, and custom theme classes
  - Use semantic variable names (--background, --foreground, --primary, etc.)
- Apply Tailwind classes directly in JSX className props:
  ```tsx
  <div className="flex flex-col h-full bg-background-alt">
  ```
- Use `cn()` utility function (clsx/tailwind-merge) for conditional classes:
  ```tsx
  import { cn } from '@/lib/utils'
  
  <div className={cn(
    "base-classes",
    isActive && "active-classes",
    variant === 'primary' && "primary-variant-classes"
  )}>
  ```
- Use Tailwind's @layer directives for base styles
- Support multiple themes (light, dark, custom) via CSS variables
- Avoid inline styles; use Tailwind utilities instead
- For custom styles, use CSS custom properties with Tailwind's arbitrary value support:
  ```tsx
  <div className="text-[var(--custom-color)]">
  ```
- Common spacing patterns: Use consistent spacing utilities (p-4, gap-2, space-y-4)
- Responsive design: Use Tailwind's responsive prefixes (sm:, md:, lg:)
- Animation: Use Tailwind's animation utilities or define custom animations in CSS

# State Management
- Global state: Zustand
- Lift state up before introducing context.
- Use React Context for intermediate, tree‑wide sharing.

# Forms & Validation
- Use controlled inputs.
- For simple forms, write custom hooks; for complex ones, use react-hook-form with generics (e.g. <Controller>).
- Separate client‑side and server‑side validation.
- Use Zod schemas for form validation.
- Style form elements with Tailwind utilities:
  ```tsx
  <input className="w-full px-3 py-2 border rounded-md bg-background text-foreground" />
  ```

# Performance Optimization
- Minimize client‑only code (useEffect/useState) where unnecessary.
- Dynamically import non‑critical components.
- Optimize images (WebP, width/height, lazy-loading).
- Memoize expensive computations with useMemo.
- Wrap pure components in React.memo.
- Structure modules for effective tree‑shaking.
- Use Tailwind's JIT (Just-In-Time) mode for minimal CSS bundle size.
- Prefer Tailwind utilities over custom CSS to leverage PurgeCSS optimization.

# TypeScript Configuration
- Enable "strict": true in tsconfig.json.
- Explicitly type function returns and object literals.
- Enforce noImplicitAny, strictNullChecks, strictFunctionTypes.
- Minimize use of @ts-ignore/@ts-expect-error.

# Accessibility (a11y)
- Use semantic HTML.
- Apply appropriate ARIA attributes.
- Ensure full keyboard navigation.
- Use Tailwind's accessibility utilities (sr-only, focus-visible, etc.).
- Ensure sufficient color contrast with theme variables.
- Test with screen readers and keyboard-only navigation.

## Development Commands

### Build Commands
- `npm run build` - Production build with webpack
- `npm run build:dev` - Development build with source maps
- `npm run build:watch` - Development build with file watching
- `npm run clean` - Remove dist directory

### Linting Commands
- `npm run lint` - Check code with eslint
- `npm run lint:fix` - Fix eslint issues automatically

### Testing Commands
- `npm run test` - Run all tests with Vitest in watch mode
- `npm run test:run` - Run all tests once and exit
- `npm run test:watch` - Run tests in watch mode for development
- `npm run test:coverage` - Generate code coverage report
- `npm run test:ui` - Open Vitest UI for interactive testing
- To run a single test file: `npm test -- path/to/file.test.ts`
- For integration tests with API key: `LITELLM_API_KEY=your-key npm test -- file.integration.test.ts`

### Testing Framework
- **ALWAYS use Vitest** for all tests, never Jest or other frameworks
- Import from `vitest` not `@jest/globals`
- Use `describe`, `it`, `expect`, `vi` from vitest
- Mock with `vi.spyOn()` and `vi.fn()`, not jest methods

## Environment Setup

### Required Environment Variables
- `LITELLM_API_KEY` - Required for LLM provider access (set in webpack.config.js)
- Create a `.env` file in the project root with your API keys

### VS Code Debugging
Launch configurations are available in `.vscode/launch.json`:
- **Extension + Dev Server**: Debug the extension with webpack dev server
- **Extension Only**: Debug the extension without dev server
- **Dev Server Only**: Run webpack dev server separately

To debug:
1. Run `npm run build:dev` or `npm run build:watch`
2. Use VS Code's Run and Debug panel (Cmd/Ctrl+Shift+D)
3. Select appropriate launch configuration
4. Chrome will open with the extension loaded in debug mode

## Architecture Overview

### Core Framework
This is a Chrome extension that provides AI-powered web automation using LLM agents. The architecture is built around:

1. **NxtScape Core** (`src/lib/core/NxtScape.ts`) - Main orchestration layer that manages execution context and delegates to BrowserAgent
2. **BrowserAgent** (`src/lib/agent/BrowserAgent.ts`) - Unified agent that handles all task execution through planning and tool invocation
3. **Browser Context** - Puppeteer-core integration for Chrome extension tab control
4. **Tool System** - Modular browser automation tools registered with ToolManager
5. **Execution Context** - Runtime state management including message history, browser context, and abort handling

### Key Components

#### Browser Integration
- **BrowserContext** (`src/lib/browser/BrowserContext.ts`) - Manages Chrome tab connections via puppeteer-core with multi-tab support and debugger handling
- **BrowserPage** (`src/lib/browser/BrowserPage.ts`) - Extended wrapper for puppeteer Page with enhanced DOM handling and automation capabilities
- Uses Chrome Extension APIs for tab management and debugger attachment

#### Agent Architecture
- **BrowserAgent** (`src/lib/agent/BrowserAgent.ts`) - The single unified agent that handles all tasks
  - Uses ClassificationTool to determine task complexity (simple vs complex)
  - Uses PlannerTool to create multi-step plans for complex tasks
  - Executes tools via LangChain LLM with tool binding
  - Manages conversation history via MessageManager
  - Supports iterative re-planning when execution fails
- Uses LangChain for LLM integration (Claude/OpenAI/Ollama support)

#### Tool System
- **ToolManager** (`src/lib/tools/ToolManager.ts`) - Centralized tool management and registration
- Tools are implemented as LangChain DynamicStructuredTool instances
- **Core Tools**:
  - **ClassificationTool** - Classifies tasks as simple/complex
  - **PlannerTool** - Creates multi-step execution plans
  - **NavigationTool** - Handles web navigation
  - **TabOperationsTool** - Manages browser tabs
  - **DoneTool** - Marks task completion
- Additional tools can be registered based on task requirements

### UI Components
- **IMPORTANT: Use ONLY these directories for UI work:**
  - `src/sidepanel/` - Side panel UI (primary interface)
  - `src/newtab/` - New tab page UI
- **DO NOT use SCSS modules or `.module.scss` files** - Use Tailwind CSS instead

#### Side Panel (`src/sidepanel/`)
- Modern Chrome side panel with React + Tailwind CSS
- Components: Chat, MessageList, Header, SettingsModal, TabSelector, TeachMode, etc.
- Hooks: useMessageHandler, useKeyboardShortcuts, useAutoScroll, etc.
- Store: Zustand-based state management (chatStore, settingsStore)
- Real-time streaming display for agent execution
- Tailwind utility classes for all styling

#### New Tab (`src/newtab/`)
- Custom new tab page with React + Tailwind CSS
- Components: AgentCard, CommandPalette, ThemeToggle, etc.
- Stores: agentsStore, providerStore (Zustand)
- Pages: CreateAgentPage for agent configuration
- Consistent styling approach with sidepanel

### UI Component Patterns
- **Component Structure**: 
  - Keep components focused and single-purpose
  - Use function components with TypeScript
  - Export named functions (not default exports)
- **Shared UI Components** (`components/ui/`):
  - Reusable primitives (Icons, Buttons, Spinners)
  - Consistent with Tailwind design system
  - Minimal props, maximum flexibility
- **Feature Components**:
  - Domain-specific components (Chat, Settings, TabSelector)
  - Compose from UI primitives
  - Handle business logic and state
- **Styling Patterns**:
  - Never use CSS modules or SCSS
  - Apply Tailwind utilities directly
  - Use theme variables for colors (bg-background, text-foreground)
  - Group related utilities logically in className
- **Accessibility**:
  - Always include ARIA labels for interactive elements
  - Use semantic HTML elements
  - Ensure keyboard navigation works
  - Add focus-visible styles for keyboard users

### LLM Integration
- **LangChainProviderFactory** (`src/lib/llm/LangChainProviderFactory.ts`) - Abstraction over multiple LLM providers
- **Provider Strategies**: AnthropicStrategy, OpenAIStrategy, OllamaStrategy, BrowserOS Strategy
- **LLM Settings**: LLMSettingsReader for configuration management
- **Supported Providers**: Claude (Anthropic), OpenAI, Ollama
- **LangChain Integration** - Uses @langchain packages for agent execution
- **Streaming Support** - Real-time response streaming with StreamProcessor

## Development Guidelines

### Agent Development
- BrowserAgent is the single unified agent handling all tasks
- To extend functionality, add new tools rather than new agents
- BrowserAgent handles classification, planning, and execution internally
- Uses MessageManager for conversation history
- Supports iterative re-planning on failures

### Tool Development
- Create tools using LangChain's DynamicStructuredTool
- Define Zod schema for tool input parameters
- Implement tool function that returns JSON string results
- Use factory functions (e.g., `createPlannerTool`) for tool creation
- Register tools with ToolManager in BrowserAgent
- Return results in format: `{ ok: boolean, output?: any, error?: string }`

### Browser Context Usage
- Always use BrowserContext for tab operations
- Handle debugger conflicts and tab cleanup properly
- Use anti-detection scripts for automation
- Implement proper error handling for tab attachment failures
- Support multi-tab operations and user-selected tab contexts

### Performance Monitoring
The codebase includes built-in performance monitoring utilities for debugging and optimization:

#### PerformanceProfiler (`src/lib/utils/PerformanceProfiler.ts`)
- Comprehensive profiling with color-coded console output (🟢 <500ms, 🟡 500-1000ms, 🔴 >1000ms)
- Chrome DevTools integration with Performance API marks/measures
- Chrome tracing support viewable at `chrome://tracing`
- Multiple usage patterns: manual start/end, async wrapper, method decorator
- Automatically disabled in production

```typescript
// Manual profiling
PerformanceProfiler.start('operation');
// ... code to profile
PerformanceProfiler.end('operation');

// Async function profiling
await PerformanceProfiler.profile('fetch-data', async () => {
  return await fetchData();
});

// Method decorator
@PerformanceProfiler.profileMethod()
async processData() { }
```

#### TraceDecorator (`src/lib/utils/TraceDecorator.ts`)
- Lightweight method-level tracing with `@trace` decorator
- Exports Perfetto-compatible traces for visualization
- Already integrated in BrowserAgent for automatic performance tracking
- Access trace data via `window.__traceCollector.getTraces()`

```typescript
class MyAgent {
  @trace
  async executeAgent() {
    // Method execution is automatically traced
  }
}
```

### Testing Guidelines
- Place test files next to source files with `.test.ts` or `.spec.ts` extension
- Use Vitest with TypeScript support and happy-dom environment
- Mock Chrome Extension APIs as needed for unit tests
- Follow AAA pattern: Arrange, Act, Assert
- Use descriptive test names that explain the expected behavior
- Test descriptions in `it()` blocks MUST start with "tests ..." (e.g., `it('tests that the tool handles errors gracefully')`)
- Group related tests using `describe` blocks
- Test file structure mirrors source file structure

## Unit Testing Guidelines

### What Makes a Good Unit Test

**Good unit tests should test actual behavior, not mock implementations.** Focus on testing what your code does, not how it does it.

### Core Principles

1. **Test the Contract, Not the Implementation**
   - Test what the code promises to do, not internal details
   - Don't test that mocks return what you told them to return

2. **Test Edge Cases and Error Handling**
   - Focus on what could go wrong and how your code handles it
   - Test error scenarios, invalid inputs, and boundary conditions

3. **Test Public API and Integration Points**
   - Test factory functions, constructors, and public methods
   - Verify that components can be created and configured properly

4. **Keep It Simple - 3-4 Tests Maximum**
   - Creation/Setup Test: Can the component be created?
   - Happy Path Test: Does the main functionality work?
   - Error Handling Test: Does it handle errors gracefully?
   - Edge Case Test (optional): Does it handle boundary conditions?

### What's OK in Unit Tests

- **Access private fields and methods** - It's fine to access private methods or variables from the original implementation for verification
- **Use simple mocks** - Mock external dependencies but test your code's reaction to them
- **Test one thing at a time** - Each test should verify a single behavior

### What to Avoid

- **Don't test mocks** - If you're only verifying mock behavior, delete the test
  - ❌ Bad: Mocking LLM to return 2 steps, then testing that you got 2 steps
  - ❌ Bad: Testing that your mock was called with certain parameters
  - ✅ Good: Testing how your code handles when the LLM throws an error
- **Don't test implementation details** - Test outcomes, not the steps taken
- **Don't test external dependencies** - Test your code's handling of them instead
- **Don't write tests just for coverage** - Quality over quantity

### Example Test Structure

```typescript
describe('MyTool', () => {
  it('tests that the tool can be created with required dependencies', () => {
    const tool = new MyTool(dependencies)
    expect(tool).toBeDefined()
  })

  it('tests that the tool handles errors gracefully', async () => {
    mockDependency.method.mockRejectedValue(new Error('Failed'))
    const result = await tool.execute(input)
    expect(result.ok).toBe(false)
    expect(result.output).toContain('Failed')
  })
})
```

## Integration Testing

### Core Principles

- Start with one test, one flow if it is a new test - Don't test multiple scenarios, just verify the most generic flow works
- Super simple - The simpler the test, the better. Avoid complex setups or assertions
- High-level verification only - Check that major things happened (system prompt added, task added, tool called), not how they happened

### What's OK in Integration Tests

- Access private fields and functions- Using private fields and functions is fine for verification
- Use timeouts - Give async operations time to complete rather than complex promise handling
- Abort early - Don't wait for full completion; verify the process started correctly then abort
- Let some things fail - Chrome API warnings in test environment are expected and OK

### What to Avoid

- Mocking/spying - Use real dependencies and real LLM calls
- Implementation details - Don't check specific message content or exact tool arguments
- Multiple assertions - Keep it to 3-4 key checks maximum

### Pattern
```typescript
// Setup with real instances
// Start execution (don't await)
// Wait a bit
// Check 2-3 key things happened
// Cleanup and exit
```

### Execution Flow

```
User Query → BrowserOS.run() → BrowserAgent.execute()
                                        ↓
                              ClassificationTool
                                   ↙        ↘
                            Simple Task   Complex Task
                                ↓              ↓
                          Direct Tool     PlannerTool
                           Execution      (3 steps)
                                ↓              ↓
                              Tool         Execute Each
                             Result      Step with Tools
                                ↓              ↓
                            DoneTool    Check & Re-plan
                                           if needed
```

1. **NxtScape.run()** - Main entry point that initializes execution context and calls BrowserAgent
2. **BrowserAgent.execute()** - The unified agent that handles all tasks through a planning and execution loop
3. **ClassificationTool** - Determines if task is simple (direct execution) or complex (needs planning)
4. **PlannerTool** - Creates multi-step plans for complex tasks (typically 3 steps at a time)
5. **Tool Execution** - BrowserAgent executes tools via LLM with tool binding, processing results iteratively
6. **Message Manager** - Maintains conversation history throughout execution
7. **Event Bus** - Streams real-time updates to the UI during execution

### Chrome Extension Structure
- **Background Script** (`src/background/`) - Service worker handling extension lifecycle
- **Content Scripts** (`src/content/`) - Injected scripts for DOM manipulation
- **Side Panel** - Primary UI using Chrome's side panel API
- **Port Messaging** - Communication between extension contexts

### Multi-Tab Support
- BrowserContext manages multiple tab attachments via puppeteer-core
- User can select multiple tabs for collective processing
- Tab selection context automatically included in agent instructions
- Proper cleanup and debugger handling for tab lifecycle management

## Key Files Reference

- `src/lib/core/NxtScape.ts` - Main orchestration class
- `src/lib/agent/BrowserAgent.ts` - Unified agent handling all task execution
- `src/lib/browser/BrowserContext.ts` - Multi-tab browser management with puppeteer-core
- `src/lib/tools/ToolManager.ts` - Tool registration and management system
- `src/lib/tools/classification/ClassificationTool.ts` - Task classification logic
- `src/lib/tools/planning/PlannerTool.ts` - Multi-step plan generation
- `src/lib/llm/LangChainProviderFactory.ts` - LLM provider abstraction
- `src/lib/runtime/ExecutionContext.ts` - Runtime state and context management
- `src/lib/runtime/MessageManager.ts` - Conversation history management
- `manifest.json` - Chrome extension configuration
- `webpack.config.js` - Build configuration
