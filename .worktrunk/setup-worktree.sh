#!/bin/bash
set -e

echo "Setting up worktree..."

# Install dependencies
bun install

# Get the main worktree (trunk) path
TRUNK=$(git worktree list | head -1 | awk '{print $1}')

# Copy env files from trunk if they exist
if [ -f "$TRUNK/apps/server/.env.development" ]; then
  cp "$TRUNK/apps/server/.env.development" apps/server/.env.development
  echo "✓ Copied apps/server/.env.development"
fi

if [ -f "$TRUNK/apps/agent/.env.development" ]; then
  cp "$TRUNK/apps/agent/.env.development" apps/agent/.env.development
  echo "✓ Copied apps/agent/.env.development"
fi

echo "Worktree setup complete!"
