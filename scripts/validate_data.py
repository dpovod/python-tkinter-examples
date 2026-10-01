#!/usr/bin/env python3
"""Перевірка узгодженості даних у docs/_data.

Запуск: python3 scripts/validate_data.py
Залежності: Python 3, PyYAML (pip install pyyaml).
"""

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
DATA = DOCS / "_data"
KTP_DIR = DATA / "ktp"

errors = []
todos = []


def load_yaml(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    subjects = load_yaml(DATA / "subjects.yml") or []
    lessons = load_yaml(DATA / "lessons.yml") or []
    resources = load_yaml(DATA / "resources.yml") or []
    ktp_files = sorted(KTP_DIR.glob("grade*.yml"))
    ktps = [(p, load_yaml(p)) for p in ktp_files]

    subject_ids = {s["id"] for s in subjects}
    lesson_ids = {l["id"] for l in lessons}
    resource_ids = {r["id"] for r in resources}
    lessons_by_id = {l["id"]: l for l in lessons}

    # --- id уроків і ресурсів унікальні ---
    seen = set()
    for l in lessons:
        if l["id"] in seen:
            errors.append(f"lessons.yml: дублікат id '{l['id']}'")
        seen.add(l["id"])

    seen = set()
    for r in resources:
        if r["id"] in seen:
            errors.append(f"resources.yml: дублікат id '{r['id']}'")
        seen.add(r["id"])

    # --- lessons[].url відповідає наявному файлу в docs/ ---
    for l in lessons:
        url = l["url"]
        target = DOCS / url.lstrip("/")
        if not target.exists():
            errors.append(f"lessons.yml: '{l['id']}' посилається на неіснуючий файл {url}")

    # --- subject уроку існує в subjects.yml ---
    for l in lessons:
        if l["subject"] not in subject_ids:
            errors.append(f"lessons.yml: '{l['id']}' має невідомий subject '{l['subject']}'")

    # --- extra ⊆ grades ---
    for l in lessons:
        grades = set(l.get("grades", []))
        extra = set(l.get("extra", []))
        if not extra.issubset(grades):
            errors.append(
                f"lessons.yml: '{l['id']}' має extra {sorted(extra)}, що не є підмножиною grades {sorted(grades)}"
            )

    # --- ktp/*.yml: lessons існують і клас входить у grades уроку; resources/textbook існують ---
    for path, ktp in ktps:
        grade = ktp.get("grade")
        fname = path.name

        textbook = ktp.get("textbook")
        if textbook and textbook not in resource_ids:
            errors.append(f"{fname}: textbook '{textbook}' відсутній у resources.yml")

        textbook_files = ktp.get("textbook_files")
        if textbook_files and textbook_files not in resource_ids:
            errors.append(f"{fname}: textbook_files '{textbook_files}' відсутній у resources.yml")

        for tid in ktp.get("textbooks", []):
            if tid not in resource_ids:
                errors.append(f"{fname}: textbooks '{tid}' відсутній у resources.yml")

        for group in ktp.get("groups", []):
            for lid in group.get("lessons", []):
                if lid not in lesson_ids:
                    errors.append(
                        f"{fname}: група «{group.get('title')}» посилається на неіснуючий урок '{lid}'"
                    )
                    continue
                lesson_grades = lessons_by_id[lid].get("grades", [])
                if grade not in lesson_grades:
                    errors.append(
                        f"{fname}: урок '{lid}' у групі «{group.get('title')}» не має класу {grade} серед grades {lesson_grades}"
                    )

            for rid in group.get("resources", []):
                if rid not in resource_ids:
                    errors.append(
                        f"{fname}: група «{group.get('title')}» посилається на неіснуючий ресурс '{rid}'"
                    )

    # --- записи з url: TODO ---
    for r in resources:
        if r.get("url") == "TODO":
            todos.append(f"resources.yml: '{r['id']}' ({r.get('title')}) — url: TODO")

    if todos:
        print("Записи з url: TODO:")
        for t in todos:
            print(f"  - {t}")
        print()

    if errors:
        print(f"Знайдено помилок: {len(errors)}")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)

    print("Усі перевірки пройдено успішно.")
    sys.exit(0)


if __name__ == "__main__":
    main()
