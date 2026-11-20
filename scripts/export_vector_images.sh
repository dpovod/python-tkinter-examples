#!/bin/sh
# Експорт зразків розділу «Векторна графіка»: design/vector/<набір>/<картка>.svg
# -> docs/assets/img/vector/<набір>/<картка>.png (960x720, білий фон; на сторінці показується
# малим, а за кнопкою «Збільшити» — великим, тому розмір подвійний).
#
# Кожен малюнок (група з id="art") перед експортом вписується в одну рамку FIT_W x FIT_H
# на полотні 480x360 і центрується, щоб усі зразки в збільшеному вигляді мали однаковий масштаб.
# Вихідні SVG при цьому не змінюються.
#
# Файли, що починаються з «_» (шаблон), пропускаються. Файли *-strip.svg (смуги кадрів анімації)
# експортуються у власному розмірі без вписування.
# Запуск з кореня репозиторію: scripts/export_vector_images.sh [набір]
set -e

INKSCAPE="${INKSCAPE:-/Applications/Inkscape.app/Contents/MacOS/inkscape}"
SRC="design/vector"
DST="docs/assets/img/vector"
FIT_W=400
FIT_H=300
CANVAS_CX=240
CANVAS_CY=180

for dir in "$SRC"/*/; do
  track=$(basename "$dir")
  if [ -n "$1" ] && [ "$1" != "$track" ]; then
    continue
  fi
  mkdir -p "$DST/$track"
  for svg in "$dir"*.svg; do
    [ -e "$svg" ] || continue
    name=$(basename "$svg" .svg)
    out="$DST/$track/$name.png"
    case "$name" in
      _*) continue ;;
      *-strip)
        "$INKSCAPE" "$svg" --export-type=png \
          --export-background=white --export-background-opacity=1 \
          --export-filename="$out" 2>/dev/null
        ;;
      *)
        box=$("$INKSCAPE" --query-id=art --query-x --query-y --query-width --query-height "$svg" 2>/dev/null | tr '\n' ' ')
        actions=$(echo "$box" | awk -v fw="$FIT_W" -v fh="$FIT_H" -v cx="$CANVAS_CX" -v cy="$CANVAS_CY" -v out="$out" '{
          x = $1; y = $2; w = $3; h = $4;
          s = fw / w; t = fh / h; if (t < s) s = t;
          dx = cx - (x + w / 2); dy = cy - (y + h / 2);
          printf "select-by-id:art;transform-scale:%.5f;transform-translate:%.4f,%.4f;export-filename:%s;export-type:png;export-width:960;export-height:720;export-background:white;export-background-opacity:1;export-do", s, dx, dy, out
        }')
        "$INKSCAPE" "$svg" --actions="$actions" 2>/dev/null
        ;;
    esac
    echo "$track/$name.png"
  done
done
