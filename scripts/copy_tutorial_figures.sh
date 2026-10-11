#!/bin/sh
# Копіює потрібні малюнки з офіційних туторіалів Inkscape (GPL v2) у docs/assets/img/vector/tutorial/.
# Вихідні збережені сторінки лежать у inkscape-tutorials/ (не комітяться, див. .gitignore).
# Запуск з кореня репозиторію: scripts/copy_tutorial_figures.sh
set -e

SRC="inkscape-tutorials"
DST="docs/assets/img/vector/tutorial"
BASIC="$SRC/Inkscape tutorial_ Початковий _ Inkscape_files"
SHAPES="$SRC/Inkscape tutorial_ Фігури _ Inkscape_files"
ADV="$SRC/Inkscape tutorial_ Досвідчений рівень _ Inkscape_files"

mkdir -p "$DST"

cp "$BASIC/basic-f02.svg" "$DST/shape-tools.svg"
cp "$BASIC/basic-f04.svg" "$DST/select.svg"
cp "$BASIC/basic-f14.svg" "$DST/z-order.svg"
cp "$SHAPES/shapes-f02-uk.svg" "$DST/rounded-rect.svg"
cp "$SHAPES/shapes-f13-uk.svg" "$DST/star-polygon.svg"
cp "$ADV/advanced-f03.svg" "$DST/path-nodes.svg"

# У оригіналі підпис «Union» лишився англійською.
sed 's/>Union</>Об’єднання</' "$ADV/advanced-f08-uk.svg" > "$DST/boolean-ops.svg"
