#!/usr/bin/env bash
# Package the extension in src/ into unbar.zip for Chrome Web Store submission.
set -euo pipefail

cd "$(dirname "$0")"
rm -f unbar.zip
cd src
zip -r ../unbar.zip . -x ".*"
cd ..

echo "Created unbar.zip ($(du -h unbar.zip | cut -f1))"
