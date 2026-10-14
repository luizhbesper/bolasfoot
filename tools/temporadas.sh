#!/bin/sh
# Fase 2: roda N temporadas do original só com IA (tools/Temporadas.java), uma linha JSON por temporada.
#   tools/temporadas.sh [N=10] [sem-int] > saida.jsonl
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${TMPDIR:-/tmp}/bolasfoot-oracle
mkdir -p "$BUILD"
javac -nowarn -d "$BUILD" -cp "$ROOT/original/game.jar" "$ROOT/tools/Temporadas.java" 2>&1 | grep -v '^Note:' || true
cd "$ROOT/original/game"
java -Djava.awt.headless=false \
  --add-exports java.desktop/sun.java2d=ALL-UNNAMED --add-exports java.desktop/sun.awt=ALL-UNNAMED \
  --add-opens java.desktop/sun.java2d=ALL-UNNAMED --add-opens java.desktop/java.awt=ALL-UNNAMED \
  --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED \
  -cp "$BUILD:bf22-23.exe" Temporadas "${1:-10}" ${2:-} | grep '^{'
