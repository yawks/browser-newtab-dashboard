#!/bin/sh
set -eu

cd "$(dirname "$0")/.."
npm run build

version=$(node -p "require('./dist/manifest.json').version")
archive="build/dashboard-new-tab-$version.xpi"
mkdir -p build
tmp=$(mktemp -d "$PWD/build/.xpi.XXXXXX")
trap 'rm -rf "$tmp"' EXIT
(cd dist && zip -qr "$tmp/package.xpi" manifest.json index.html assets icons -x '*/.DS_Store')
mv "$tmp/package.xpi" "$archive"
printf 'XPI non signé généré : %s\n' "$archive"
