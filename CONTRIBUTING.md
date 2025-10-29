# BrowserOS Agent - Development Guide

## Build Instructions

### Setup Steps

1. **Clone the repository and install dependencies**
   ```bash
   git clone https://github.com/browseros-ai/BrowserOS-agent
   cd BrowserOS-agent
   yarn
   ```

2. **Copy a `.env.example` into `.env` file in the root directory and set LITELLM_API_KEY**
   ```
   cp .env.example .env
   ```
   ```
   // fyi, this key has very limited usage limits
   LITELLM_API_KEY=sk-xYnTqbxdLtQTrqVhtZgmrw
   ```
   > **Note:** You'll need a LiteLLM API key to use the LLM features.

4. **Build the extension**
   ```bash
   yarn build:dev
   ```
   This creates a `dist/` folder with the compiled extension files.

### Loading the Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top right)
3. Click **Load unpacked**
4. Select the `dist/` folder from your project
5. The extension should now appear in your extensions list

### Testing the Extension

1. Click the extension icon in Chrome's toolbar
2. The agent side panel should open
3. Try some commands like:
   - "List all my tabs"
   - "Go to Google and search for TypeScript"

### Switching LLM Providers (Optional)

If you want to use a different LLM provider instead of LiteLLM, you can use the mock settings configuration:

1. **Enable mock LLM settings**
   - Open `src/config.ts`
   - Set `MOCK_LLM_SETTINGS` to `true`

2. **Configure your preferred provider**
   - Open `src/lib/llm/settings/LLMSettingsReader.ts`
   - Update `MOCK_PREFERENCES` with your preferred provider and API keys

3. **Rebuild the extension**
   ```bash
   yarn build:dev
   ```
   
> **Note:** This is useful for testing with different LLM providers or when you want to use your own API keys directly.
