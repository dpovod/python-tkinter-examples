(function () {
  'use strict';

  // ====================================================================
  // НАВЧАЛЬНА ТАБЛИЦЯ
  // Цей SQL вставляється в поле запиту кнопкою «Вставити запит для
  // створення тестової таблиці». Автоматично він НЕ виконується. Щоб змінити таблицю для
  // іншої практичної, замініть текст нижче (решта коду підлаштується сама).
  // ====================================================================
  var TEMPLATE_SQL = [
    "CREATE TABLE movies (",
    "  id INTEGER PRIMARY KEY,",
    "  title TEXT,",
    "  type TEXT,",
    "  genre TEXT,",
    "  year INTEGER,",
    "  rating REAL,",
    "  country TEXT",
    ");",
    "INSERT INTO movies VALUES",
    "(1, 'Інтерстеллар', 'Фільм', 'Фантастика', 2014, 8.7, 'США'),",
    "(2, 'Дивні дива', 'Серіал', 'Фантастика', 2016, 8.7, 'США'),",
    "(3, 'Мавка. Лісова пісня', 'Фільм', 'Мультфільм', 2023, 7.3, 'Україна'),",
    "(4, 'Венздей', 'Серіал', 'Комедія', 2022, 8.1, 'США'),",
    "(5, 'Спіймати Кайдаша', 'Серіал', 'Драма', 2020, 7.9, 'Україна'),",
    "(6, 'Гра в кальмара', 'Серіал', 'Трилер', 2021, 8.0, 'Південна Корея'),",
    "(7, 'Людина-павук: Через всесвіт', 'Фільм', 'Мультфільм', 2023, 8.5, 'США'),",
    "(8, 'Дюна: Частина друга', 'Фільм', 'Фантастика', 2024, 8.5, 'США'),",
    "(9, 'Шерлок', 'Серіал', 'Детектив', 2010, 9.1, 'Велика Британія'),",
    "(10, 'Віднесені привидами', 'Фільм', 'Мультфільм', 2001, 8.6, 'Японія'),",
    "(11, 'Мандалорець', 'Серіал', 'Фантастика', 2019, 8.6, 'США'),",
    "(12, 'Довбуш', 'Фільм', 'Пригоди', 2023, 7.0, 'Україна');"
  ].join("\n");

  var HISTORY_KEY = 'sql-sandbox-history';
  var HISTORY_LIMIT = 200;
  var ROW_LIMIT = 1000;

  var SQL = null;
  var db = null;
  var history = [];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    query: $('query'),
    run: $('btn-run'),
    template: $('btn-template'),
    confirmTemplate: $('confirm-template'),
    reset: $('btn-reset'),
    confirmReset: $('confirm-reset'),
    schema: $('schema'),
    result: $('result'),
    history: $('history')
  };

  // ---------- Допоміжне ----------

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(d) { return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function fmtTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function norm(s) { return s.replace(/\s+/g, ' ').trim(); }

  function friendlyHint(message) {
    var m = message.toLowerCase();
    if (m.indexOf('no such column') !== -1) return 'Немає такого поля. Перевірте назву або лапки навколо тексту';
    if (m.indexOf('no such table') !== -1) return 'Немає такої таблиці. Можливо, її ще не створено';
    if (m.indexOf('already exists') !== -1) return 'Таблиця вже існує. Щоб почати спочатку, натисніть «Очистити базу»';
    if (m.indexOf('syntax error') !== -1) return 'Помилка в записі запиту: перевірте коми, лапки й крапку з комою';
    if (m.indexOf('unique constraint failed') !== -1) return 'Запис з таким ключем уже є';
    return '';
  }

  // ---------- Структура бази ----------

  function quoteIdent(name) { return '"' + name.replace(/"/g, '""') + '"'; }

  function renderSchema() {
    el.schema.textContent = '';
    var tables = [];
    var res = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    if (res.length) {
      res[0].values.forEach(function (r) { tables.push(r[0]); });
    }
    if (!tables.length) {
      el.schema.appendChild(make('p', 'muted', 'База порожня. Створіть таблицю'));
      return;
    }
    tables.forEach(function (name) {
      // Кожна таблиця — окрема «картка», як на схемах баз даних
      var card = make('div', 'schema-table');
      card.appendChild(make('div', 'table-name', name));
      var list = make('ul', 'columns');
      var info = db.exec('PRAGMA table_info(' + quoteIdent(name) + ')');
      if (info.length) {
        // стовпці: cid, name, type, notnull, dflt_value, pk
        info[0].values.forEach(function (c) {
          var li = make('li');
          li.appendChild(make('span', 'col-name', c[1]));
          if (c[5] > 0) {
            var pk = make('span', 'pk', 'PK');
            pk.title = 'Первинний ключ';
            li.appendChild(pk);
          }
          li.appendChild(make('span', 'col-type', c[2] || ''));
          list.appendChild(li);
        });
      }
      card.appendChild(list);
      el.schema.appendChild(card);
    });
  }

  // ---------- Результати ----------

  function resultBlock(sqlText) {
    var block = make('div', 'res-block');
    if (sqlText) {
      block.appendChild(make('div', 'res-label', 'Запит'));
      block.appendChild(make('pre', 'res-query', sqlText));
      block.appendChild(make('div', 'res-label', 'Результат'));
    }
    return block;
  }

  function renderTable(columns, rows, total) {
    var wrap = make('div', 'table-wrap');
    var table = make('table', 'result');
    var thead = make('thead');
    var trh = make('tr');
    columns.forEach(function (c) { trh.appendChild(make('th', '', c)); });
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = make('tbody');
    rows.forEach(function (row) {
      var tr = make('tr');
      row.forEach(function (v) {
        var td = make('td');
        if (v === null) {
          td.className = 'null';
          td.textContent = 'NULL';
        } else {
          td.textContent = String(v);
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  function renderError(message, sqlText) {
    var block = resultBlock(sqlText);
    var box = make('div', 'error');
    var hint = friendlyHint(message);
    if (hint) box.appendChild(make('p', 'error-hint', hint));
    box.appendChild(make('p', 'error-text', message));
    block.appendChild(box);
    return block;
  }

  // ---------- Виконання ----------

  function isWriteStatement(sqlText) {
    var s = sqlText.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)+/, '');
    return /^(insert|update|delete|replace)\b/i.test(s);
  }

  // Виконує текст (можливо, кілька запитів). Повертає { ok, blocks }.
  function execute(text) {
    var blocks = [];
    var isTemplate = norm(text) === norm(TEMPLATE_SQL);
    var count = 0;
    var stmt = null;
    var current = '';

    try {
      var iter = db.iterateStatements(text);
      for (stmt of iter) {
        current = norm(stmt.getSQL ? stmt.getSQL() : '');
        count++;
        var columns = stmt.getColumnNames();
        var block = resultBlock(isTemplate ? null : current);
        if (columns.length) {
          var rows = [];
          var total = 0;
          while (stmt.step()) {
            total++;
            if (rows.length < ROW_LIMIT) rows.push(stmt.get());
          }
          block.appendChild(make('p', 'res-ok', '✓ Запит виконано'));
          block.appendChild(renderTable(columns, rows, total));
          var note = 'Рядків: ' + total;
          if (total > rows.length) note += ' (показано перші ' + rows.length + ')';
          block.appendChild(make('p', 'res-count', note));
        } else {
          stmt.step();
          if (isWriteStatement(current)) {
            block.appendChild(make('p', 'res-ok', '✓ Запит виконано. Змінено рядків: ' + db.getRowsModified()));
          } else {
            block.appendChild(make('p', 'res-ok', '✓ Запит виконано'));
          }
        }
        blocks.push(block);
        stmt = null;
        current = '';
      }
    } catch (e) {
      if (stmt) { try { stmt.free(); } catch (_) { /* вже звільнено */ } }
      var errBlock = renderError(e && e.message ? e.message : String(e), isTemplate ? text.trim() : current);
      // Для кількох запитів показуємо те, що встигло виконатися, і помилку.
      if (isTemplate) blocks = [];
      blocks.push(errBlock);
      return { ok: false, blocks: blocks };
    }

    if (!count) {
      return { ok: false, blocks: [renderMessage('Запит порожній. Введіть SQL-код')], empty: true };
    }
    if (isTemplate) {
      var one = resultBlock(text.trim());
      one.appendChild(make('p', 'res-ok', '✓ Запит виконано'));
      blocks = [one];
    }
    return { ok: true, blocks: blocks };
  }

  function renderMessage(text) {
    var b = resultBlock(null);
    b.appendChild(make('p', 'muted', text));
    return b;
  }

  function showBlocks(blocks) {
    el.result.textContent = '';
    blocks.forEach(function (b) { el.result.appendChild(b); });
  }

  function run() {
    if (!db) return;
    var text = el.query.value;
    var outcome = execute(text);
    showBlocks(outcome.blocks);
    renderSchema();
    if (!outcome.empty) addHistory(text, outcome.ok);
  }

  // ---------- Історія ----------

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var data = raw ? JSON.parse(raw) : [];
      history = Array.isArray(data) ? data.filter(function (h) {
        return h && typeof h.sql === 'string' && typeof h.time === 'number';
      }) : [];
    } catch (e) {
      history = [];
    }
  }

  function saveHistory() {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch (e) { /* сховище недоступне */ }
  }

  function addHistory(sql, ok) {
    history.push({ sql: sql, ok: ok, time: Date.now() });
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    el.history.textContent = '';
    if (!history.length) {
      var li = make('li');
      li.appendChild(make('p', 'muted', 'Історія порожня.'));
      el.history.appendChild(li);
      return;
    }
    for (var i = history.length - 1; i >= 0; i--) {
      (function (item) {
        var li = make('li');
        var btn = make('button');
        btn.type = 'button';
        btn.title = 'Повернути запит у поле';
        var mark = make('span', 'h-mark ' + (item.ok ? 'h-ok' : 'h-err'), item.ok ? '✓' : '✗');
        mark.setAttribute('aria-label', item.ok ? 'виконано' : 'помилка');
        btn.appendChild(mark);
        btn.appendChild(make('span', 'h-sql', norm(item.sql)));
        btn.addEventListener('click', function () {
          el.query.value = item.sql;
          el.query.focus();
        });
        li.appendChild(btn);
        el.history.appendChild(li);
      })(history[i]);
    }
  }

  function downloadHistory() {
    var now = new Date();
    var lines = [
      '-- SQL-пісочниця: мої запити',
      '-- Дата: ' + fmtDate(now),
      ''
    ];
    history.forEach(function (h) {
      if (!h.ok) return;
      lines.push('-- [' + fmtTime(new Date(h.time)) + ']');
      lines.push(h.sql.trim());
      lines.push('');
    });
    // BOM, щоб Блокнот Windows правильно відкрив кирилицю
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'my-sql-queries-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---------- Інлайн-підтвердження ----------

  function hideConfirms() {
    el.confirmTemplate.hidden = true;
    el.confirmReset.hidden = true;
  }

  function insertTemplate() {
    el.query.value = TEMPLATE_SQL;
    hideConfirms();
    el.query.focus();
  }

  function resetDb() {
    if (db) db.close();
    db = new SQL.Database();
    hideConfirms();
    renderSchema();
    showBlocks([renderMessage('Базу очищено. Історію запитів збережено.')]);
  }

  // ---------- Ініціалізація ----------

  function bind() {
    el.run.addEventListener('click', run);
    el.query.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        run();
      }
    });

    el.template.addEventListener('click', function () {
      el.confirmReset.hidden = true;
      if (el.query.value.trim()) {
        el.confirmTemplate.hidden = false;
        $('confirm-template-yes').focus();
      } else {
        insertTemplate();
      }
    });
    $('confirm-template-yes').addEventListener('click', insertTemplate);
    $('confirm-template-no').addEventListener('click', hideConfirms);

    el.reset.addEventListener('click', function () {
      el.confirmTemplate.hidden = true;
      el.confirmReset.hidden = false;
      $('confirm-reset-yes').focus();
    });
    $('confirm-reset-yes').addEventListener('click', resetDb);
    $('confirm-reset-no').addEventListener('click', hideConfirms);

    $('btn-download').addEventListener('click', downloadHistory);
    $('btn-clear-history').addEventListener('click', function () {
      history = [];
      saveHistory();
      renderHistory();
    });
  }

  function init() {
    loadHistory();
    renderHistory();
    bind();

    if (typeof initSqlJs !== 'function') {
      showBlocks([renderError('Не вдалося завантажити SQL-рушій (vendor/sql-wasm.js).', '')]);
      return;
    }
    var vendorPath = window.SQL_VENDOR_PATH || 'vendor/';
    initSqlJs({ locateFile: function (file) { return vendorPath + file; } })
      .then(function (lib) {
        SQL = lib;
        db = new SQL.Database();
        renderSchema();
        el.run.disabled = false;
        document.documentElement.setAttribute('data-ready', '1');
      })
      .catch(function (err) {
        el.schema.textContent = '';
        showBlocks([renderError(
          'Не вдалося запустити SQL-рушій: ' + (err && err.message ? err.message : err) +
          '. Якщо сторінку відкрито як файл (file://), запустіть її через локальний сервер або відкрийте з GitHub Pages.', '')]);
      });
  }

  init();
})();
