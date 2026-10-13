#!/bin/sh
# W1: imprime o calendário do original para um ano-base (gabarito de packages/engine/src/calendario.test.ts).
#   tools/calendario.sh [ano=2022] > packages/engine/src/ref-calendario-<ano>.json   ({ rótulo do a.u(): ["dd/mm/aaaa", ...] })
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${TMPDIR:-/tmp}/bolasfoot-oracle
mkdir -p "$BUILD"
javac -nowarn -d "$BUILD" -cp "$ROOT/original/game.jar" "$ROOT/tools/Calendario.java" 2>&1 | grep -v '^Note:' || true
cd "$ROOT/original/game"
java -Djava.awt.headless=false \
  --add-exports java.desktop/sun.java2d=ALL-UNNAMED --add-exports java.desktop/sun.awt=ALL-UNNAMED \
  --add-opens java.desktop/sun.java2d=ALL-UNNAMED --add-opens java.desktop/java.awt=ALL-UNNAMED \
  --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED \
  -cp "$BUILD:bf22-23.exe" Calendario "${1:-2022}" | grep -E '^[^:{]+:[0-9]+\) ' | node -e '
const r = {}
for (const l of require("fs").readFileSync(0, "utf8").trim().split("\n")) {
  const [, rotulo, data] = /^(.+?):\d+\) (\S+) /.exec(l)
  ;(r[rotulo] ??= []).push(data)
}
console.log(JSON.stringify(r, null, 1))'
