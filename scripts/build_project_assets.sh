#!/usr/bin/env bash
# Архіви й скріншоти для сторінки «Проєкт: створення сайту» (docs/html/project.html).
#
# Джерела (їх і редагуємо):
#   docs/html/project/templates/<назва>/   — шаблони для учнів
#   docs/html/project/example-cafe/        — повний приклад сайту
# Результат (не редагувати вручну, лише перезбирати цим скриптом):
#   docs/files/html-project/*.zip          — архіви для завантаження
#   docs/html/project/screenshots/*.jpg    — прев'ю на сторінці проєкту
#
# Запуск після будь-якої зміни шаблонів чи прикладу (потрібен Google Chrome):
#   scripts/build_project_assets.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/docs/html/project"
ZIPS="$ROOT/docs/files/html-project"
SHOTS="$SRC/screenshots"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$ZIPS" "$SHOTS"

# zip_folder <папка-джерело> <ім'я архіву й папки всередині нього>
zip_folder() {
  local src="$1" name="$2"
  rm -rf "${TMP:?}/$name" "$ZIPS/$name.zip"
  cp -R "$src" "$TMP/$name"
  (cd "$TMP" && zip -qrX "$ZIPS/$name.zip" "$name" -x '*.DS_Store')
  echo "zip: files/html-project/$name.zip"
}

# shot <сторінка.html> <назва.jpg> — знімок 1280×800, стиснутий до ширини 800
shot() {
  local page="$1" out="$2"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars \
    --window-size=1280,800 --screenshot="$TMP/shot.png" "file://$page" >/dev/null 2>&1
  sips -s format jpeg -s formatOptions 75 --resampleWidth 800 \
    "$TMP/shot.png" --out "$SHOTS/$out" >/dev/null
  echo "jpg: html/project/screenshots/$out"
}

for t in classic sidebar landing dark; do
  zip_folder "$SRC/templates/$t" "template-$t"
  shot "$SRC/templates/$t/index.html" "template-$t.jpg"
done

zip_folder "$SRC/example-cafe" "example-cafe"
for p in index menu about contacts; do
  shot "$SRC/example-cafe/$p.html" "cafe-$p.jpg"
done
