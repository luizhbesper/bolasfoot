#!/bin/sh
# F0-6: captura as telas do Brasfoot original em docs/ref/*.png (gabarito da UI), sem intervenção.
# O jogo roda dentro do tools/RefShots.java, que segue o roteiro tools/capture-ref.txt e desenha cada
# janela em PNG (não precisa de permissão de Gravação de Tela).
#   tools/capture-ref.sh                 roda o roteiro inteiro → docs/ref/
#   tools/capture-ref.sh -i CMD OUT      modo exploração: segue o arquivo CMD (tail -f), PNGs em OUT
# Precisa de original/ (tools/extract.sh) e Java 17+.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
BUILD=${TMPDIR:-/tmp}/bolasfoot-refshots
mkdir -p "$BUILD"
javac -nowarn -d "$BUILD" -cp "$ROOT/original/game.jar" "$ROOT/tools/RefShots.java" 2>&1 | grep -v '^Note:' || true

# o jogo foi feito para Java 8: no 17 precisa abrir módulos internos do AWT
JAVA="java --add-exports java.desktop/sun.java2d=ALL-UNNAMED --add-exports java.desktop/sun.awt=ALL-UNNAMED
  --add-opens java.desktop/sun.java2d=ALL-UNNAMED --add-opens java.desktop/java.awt=ALL-UNNAMED
  --add-opens java.base/java.lang=ALL-UNNAMED --add-opens java.base/java.util=ALL-UNNAMED
  -cp $BUILD:bf22-23.exe RefShots"

cd "$ROOT/original/game"   # o jogo lê teams/, sons/ etc. relativos ao diretório atual
if [ "$1" = "-i" ]; then
  tail -n +1 -f "$2" | $JAVA "$3"
else
  $JAVA "$ROOT/docs/ref" "$ROOT/tools/capture-ref.txt"
fi
