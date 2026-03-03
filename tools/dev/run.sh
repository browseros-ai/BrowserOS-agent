#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/browseros-dev"

NEEDS_BUILD=false
if [ ! -f "$BIN" ]; then
  NEEDS_BUILD=true
elif [ -n "$(find "$DIR" -name '*.go' -newer "$BIN" -print -quit 2>/dev/null)" ] || \
     [ "$DIR/go.mod" -nt "$BIN" ] || [ "$DIR/go.sum" -nt "$BIN" ]; then
  NEEDS_BUILD=true
fi

if [ "$NEEDS_BUILD" = true ]; then
  if ! command -v go &>/dev/null; then
    echo ""
    echo "  Go is required to build browseros-dev but is not installed."
    echo "  Install it with:  brew install go"
    echo "  Or download from: https://go.dev/dl/"
    echo ""
    exit 1
  fi
  echo "[build] Compiling browseros-dev..."
  (cd "$DIR" && go build -o browseros-dev .)
fi

exec "$BIN" "$@"
