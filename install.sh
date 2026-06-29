#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_NAME="STC"
SOURCE_BIN="$ROOT_DIR/bin/$BIN_NAME"
INSTALL_DIR="${STC_INSTALL_DIR:-$HOME/.local/bin}"
TARGET_BIN="$INSTALL_DIR/$BIN_NAME"
BASHRC="$HOME/.bashrc"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

if [[ ! -x "$SOURCE_BIN" ]]; then
  if command -v deno >/dev/null 2>&1; then
    echo "Building $BIN_NAME..."
    (cd "$ROOT_DIR" && deno task build)
  else
    echo "error: $SOURCE_BIN not found and deno is not installed" >&2
    exit 1
  fi
fi

mkdir -p "$INSTALL_DIR"
TMP_BIN="$(mktemp "$INSTALL_DIR/$BIN_NAME.tmp.XXXXXX")"
cp "$SOURCE_BIN" "$TMP_BIN"
chmod +x "$TMP_BIN"
mv -f "$TMP_BIN" "$TARGET_BIN"

if [[ "$INSTALL_DIR" == "$HOME/.local/bin" ]]; then
  touch "$BASHRC"
  if ! grep -Fqx "$PATH_LINE" "$BASHRC"; then
    {
      echo ""
      echo "# STC local install"
      echo "$PATH_LINE"
    } >> "$BASHRC"
    echo "Added $INSTALL_DIR to PATH in $BASHRC"
  fi
else
  echo "Installed to custom directory: $INSTALL_DIR"
  echo "Add it to PATH manually if needed."
fi

echo "Installed $BIN_NAME to $TARGET_BIN"
echo "Run: source $BASHRC"
echo "Then: $BIN_NAME --version"
