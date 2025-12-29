# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding guidelines

- Write minimal code comments. Only add comments for non-obvious logic, complex algorithms, or critical warnings. Skip comments for self-explanatory code, obvious function names, and simple operations.

## Project Overview

**BrowserOS Agent Chrome Extension** - This project contains the official chrome extension for BrowserOS Agent, enabling users to interact with the core functionalities of BrowserOS.

## Bun Preferences

Default to using Bun instead of Node.js:

- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- Bun automatically loads .env (no dotenv needed)

## Project Structure

This project user wxt.dev as its framework for building chrome extension.

The chrome extension manifest is created via default wxt.dev setup along with some custom configuration provided via `wxt.config.ts` file

The key directories of the project are:
- `entrypoints/newtab`: Contains the code for the new tab page of the extension.
- `entrypoints/popup`: Contains the code for the popup that appears when the extension icon is clicked.
- `entrypoints/onboarding`: Contains the onboarding flow for new users which is triggered on first install.
