#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

echo "npm install"
npm install

echo "npm run build"
npm run build

echo "npm link"
npm link

echo "dbcli pronto"
