# Sidepanel V2 Implementation

## Phase 1 Complete ✅

### What We Built

1. **Directory Structure**
   - Clean separation of concerns
   - Organized by feature type (stores, hooks, components)

2. **Chat Store** (`stores/chatStore.ts`)
   - Simple Zustand store with Zod schemas
   - Messages, processing state, tab selection, and error handling
   - Clean actions with single responsibilities
   - Useful selectors for common operations

3. **Message Handler** (`hooks/useMessageHandler.ts`)
   - Listens to Chrome extension port messages
   - Processes different message types cleanly
   - Simple streaming message tracking
   - No complex buffering or debouncing

4. **App Component** (`App.tsx`)
   - Minimal entry point for v2
   - Shows connection status and message count
   - Debug UI to verify everything works

5. **Feature Flag** (in `index.tsx`)
   - Use `?v2` query param to enable v2
   - Or set `USE_V2=true` environment variable
   - Defaults to v1 for safety

### Testing V2

1. Build the extension: `npm run build:dev`
2. Open the sidepanel with `?v2` in the URL
3. You should see the minimal Phase 1 UI
4. Send messages from the background - they should appear in the debug list

### Running Tests

```bash
npm test -- src/sidepanel/v2/stores/chatStore.test.ts
```

### Next Steps (Phase 2)

- Copy TabSelector and MarkdownContent components
- Build Chat, Header, MessageList, and MessageItem components
- Add proper styling
- Replace debug UI with real chat interface