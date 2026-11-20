#!/bin/sh
# Копіює офіційні значки інструментів і команд із встановленого Inkscape (GPL v2)
# у docs/assets/img/vector/tools/ для пам'ятки «Прийоми в Inkscape».
# Запуск з кореня репозиторію: scripts/copy_tool_icons.sh
set -e

INKSCAPE_ICONS="${INKSCAPE_ICONS:-/Applications/Inkscape.app/Contents/Resources/share/inkscape/icons/multicolor/symbolic/actions}"
DST="docs/assets/img/vector/tools"

mkdir -p "$DST"

for name in \
  tool-pointer \
  tool-node-editor \
  draw-rectangle \
  draw-ellipse \
  draw-polygon-star \
  zoom \
  dialog-fill-and-stroke \
  dialog-align-and-distribute \
  path-union \
  path-difference \
  path-intersection \
  object-group \
  object-ungroup
do
  cp "$INKSCAPE_ICONS/$name-symbolic.svg" "$DST/$name.svg"
done
