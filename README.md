# python-tkinter-examples

Навчальний сайт з інформатики для 6–11 класів: приклади коду, завдання й матеріали, згруповані за темами і за класами (відповідно до календарно-тематичних планів).

Сайт лежить у `/docs` і публікується GitHub Pages з гілки `main` (`https://dpovod.github.io/python-tkinter-examples/`). Усе поза `/docs` (цей README, `REDESIGN_PLAN.md`, `design/`, `scripts/`) — службові файли, вони не публікуються.

## Як запустити сайт локально

Сайт збирається Jekyll (та сама версія 3.9.x, яку використовує GitHub Pages). Для локальної збірки потрібен окремий `ruby@3.1` (детальніше — коментарі у `docs/Gemfile` і `scripts/jekyll.sh`), тому користуйся скриптом-обгорткою замість `bundle`/`jekyll` напряму:

```sh
brew install ruby@3.1      # один раз, якщо ще не встановлено

scripts/jekyll.sh install  # встановити гем-и (один раз і після змін у Gemfile)
scripts/jekyll.sh build    # зібрати сайт у docs/_site
scripts/jekyll.sh serve    # локальний сервер, http://localhost:4000/python-tkinter-examples/
```

## Перевірки перед комітом

```sh
scripts/jekyll.sh build              # без помилок і попереджень Liquid
python3 scripts/validate_data.py     # узгодженість _data/*.yml
python3 scripts/check_links.py       # внутрішні посилання зібраного сайту (спершу build)
```

`validate_data.py` потребує PyYAML (`pip3 install pyyaml`, або `pip3 install --user --break-system-packages pyyaml`, якщо система блокує звичайний `pip install` — це стандартна поведінка Homebrew-керованого Python).

## Як влаштований сайт

- `docs/_layouts/` — шаблони сторінок (`default`, `home`, `lesson`, `hub`, `class`).
- `docs/_includes/` — багаторазові фрагменти (іконки, бейджі, картка ресурсу, навігація).
- `docs/_data/` — увесь навчальний контент-каталог:
  - `subjects.yml` — розділи бібліотеки (Python, Tkinter, Office, Бази даних, Веб + заплановані);
  - `lessons.yml` — каталог сторінок-уроків: назва, URL, розділ, класи, які з них «Додатково»;
  - `resources.yml` — підручники, тренажери, файли, посилання;
  - `ktp/grade6.yml` … `ktp/grade11.yml` — календарно-тематичні плани по класах.
- Самі сторінки уроків (`docs/*.html`, `docs/excel/*.html`, `docs/sql/*.html`, `docs/html/*.html`) — це просто front matter (`layout: lesson`, `lesson: <id>`) і вміст усередині карток. Дані про клас/розділ/навігацію шаблон підтягує сам із `_data`.

## Як додати урок

1. Створи сторінку в `docs/` (наприклад, `docs/новий-урок.html`) із front matter:
   ```yaml
   ---
   layout: lesson
   title: "Назва уроку"
   lesson: unique-id
   description: "Короткий опис для SEO."
   ---
   ```
2. Вміст — картки `<div class="card card--example">` (приклад із кодом) або `<div class="card card--task">` (завдання), кожна з `<span class="card__number">N</span>` і `<h3>`. Код — через `{% highlight python %}…{% endhighlight %}` усередині `<div class="code-block">`.
3. Додай запис у `docs/_data/lessons.yml`:
   ```yaml
   - id: unique-id
     title: "Назва в каталозі й на картках"
     url: /новий-урок.html
     subject: python        # id з subjects.yml
     grades: [8, 9]          # усі класи, де урок використовується
     extra: [9]               # підмножина grades, де рівень "Додатково"
   ```
4. Додай `unique-id` у `lessons:` потрібної групи в `docs/_data/ktp/gradeN.yml` для кожного класу з `grades`.
5. `python3 scripts/validate_data.py` — перевірить, що `url` існує, `subject` відомий, `extra ⊆ grades`, і що клас файлу КТП входить у `grades` уроку.

## Як додати ресурс

Додай запис у `docs/_data/resources.yml`:

```yaml
- id: unique-id
  title: "Назва"
  type: link              # link | file | book
  group: practice         # textbooks | security | practice | files
  url: "https://…"          # або /files/… для власного файлу
  note: "Коротка примітка"
  grades: [9, 10]
  featured: true           # необов'язково: показати в "Додаткових матеріалах" на головній
```

Щоб ресурс з'явився на сторінці класу — додай його `id` у `resources:` потрібної групи в `docs/_data/ktp/gradeN.yml`. Записи з `url: TODO` ніде на сайті не показуються (лише перелічуються у виводі `validate_data.py`).

## Як оновити КТП на новий навчальний рік

Онови відповідний `docs/_data/ktp/gradeN.yml`: заголовки/семестри груп, перелік тем, які `lessons`/`resources` до них прив'язані. Самі сторінки уроків і `lessons.yml`/`resources.yml` міняти не обов'язково, якщо змінився лише порядок чи розподіл по семестрах — лише посилання `id` у групах КТП.

## Як додати розв'язок до завдання

Розв'язки завдань за замовчуванням не показуються. Щоб додати розв'язок до картки завдання (`class="card card--task"`), встав після опису завдання (усередині картки, після блоку з кодом задачі, якщо він є):

```html
<details class="solution">
  <summary>Показати відповідь</summary>
  <div class="code-block">
{% highlight python %}
# розв'язок
{% endhighlight %}
  </div>
</details>
```

Кнопка «Показати відповідь» з'являється автоматично лише на картках, де є такий блок `<details class="solution">`. Якщо розв'язку немає — нічого додавати не треба, кнопка не покаже.
