#!/bin/sh
# Extrai o Brasfoot 22-23 original: assets, código decompilado e dados em JSON.
# Uso: tools/extract.sh ~/Downloads/brasfoot22-23.exe   (precisa: brew install sevenzip cfr-decompiler; java)
set -e
EXE=${1:?caminho do brasfoot22-23.exe}
OUT=$(cd "$(dirname "$0")/.." && pwd)/original
TOOLS=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$OUT/game" "$OUT/data"

7zz x -y -o"$OUT/game" "$EXE" >/dev/null                 # instalador NSIS -> assets + bf22-23.exe
JAR="$OUT/game.jar"
cp "$OUT/game/bf22-23.exe" "$JAR"                        # exe = launcher Launch4j + jar; Java lê direto

# classes ofuscadas diferem só por maiúscula (a.hU / a.hu): nunca descompactar em FS case-insensitive
cfr-decompiler "$JAR" --outputdir "$OUT/src" --caseinsensitivefs true --silent true >/dev/null 2>&1
unzip -o -q "$JAR" 'arquivos/*' 'a*/*' -d "$OUT/res" 2>/dev/null || true   # ícones, bandeiras, nomes, lang

javac -d "$OUT/tools" -cp "$JAR" "$TOOLS/Dump.java" 2>/dev/null
dump() { java -Djava.awt.headless=true -cp "$OUT/tools:$JAR" Dump "$@"; }
dump "$OUT"/game/teams/*.ban            > "$OUT/data/teams.jsonl"
dump "$OUT"/game/conf_estadual/*.ces    > "$OUT/data/estaduais.jsonl"
dump "$OUT"/game/conf_ligas_nacionais/*.cfg > "$OUT/data/ligas.jsonl"
dump "$OUT"/game/options.bcf            > "$OUT/data/options.jsonl"
wc -l "$OUT"/data/*.jsonl
