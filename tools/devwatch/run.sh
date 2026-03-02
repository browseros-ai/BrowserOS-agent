#!/bin/bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
BIN="$DIR/devwatch"

# Only need to build if binary doesn't exist or source is newer
if [ ! -f "$BIN" ] || [ "$DIR/main.go" -nt "$BIN" ]; then
  if ! command -v go &>/dev/null; then
    echo ""
    echo "  Go is required to build devwatch but is not installed."
    echo ""
    echo "  Install it with:  brew install go"
    echo "  Or download from: https://go.dev/dl/"
    echo ""
    exit 1
  fi
  echo "[build] Compiling devwatch..."
  (cd "$DIR" && go build -o devwatch .)
fi

exec "$BIN" "$@"
