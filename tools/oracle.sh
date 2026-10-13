#!/bin/sh
# M6: oráculo estatístico — roda N partidas no motor original (tools/Oracle.java) e grava as métricas
# em packages/engine/src/ref-original.json, a referência do teste estatístico do port.
#   tools/oracle.sh [N=10000] [seed=1]
# Precisa de original/ (tools/extract.sh) e Java 17+.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${TMPDIR:-/tmp}/bolasfoot-oracle
mkdir -p "$BUILD"
javac -nowarn -d "$BUILD" -cp "$ROOT/original/game.jar" "$ROOT/tools/Oracle.java" 2>&1 | grep -v '^Note:' || true

OUT="$BUILD/partidas.jsonl"
cd "$ROOT/original/game"   # o jogo lê teams/ etc. relativos ao diretório atual
java -Djava.awt.headless=false \
  --add-exports java.desktop/sun.java2d=ALL-UNNAMED --add-exports java.desktop/sun.awt=ALL-UNNAMED \
  --add-opens java.desktop/sun.java2d=ALL-UNNAMED --add-opens java.desktop/java.awt=ALL-UNNAMED \
  --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED \
  -cp "$BUILD:bf22-23.exe" Oracle "${1:-10000}" "${2:-1}" | grep '^{' > "$OUT"
node "$ROOT/packages/engine/sim.ts" --oraculo "$OUT" --saida "$ROOT/packages/engine/src/ref-original.json"
