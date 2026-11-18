#!/usr/bin/env bash
# Baut «Libras 4 Ever» aus dem privaten Repository «studio» als statische Kopie nach libras/game/.
#
#   bash libras/tools/build.sh [/pfad/zu/studio]     (Standard: ../studio neben AdFree)
#
# - relative Pfade (base './'), damit das Spiel unter /libras/game/ läuft
# - ohne eigenen Service Worker (der Spielpause-Worker hält die Dateien offline bereit)
# - ohne Einladungs-Sperre der Freundes-Vorschau (normaler öffentlicher Modus)
# - keine Source-Maps
# Am studio-Repository wird nichts dauerhaft verändert: die Bau-Einstellung liegt nur während
# des Baus als unversionierte Datei in apps/play und wird danach gelöscht.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
adfree="$(cd "$here/../.." && pwd)"
studio="$(cd "${1:-$adfree/../studio}" && pwd)"
play="$studio/apps/play"
out="$adfree/libras/game"
config="$play/vite.spielpause.config.ts"
pnpm="$(command -v pnpm || echo /opt/node22/bin/pnpm)"

(cd "$studio" && "$pnpm" install --frozen-lockfile)

cat > "$config" <<CFG
// TEMPORÄR: Bau-Einstellung für die Spielpause-Kopie (wird nach dem Bau gelöscht).
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^\.\/offline\/register\$/, replacement: '$here/stubs/register.ts' },
      { find: /^\.\/invite\$/, replacement: '$here/stubs/invite.ts' },
    ],
  },
  build: { outDir: '$out', emptyOutDir: true, sourcemap: false },
});
CFG
trap 'rm -f "$config"' EXIT
(cd "$play" && ./node_modules/.bin/vite build --config "$config")

# Gleicher Titel wie im Katalog (der Rahmen libras/index.html zeigt das Spiel im iframe).
sed -i 's#<title>Vorschau</title>#<title>Libras 4 Ever</title>#' "$out/index.html"
echo "libras/game: $(du -sh "$out" | cut -f1), $(find "$out" -type f | wc -l) Dateien, Stand $(cd "$studio" && git rev-parse --short HEAD)"
