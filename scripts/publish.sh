#!/usr/bin/env bash
# Builds the site and publishes it to the gh-pages branch (GitHub Pages serves that branch).
# Use this instead of the Actions workflow while the account can't run Actions.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="https://ezequielrickert.github.io/austral-ia-generativa"
OUT="$(mktemp -d)"
python3 scripts/build_data.py
zola build --base-url "$URL" --output-dir "$OUT/site" --force
cd "$OUT/site"
touch .nojekyll
git init -q
git checkout -q -b gh-pages
git add -A
git commit -q -m "Publicar sitio ($(date '+%Y-%m-%d %H:%M'))"
git push -q -f https://github.com/ezequielrickert/austral-ia-generativa.git gh-pages
echo "Publicado en $URL/ (GitHub tarda ~1 minuto en actualizarlo)"
rm -rf "$OUT"
