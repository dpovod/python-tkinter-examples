#!/usr/bin/env bash
# Локальна збірка/перегляд сайту docs/ конкретною версією Ruby (3.1),
# без зміни PATH у поточному шелі.
#
# Типовий Ruby на цій машині (Homebrew, 4.x) занадто новий: бібліотека
# liquid (залежність Jekyll) викликає метод Object#tainted?, якого немає
# в Ruby 3.2+. Тому для docs/ поставлено окремий ruby@3.1 (brew install
# ruby@3.1) — keg-only, тобто типовий `ruby` у системі він не чіпає.
#
# Використання:
#   scripts/jekyll.sh install   # bundle install
#   scripts/jekyll.sh build     # bundle exec jekyll build
#   scripts/jekyll.sh serve     # bundle exec jekyll serve

set -euo pipefail

RUBY_PREFIX="$(brew --prefix ruby@3.1)"
BUNDLE="$RUBY_PREFIX/bin/bundle"
DOCS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docs" && pwd)"

if [ ! -x "$BUNDLE" ]; then
  echo "Не знайдено $BUNDLE. Встанови: brew install ruby@3.1" >&2
  exit 1
fi

# Потрібно лише для `install`: нативний гем eventmachine (залежність
# jekyll) не знаходить заголовки C++ через биту версію Command Line
# Tools на цій машині (стара копія заголовків перекриває робочі з SDK).
export CPATH="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1:/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include"
export CPLUS_INCLUDE_PATH="$CPATH"

cd "$DOCS_DIR"

if [ "${1:-}" = "install" ]; then
  exec "$BUNDLE" install
fi

exec "$BUNDLE" exec jekyll "$@"
