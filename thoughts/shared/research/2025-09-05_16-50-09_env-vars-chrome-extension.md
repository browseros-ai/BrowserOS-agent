---
date: 2025-09-05T16:50:09-07:00
researcher: Claude
git_commit: 98d55e952578932b98f1b36bfe4e29728acaa1fa
branch: dev/evals2
repository: BrowserOS-agent
topic: "Environment Variables Handling in Chrome Extension"
tags: [research, codebase, webpack, environment-variables, chrome-extension, process-env]
status: complete
last_updated: 2025-09-05
last_updated_by: Claude
---

# Research: Environment Variables Handling in Chrome Extension

**Date**: 2025-09-05T16:50:09-07:00
**Researcher**: Claude
**Git Commit**: 98d55e952578932b98f1b36bfe4e29728acaa1fa
**Branch**: dev/evals2
**Repository**: BrowserOS-agent

## Research Question
How are environment variables handled in this Chrome extension codebase, and what's causing the "process is not defined" error with GOOGLE_GENAI_API_KEY and GEMINI_API_KEY?

## Summary
The codebase uses webpack's DefinePlugin to inject environment variables at build time by replacing `process.env.VARIABLE_NAME` with actual string values. The recent "process is not defined" error occurs because `GOOGLE_GENAI_API_KEY` and `GEMINI_API_KEY` are used in `src/config.ts` but are **NOT defined in webpack.config.js's DefinePlugin configuration**. This causes webpack to leave `process.env.GOOGLE_GENAI_API_KEY` as-is in the bundle, which fails at runtime since Chrome extensions don't have a `process` object.

## Detailed Findings

### Webpack DefinePlugin Pattern

The codebase follows a specific pattern for handling environment variables in webpack.config.js:

1. **Environment variables are loaded from .env file** ([webpack.config.js:13-15](webpack.config.js#L13-L15)):
   ```javascript
   const env = dotenv.config()
   envKeys = env.parsed || {}
   ```

2. **Variables are explicitly defined in processEnv object** ([webpack.config.js:23-36](webpack.config.js#L23-L36)):
   ```javascript
   const processEnv = {
     'process.env.POSTHOG_API_KEY': JSON.stringify(envKeys.POSTHOG_API_KEY || ''),
     'process.env.KLAVIS_API_KEY': JSON.stringify(envKeys.KLAVIS_API_KEY || ''),
     'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
     // ... other variables
   }
   ```

3. **DefinePlugin replaces process.env references at build time** ([webpack.config.js:164](webpack.config.js#L164)):
   ```javascript
   new webpack.DefinePlugin(processEnv)
   ```

### Current Working Examples

Several environment variables are successfully used throughout the codebase:

1. **POSTHOG_API_KEY** - Defined in webpack, used in [src/lib/utils/Logging.ts:42](src/lib/utils/Logging.ts#L42)
2. **KLAVIS_API_KEY** - Defined in webpack, used in [src/lib/mcp/KlavisAPIManager.ts:18](src/lib/mcp/KlavisAPIManager.ts#L18)
3. **ENABLE_TELEMETRY** - Defined in webpack, used in [src/config.ts:72](src/config.ts#L72)
4. **BRAINTRUST_API_KEY** - Defined in webpack, used in [src/config.ts:74](src/config.ts#L74)

### The Problem with GOOGLE_GENAI_API_KEY and GEMINI_API_KEY

In [src/config.ts:79-80](src/config.ts#L79-80), these variables are used:
```typescript
export const GOOGLE_GENAI_API_KEY = process.env.GOOGLE_GENAI_API_KEY || '';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
```

However, **these variables are NOT defined in webpack.config.js's processEnv object**. This means:
1. Webpack doesn't replace `process.env.GOOGLE_GENAI_API_KEY` with a string value
2. The code `process.env.GOOGLE_GENAI_API_KEY` remains in the bundle
3. At runtime in the Chrome extension, `process` is undefined, causing the error

### How Chrome Extensions Handle JavaScript

Chrome extensions run in a browser environment where:
- There is no Node.js `process` global object
- Environment variables don't exist at runtime
- All configuration must be injected at build time or stored in extension storage

## Code References
- `webpack.config.js:23-36` - processEnv object definition where env vars are configured
- `webpack.config.js:164` - DefinePlugin usage
- `src/config.ts:79-80` - GOOGLE_GENAI_API_KEY and GEMINI_API_KEY usage (problematic)
- `src/config.ts:72-76` - Working examples of env var usage
- `src/evals2/SimplifiedScorer.ts:30` - Where these API keys are consumed
- `.env.example:1-16` - Documentation of expected env vars (missing Google/Gemini keys)

## Architecture Insights

1. **Build-time Replacement**: The codebase uses webpack's DefinePlugin to perform build-time string replacement, not runtime environment variable access.

2. **Explicit Declaration Required**: Every environment variable used in the codebase MUST be explicitly declared in webpack.config.js's processEnv object.

3. **String Serialization**: Values must be JSON.stringify'd to ensure they're properly formatted as string literals in the final bundle.

4. **No Dynamic Access**: You cannot dynamically access environment variables at runtime in a Chrome extension - all must be known at build time.

## The Correct Fix

To fix the "process is not defined" error, add the missing environment variables to webpack.config.js:

```javascript
const processEnv = {
  'process.env.POSTHOG_API_KEY': JSON.stringify(envKeys.POSTHOG_API_KEY || ''),
  'process.env.KLAVIS_API_KEY': JSON.stringify(envKeys.KLAVIS_API_KEY || ''),
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  // Braintrust Telemetry Configuration
  'process.env.ENABLE_TELEMETRY': JSON.stringify(envKeys.ENABLE_TELEMETRY || 'false'),
  'process.env.ENABLE_EVALS2': JSON.stringify(envKeys.ENABLE_EVALS2 || 'false'),
  'process.env.BRAINTRUST_API_KEY': JSON.stringify(envKeys.BRAINTRUST_API_KEY || ''),
  'process.env.BRAINTRUST_PROJECT_UUID': JSON.stringify(envKeys.BRAINTRUST_PROJECT_UUID || ''),
  'process.env.BRAINTRUST_PROJECT_NAME': JSON.stringify(envKeys.BRAINTRUST_PROJECT_NAME || 'browseros-agent-online'),
  // OpenAI Configuration for Scoring
  'process.env.OPENAI_API_KEY_FOR_SCORING': JSON.stringify(envKeys.OPENAI_API_KEY_FOR_SCORING || ''),
  'process.env.OPENAI_MODEL_FOR_SCORING': JSON.stringify(envKeys.OPENAI_MODEL_FOR_SCORING || 'gpt-4o'),
  // ADD THESE TWO LINES:
  'process.env.GOOGLE_GENAI_API_KEY': JSON.stringify(envKeys.GOOGLE_GENAI_API_KEY || ''),
  'process.env.GEMINI_API_KEY': JSON.stringify(envKeys.GEMINI_API_KEY || '')
}
```

Also update `.env.example` to document these new variables:
```
# Gemini/Google AI Configuration
GOOGLE_GENAI_API_KEY=""
GEMINI_API_KEY=""
```

## Recommendations

1. **Immediate Fix**: Add `GOOGLE_GENAI_API_KEY` and `GEMINI_API_KEY` to webpack.config.js's processEnv object.

2. **Update Documentation**: Add these keys to `.env.example` so developers know they're available.

3. **Build Process**: After making these changes, rebuild the extension with `npm run build` or `npm run build:dev`.

4. **Testing**: Verify the fix by checking that SimplifiedScorer can access these API keys without runtime errors.

5. **Pattern Consistency**: Always follow the pattern of adding new environment variables to BOTH:
   - webpack.config.js processEnv object (for build-time replacement)
   - .env.example (for documentation)

6. **Consider a Validation Step**: Add a build-time check to ensure all process.env references in src/ have corresponding entries in webpack's processEnv.

## Open Questions
- Should there be a linting rule or build step to catch undefined environment variables before runtime?
- Would it be beneficial to centralize all environment variable definitions in a single configuration file?