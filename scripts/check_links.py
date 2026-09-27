#!/usr/bin/env python3
"""Перевірка внутрішніх посилань зібраного сайту (docs/_site).

Читає baseurl з docs/_config.yml, обходить усі *.html у docs/_site,
перевіряє, що кожен внутрішній href/src (з baseurl) веде на наявний
файл або каталог. Зовнішні посилання (http/https) і mailto: не
перевіряються — їх треба перевіряти вручну.

Запуск: спершу збери сайт (scripts/jekyll.sh build), потім:
  python3 scripts/check_links.py
"""

import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "docs" / "_site"
CONFIG = ROOT / "docs" / "_config.yml"

LINK_RE = re.compile(r'(?:href|src)="([^"]+)"')


def read_baseurl():
    text = CONFIG.read_text(encoding="utf-8")
    m = re.search(r'^baseurl:\s*"?([^"\n]*)"?\s*$', text, re.MULTILINE)
    return (m.group(1).strip() if m else "").rstrip("/")


def main():
    if not SITE.exists():
        print(f"Немає {SITE} — спершу запусти scripts/jekyll.sh build")
        sys.exit(1)

    baseurl = read_baseurl()
    missing = []
    checked = 0

    for path in SITE.rglob("*.html"):
        text = path.read_text(encoding="utf-8")
        for m in LINK_RE.finditer(text):
            url = m.group(1)
            if url.startswith(("http://", "https://", "mailto:")):
                continue
            if baseurl and not url.startswith(baseurl + "/") and url != baseurl:
                continue
            checked += 1
            rel = url[len(baseurl):] if baseurl else url
            rel, _, _frag = rel.partition("#")
            rel = urllib.parse.unquote(rel).lstrip("/")
            if rel == "":
                continue
            target = SITE / rel
            if not target.exists():
                missing.append((path.relative_to(SITE), url))

    print(f"Перевірено {checked} внутрішніх посилань у {SITE}")
    if missing:
        seen = set()
        print(f"Биті посилання: {len(missing)}")
        for page, url in missing:
            if url not in seen:
                seen.add(url)
                print(f"  {page} -> {url}")
        sys.exit(1)

    print("Усі внутрішні посилання коректні.")
    sys.exit(0)


if __name__ == "__main__":
    main()
