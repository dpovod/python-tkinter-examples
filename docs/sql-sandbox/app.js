(function () {
  'use strict';

  // ====================================================================
  // НАВЧАЛЬНА ТАБЛИЦЯ
  // Цей SQL виконує пункт меню бази «Створити й заповнити» або
  // лише вставляє в редактор пункт «Показати SQL у редакторі». Щоб змінити
  // таблицю для іншої практичної, замініть текст нижче (решта коду
  // підлаштується сама: назву таблиці береться з першого CREATE TABLE).
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
  var TEMPLATE_TABLE = (/CREATE\s+TABLE\s+["`]?([\wЀ-ӿ]+)/i.exec(TEMPLATE_SQL) || [])[1] || 'movies';

  var KEY = {
    history: 'sql-sandbox-history',
    db: 'sql-sandbox-db',
    params: 'sql-sandbox-params',
    editor: 'sql-sandbox-editor',
    ui: 'sql-sandbox-ui'
  };
  var HISTORY_LIMIT = 200;
  var ROW_LIMIT = 1000;
  var LINE_H = 24;

  var SQL = null;
  var db = null;
  var history = [];
  var info = [];              // схема: [{name, count, cols, fks}]
  var saveFailed = false;
  var state = { results: [], messages: [], active: 'msg', lastResult: null, summary: 'Готово' };
  var ui = { selected: null, collapsed: {}, bottomH: null, dgScale: 1 };
  var dgPos = {};             // позиції карток схеми (на час сеансу)
  var selectedCell = null;

  var $ = function (id) { return document.getElementById(id); };
  var root = $('sbx');
  var el = {
    query: $('query'), hl: $('hl'), editor: $('editor'),
    run: $('btn-run'), runM: $('btn-run-m'),
    tree: $('schema'), baseMore: $('base-more'),
    cdlg: $('confirm-dlg'), confirmText: $('confirm-text'), confirmYes: $('confirm-yes'), confirmNo: $('confirm-no'),
    sdlg: $('schema-dlg'), sbar: $('schema-bar'), sbody: $('schema-body'), sclose: $('schema-close'),
    tabs: $('tabs'), panel: $('panel'), bottom: $('bottom'), resizer: $('resizer'),
    stMsg: $('st-msg'), stCell: $('st-cell'), copy: $('btn-copy'), csv: $('btn-csv'),
    dlg: $('params-dlg'), dlgForm: $('params-form'), dlgFields: $('params-fields')
  };
  var mobile = window.matchMedia('(max-width: 900px)');

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
  function shorten(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function plural(n, f) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return f[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return f[1];
    return f[2];
  }
  function rowsText(n) { return n + ' ' + plural(n, ['рядок', 'рядки', 'рядків']); }
  function colsText(n) { return n + ' ' + plural(n, ['стовпець', 'стовпці', 'стовпців']); }
  function fmtMs(ms) { return (ms < 1 ? '<1' : String(Math.round(ms))) + ' мс'; }
  function quoteIdent(name) { return '"' + name.replace(/"/g, '""') + '"'; }
  function ident(name) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : quoteIdent(name); }

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { /* сховище недоступне */ } }
  function lsJson(k, fallback) {
    try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }

  // ---------- Токенайзер SQL (підсвітка, межі запитів, параметри) ----------

  var RE_WS = /\s+/y;
  var RE_WORD = /[\p{L}_][\p{L}\p{N}_]*/uy;
  var RE_PARAM = /:[\p{L}_][\p{L}\p{N}_]*/uy;
  var RE_NUM = /\d+(?:\.\d+)?/y;
  function matchLen(re, s, i) { re.lastIndex = i; var m = re.exec(s); return m ? m[0].length : 0; }

  function tokenize(src) {
    var out = [], i = 0, n = src.length;
    function push(t, e) { out.push({ t: t, s: i, e: e }); i = e; }
    while (i < n) {
      var c = src.charAt(i), c2 = src.charAt(i + 1), len, j;
      if (c === '-' && c2 === '-') {
        j = src.indexOf('\n', i); push('comment', j < 0 ? n : j);
      } else if (c === '/' && c2 === '*') {
        j = src.indexOf('*/', i + 2); push('comment', j < 0 ? n : j + 2);
      } else if (c === "'" || c === '"' || c === '`') {
        j = i + 1;
        while (j < n) {
          if (src.charAt(j) === c) {
            if (src.charAt(j + 1) === c) { j += 2; continue; }
            j++; break;
          }
          j++;
        }
        push('string', j);
      } else if (c === ';') {
        push('semi', i + 1);
      } else if ((len = matchLen(RE_WS, src, i))) {
        push('ws', i + len);
      } else if (c === ':' && (len = matchLen(RE_PARAM, src, i))) {
        push('param', i + len);
      } else if ((len = matchLen(RE_WORD, src, i))) {
        push('word', i + len);
      } else if ((len = matchLen(RE_NUM, src, i))) {
        push('number', i + len);
      } else {
        push('punct', i + (src.codePointAt(i) > 0xFFFF ? 2 : 1));
      }
    }
    return out;
  }

  // Розбиває текст на окремі запити за «;» (з урахуванням лапок, коментарів
  // і тіла CREATE TRIGGER ... BEGIN ... END). Повертає [{start, end, sql}].
  function splitStatements(src) {
    var out = [], start = -1, lastEnd = 0, has = false, body = false, last = '', words = [];
    function reset() { start = -1; has = false; body = false; last = ''; words = []; }
    tokenize(src).forEach(function (t) {
      if (t.t === 'ws') return;
      if (start < 0) start = t.s;
      lastEnd = t.e;
      if (t.t === 'semi') {
        if (body && last !== 'END') return;
        if (has) out.push({ start: start, end: t.e, sql: src.slice(start, t.e) });
        reset();
        return;
      }
      if (t.t === 'comment') return;
      has = true;
      if (t.t === 'word') {
        var w = src.slice(t.s, t.e).toUpperCase();
        if (words.length < 4) words.push(w);
        if (w === 'BEGIN' && words.indexOf('TRIGGER') >= 0) body = true;
        last = w;
      } else {
        last = '';
      }
    });
    if (has) out.push({ start: start, end: lastEnd, sql: src.slice(start, lastEnd) });
    return out;
  }

  function findParams(sql) {
    var names = [];
    tokenize(sql).forEach(function (t) {
      if (t.t !== 'param') return;
      var name = sql.slice(t.s, t.e);
      if (names.indexOf(name) < 0) names.push(name);
    });
    return names;
  }

  function codeWords(sql) {
    var tokens = tokenize(sql), out = [];
    tokens.forEach(function (t) { if (t.t === 'word') out.push(sql.slice(t.s, t.e).toLowerCase()); });
    return out;
  }
  function kindOf(sql) { return codeWords(sql)[0] || ''; }
  function isReadOnly(sql) {
    var k = kindOf(sql);
    return k === 'select' || k === 'explain' || (k === 'pragma' && sql.indexOf('=') < 0);
  }
  function isWriteKind(sql) { return /^(insert|update|delete|replace)$/.test(kindOf(sql)); }

  // UPDATE або DELETE без WHERE: повертає назву таблиці, інакше null
  function dangerousTable(sql) {
    var k = kindOf(sql);
    if (k !== 'update' && k !== 'delete') return null;
    if (codeWords(sql).indexOf('where') >= 0) return null;
    var clean = sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
    var m = k === 'update'
      ? /^\s*update\s+(?:or\s+\w+\s+)?["`]?([\wЀ-ӿ]+)/i.exec(clean)
      : /^\s*delete\s+from\s+["`]?([\wЀ-ӿ]+)/i.exec(clean);
    return m ? m[1] : null;
  }

  // ---------- Підсвітка синтаксису ----------

  var KEYWORDS = {};
  ('SELECT FROM WHERE AND OR NOT IN IS NULL LIKE BETWEEN ORDER BY GROUP HAVING LIMIT OFFSET DISTINCT AS INSERT INTO VALUES ' +
   'UPDATE SET DELETE CREATE TABLE DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES INTEGER TEXT REAL NUMERIC BLOB DEFAULT ' +
   'UNIQUE JOIN INNER LEFT RIGHT OUTER CROSS ON ASC DESC CASE WHEN THEN ELSE END PRAGMA UNION ALL EXISTS INDEX VIEW TRIGGER ' +
   'BEGIN COMMIT ROLLBACK TRANSACTION CHECK AUTOINCREMENT CAST WITH REPLACE IF RENAME TO').split(' ')
    .forEach(function (w) { KEYWORDS[w] = 1; });
  var FUNCS = {};
  'COUNT SUM AVG MAX MIN ROUND LENGTH UPPER LOWER ABS'.split(' ').forEach(function (w) { FUNCS[w] = 1; });

  function highlightLines(text) {
    var lines = [], line = '';
    tokenize(text).forEach(function (t) {
      var raw = text.slice(t.s, t.e), cls = '';
      if (t.t === 'comment') cls = 't-c';
      else if (t.t === 'string') cls = 't-s';
      else if (t.t === 'number') cls = 't-n';
      else if (t.t === 'param') cls = 't-p';
      else if (t.t === 'word') {
        var up = raw.toUpperCase();
        if (FUNCS[up]) cls = 't-f'; else if (KEYWORDS[up]) cls = 't-k';
      }
      raw.split('\n').forEach(function (piece, k) {
        if (k > 0) { lines.push(line); line = ''; }
        if (!piece) return;
        line += cls ? '<span class="' + cls + '">' + esc(piece) + '</span>' : esc(piece);
      });
    });
    lines.push(line);
    return lines;
  }

  var curLineIdx = -1;
  function renderHighlight() {
    var lines = highlightLines(el.query.value);
    el.hl.innerHTML = lines.map(function (l) { return '<div class="ln">' + l + '</div>'; }).join('');
    curLineIdx = -1;
    updateCaretLine();
    syncScroll();
  }
  function updateCaretLine() {
    var idx = el.query.value.slice(0, el.query.selectionStart).split('\n').length - 1;
    if (idx === curLineIdx) return;
    var kids = el.hl.children;
    if (kids[curLineIdx]) kids[curLineIdx].classList.remove('cur');
    if (kids[idx]) kids[idx].classList.add('cur');
    curLineIdx = idx;
  }
  function syncScroll() { el.hl.scrollTop = el.query.scrollTop; }

  var editorSaveTimer = null;
  function onEditorChange() {
    renderHighlight();
    clearTimeout(editorSaveTimer);
    editorSaveTimer = setTimeout(function () { lsSet(KEY.editor, el.query.value); }, 400);
  }

  function insertInEditor(text) {
    var cur = el.query.value;
    var prefix = cur.trim() ? cur.replace(/\s+$/, '') + '\n\n' : '';
    el.query.value = prefix + text;
    onEditorChange();
    el.query.focus();
    var end = el.query.value.length;
    el.query.setSelectionRange(end, end);
    el.query.scrollTop = el.query.scrollHeight;
    syncScroll();
    updateCaretLine();
  }

  // ---------- Підтвердження (маленьке модальне вікно, решта сторінки розмита) ----------

  var pendingYes = null;
  function ask(text, onYes, yesLabel, danger) {
    closeMenu();
    pendingYes = onYes;
    el.confirmText.textContent = text;
    el.confirmYes.textContent = yesLabel || 'Так';
    el.confirmYes.classList.toggle('sbx-btn-danger', !!danger);
    el.cdlg.showModal();
    // небезпечну дію не можна підтвердити випадковим Enter
    (danger ? el.confirmNo : el.confirmYes).focus();
  }
  function closeAsk() { if (el.cdlg.open) el.cdlg.close(); pendingYes = null; }

  // ---------- Схема бази ----------

  function loadInfo() {
    var out = [];
    var res = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    if (!res.length) return out;
    res[0].values.forEach(function (r) {
      var name = r[0];
      var t = { name: name, count: 0, cols: [], fks: [] };
      try {
        var c = db.exec('SELECT COUNT(*) FROM ' + quoteIdent(name));
        t.count = c.length ? c[0].values[0][0] : 0;
        var ti = db.exec('PRAGMA table_info(' + quoteIdent(name) + ')');
        if (ti.length) ti[0].values.forEach(function (v) {
          t.cols.push({ name: v[1], type: v[2] || '', notnull: v[3], pk: v[5] > 0 });
        });
        var fl = db.exec('PRAGMA foreign_key_list(' + quoteIdent(name) + ')');
        if (fl.length) fl[0].values.forEach(function (v) {
          t.fks.push({ table: v[2], from: v[3], to: v[4] });
        });
      } catch (e) { /* пошкоджена таблиця: показуємо як є */ }
      out.push(t);
    });
    // FK без явного поля (REFERENCES t) вказує на первинний ключ
    out.forEach(function (t) {
      t.fks.forEach(function (fk) {
        if (fk.to) return;
        var target = findTable(out, fk.table);
        var pk = target && target.cols.filter(function (c) { return c.pk; })[0];
        fk.to = pk ? pk.name : '';
      });
    });
    return out;
  }
  function findTable(list, name) {
    for (var i = 0; i < list.length; i++) if (list[i].name.toLowerCase() === String(name).toLowerCase()) return list[i];
    return null;
  }
  function tableExists(name) { return !!findTable(info, name); }

  function refreshInfo() {
    info = loadInfo();
    if (ui.selected && !findTable(info, ui.selected)) ui.selected = null;
    if (!ui.selected && info.length === 1) ui.selected = info[0].name;
    renderTree();
    if (el.sdlg.open) renderSchema();
  }

  // ---------- Ліва панель: дерево таблиць ----------

  function renderTree() {
    el.tree.textContent = '';
    if (!info.length) {
      var empty = make('div', 'sbx-empty');
      empty.appendChild(make('p', 'sbx-muted', 'База порожня. Створіть власну таблицю запитом або візьміть готову.'));
      var make1 = make('button', 'btn btn--primary', 'Створити тестову таблицю');
      make1.type = 'button';
      make1.addEventListener('click', createTemplate);
      empty.appendChild(make1);
      el.tree.appendChild(empty);
      return;
    }
    el.tree.appendChild(make('div', 'sbx-tree-h', 'Таблиці'));
    var ul = make('ul', 'sbx-tables');
    info.forEach(function (t) {
      var sel = ui.selected === t.name;
      var open = !ui.collapsed[t.name];
      var li = make('li', 'sbx-table' + (sel ? ' is-sel' : '') + (open ? ' is-open' : ''));
      var row = make('div', 'sbx-trow');
      var nameBtn = make('button', 'sbx-tname');
      nameBtn.type = 'button';
      nameBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
      nameBtn.appendChild(make('span', 'sbx-caret', open ? '▾' : '▸'));
      nameBtn.appendChild(make('span', 'sbx-tn', t.name));
      var cnt = make('span', 'sbx-count', String(t.count));
      cnt.title = 'Записів: ' + t.count;
      nameBtn.appendChild(cnt);
      nameBtn.addEventListener('click', function (e) {
        var byKeyboard = e.detail === 0;   // Enter/Space, а не клік мишею
        if (ui.selected === t.name) ui.collapsed[t.name] = open; else ui.selected = t.name;
        renderTree();
        var again = el.tree.querySelector('.is-sel .sbx-tname');
        if (again && byKeyboard) again.focus();
      });
      var more = make('button', 'sbx-more', '⋯');
      more.type = 'button';
      more.setAttribute('aria-haspopup', 'menu');
      more.setAttribute('aria-label', 'Меню таблиці ' + t.name);
      more.addEventListener('click', function () { openTableMenu(t.name, more); });
      row.appendChild(nameBtn);
      row.appendChild(more);
      attachTableMenu(row, t.name, nameBtn);
      li.appendChild(row);

      if (open) {
        var fl = make('ul', 'sbx-fields');
        t.cols.forEach(function (c) {
          var fk = t.fks.filter(function (f) { return f.from === c.name; })[0];
          var f = make('li');
          var mark = make('span', 'sbx-mark');
          if (c.pk) { mark.textContent = '🔑'; mark.title = 'Первинний ключ'; mark.setAttribute('role', 'img'); mark.setAttribute('aria-label', 'Первинний ключ'); }
          else if (fk) { mark.textContent = 'FK'; mark.className += ' sbx-fk'; mark.title = 'Зовнішній ключ → ' + fk.table + '.' + fk.to; }
          f.appendChild(mark);
          f.appendChild(make('span', 'sbx-fname', c.name));
          f.appendChild(make('span', 'sbx-ftype', c.type));
          fl.appendChild(f);
        });
        li.appendChild(fl);
      }
      ul.appendChild(li);
    });
    el.tree.appendChild(ul);
  }

  // ---------- Меню (правий клік, ⋯, довге натискання, Shift+F10) ----------

  var menuEl = null, menuBg = null, menuOpener = null;

  function closeMenu(restoreFocus) {
    if (!menuEl) return;
    menuEl.remove();
    menuBg.remove();
    menuEl = menuBg = null;
    if (menuOpener) menuOpener.setAttribute('aria-expanded', 'false');
    if (restoreFocus && menuOpener && document.body.contains(menuOpener)) menuOpener.focus();
    menuOpener = null;
  }

  // items: {label, sub, action, danger} | {heading} | {sep}
  function openMenu(items, point, opener) {
    closeMenu();
    menuOpener = opener || null;
    if (opener && opener.hasAttribute('aria-expanded')) opener.setAttribute('aria-expanded', 'true');
    menuBg = make('div', 'sbx-menu-bg');
    menuBg.addEventListener('pointerdown', function (e) { e.preventDefault(); closeMenu(true); });
    menuEl = make('div', 'sbx-menu');
    menuEl.setAttribute('role', 'menu');
    var buttons = [];
    items.forEach(function (it) {
      if (it.sep) { var s = make('div', 'sbx-menu-sep'); s.setAttribute('role', 'separator'); menuEl.appendChild(s); return; }
      if (it.heading) { var h = make('div', 'sbx-menu-h', it.heading); h.setAttribute('role', 'presentation'); menuEl.appendChild(h); return; }
      var b = make('button', 'sbx-mi' + (it.danger ? ' is-danger' : ''));
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      b.tabIndex = -1;
      var lab = make('span', 'sbx-mi-l');
      if (it.icon) {
        var ic = make('span', 'sbx-mi-i', it.icon);
        ic.setAttribute('aria-hidden', 'true');
        lab.appendChild(ic);
      }
      lab.appendChild(document.createTextNode(it.label));
      b.appendChild(lab);
      if (it.sub) b.appendChild(make('span', 'sbx-mi-s', it.sub));
      b.addEventListener('click', function () { closeMenu(false); closeSchema(); it.action(); });
      menuEl.appendChild(b);
      buttons.push(b);
    });
    menuEl.addEventListener('keydown', function (e) {
      var i = buttons.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); buttons[(i + 1) % buttons.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); buttons[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); buttons[buttons.length - 1].focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
      else if (e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
    });
    // над модальним вікном схеми меню має бути всередині нього (top layer)
    var host = root.querySelector('dialog[open]') || root;
    host.appendChild(menuBg);
    host.appendChild(menuEl);
    if (!mobile.matches && point) {
      var r = menuEl.getBoundingClientRect();
      var x = Math.min(point.x, window.innerWidth - r.width - 8);
      var y = Math.min(point.y, window.innerHeight - r.height - 8);
      menuEl.style.left = Math.max(8, x) + 'px';
      menuEl.style.top = Math.max(8, y) + 'px';
    }
    if (buttons.length) buttons[0].focus();
  }

  function anchorPoint(node) {
    var r = node.getBoundingClientRect();
    return { x: r.left, y: r.bottom + 2 };
  }

  // Шаблони з готовими прикладами значень: їх можна виконати одразу, а потім змінити
  function generated(t) {
    var n = ident(t.name);
    var cols = t.cols.length ? t.cols : [{ name: 'id', type: 'INTEGER', pk: true }];
    function val(c, num) { return /int|real|floa|doub|num|dec/i.test(c.type) ? num : "'текст'"; }
    var pk = cols.filter(function (c) { return c.pk; })[0] || cols[0];
    var data = cols.filter(function (c) { return !c.pk; })[0] || cols[0];
    var byKey = ident(pk.name) + ' = ' + val(pk, '1');
    return {
      select: 'SELECT * FROM ' + n + ';',
      selectWhere: 'SELECT * FROM ' + n + '\nWHERE ' + ident(data.name) + ' = ' + val(data, '0') + ';',
      insert: 'INSERT INTO ' + n + ' (' + cols.map(function (c) { return ident(c.name); }).join(', ') + ')\nVALUES (' +
        cols.map(function (c) { return val(c, '0'); }).join(', ') + ');',
      update: 'UPDATE ' + n + '\nSET ' + ident(data.name) + ' = ' + val(data, '0') + '\nWHERE ' + byKey + ';',
      del: 'DELETE FROM ' + n + '\nWHERE ' + byKey + ';'
    };
  }

  function tableMenuItems(name) {
    var t = findTable(info, name) || { name: name, cols: [], fks: [] };
    var n = ident(name);
    var g = generated(t);
    function run(sql) { return function () { runMenuSql(sql); }; }
    function put(sql) { return function () { insertInEditor(sql); }; }
    var s1 = g.select;
    function tpl(label, sql) { return { label: label, sub: norm(sql), icon: '✎', action: put(sql) }; }
    return [
      { heading: 'Виконати' },
      { label: 'Усі записи', sub: s1, icon: '▶', action: run(s1) },
      { label: 'Перші 10', sub: 'SELECT * FROM ' + n + ' LIMIT 10;', icon: '▶', action: run('SELECT * FROM ' + n + ' LIMIT 10;') },
      { label: 'Кількість записів', sub: 'SELECT COUNT(*) FROM ' + n + ';', icon: '▶', action: run('SELECT COUNT(*) FROM ' + n + ';') },
      { sep: true },
      { heading: 'Шаблони · вставляються в редактор' },
      tpl('SELECT', g.select),
      tpl('SELECT … WHERE', g.selectWhere),
      tpl('INSERT', g.insert),
      tpl('UPDATE … WHERE', g.update),
      tpl('DELETE … WHERE', g.del),
      { sep: true },
      {
        label: 'Видалити таблицю…', sub: 'DROP TABLE ' + n + ';', danger: true,
        action: function () {
          ask('Видалити таблицю «' + name + '» разом з усіма записами?', function () {
            runMenuSql('DROP TABLE ' + n + ';');
          }, 'Так, видалити', true);
        }
      }
    ];
  }

  function openTableMenu(name, opener, point) {
    ui.selected = name;
    openMenu(tableMenuItems(name), point || anchorPoint(opener), opener);
  }

  // Меню бази: показати схему, очистити базу
  function openBaseMenu(opener, point) {
    openMenu([
      { heading: 'Тестова таблиця ' + TEMPLATE_TABLE },
      { label: 'Створити й заповнити', sub: 'виконає CREATE TABLE + INSERT', icon: '▶', action: createTemplate },
      { label: 'Показати SQL у редакторі', sub: 'без виконання', icon: '✎', action: function () { insertInEditor(TEMPLATE_SQL); } },
      { sep: true },
      { label: 'Показати схему', sub: 'таблиці та зв\'язки між ними', action: openSchema },
      { sep: true },
      {
        label: 'Очистити базу', sub: 'видалить усі таблиці', danger: true,
        action: function () {
          ask('Усі таблиці й збережену копію бази буде видалено. Продовжити?', resetDb, 'Так, очистити', true);
        }
      }
    ], point || anchorPoint(opener), opener);
  }

  // Правий клік, Shift+F10 / клавіша меню, довге натискання на телефоні
  function attachTableMenu(node, name, opener) {
    attachContextMenu(node, opener, function (o, p) { openTableMenu(name, o, p); });
  }
  function attachContextMenu(node, opener, open) {
    node.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      open(opener, e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : null);
    });
    node.addEventListener('keydown', function (e) {
      if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
        e.preventDefault();
        open(opener, null);
      }
    });
    var timer = null, fired = false;
    node.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      fired = false;
      var p = { x: e.clientX, y: e.clientY };
      timer = setTimeout(function () { fired = true; open(opener, p); }, 550);
    });
    ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
      node.addEventListener(ev, function (e) {
        if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
        clearTimeout(timer);
      });
    });
    node.addEventListener('click', function (e) {
      if (fired) { e.preventDefault(); e.stopPropagation(); fired = false; }
    }, true);
  }

  // ---------- Тестова таблиця ----------

  function createTemplate() {
    if (tableExists(TEMPLATE_TABLE)) {
      ask('Таблиця вже є. Почати спочатку?', function () {
        runMenuSql('DROP TABLE ' + ident(TEMPLATE_TABLE) + ';\n' + TEMPLATE_SQL);
      }, 'Так, почати спочатку', true);
    } else {
      runMenuSql(TEMPLATE_SQL);
    }
  }

  // ---------- Виконання ----------

  function declaredTypeMap(sql) {
    var map = {};
    var re = /\b(?:from|join)\s+["`]?([\wЀ-ӿ]+)/gi, m;
    while ((m = re.exec(sql))) {
      var t = findTable(info, m[1]);
      if (!t) continue;
      t.cols.forEach(function (c) {
        var k = c.name.toLowerCase();
        if (map[k]) return;
        var d = c.type.toLowerCase();
        map[k] = /int/.test(d) ? 'int' : /real|floa|doub|dec|num/.test(d) ? 'real' : /char|clob|text/.test(d) ? 'text' : /blob/.test(d) ? 'blob' : '';
      });
    }
    return map;
  }

  function columnTypes(columns, rows, sql) {
    var declared = declaredTypeMap(sql);
    return columns.map(function (name, i) {
      if (declared[name.toLowerCase()]) return declared[name.toLowerCase()];
      var type = '', real = false, text = false, blob = false, num = false;
      rows.forEach(function (r) {
        var v = r[i];
        if (v === null) return;
        if (typeof v === 'number') { num = true; if (!Number.isInteger(v)) real = true; }
        else if (typeof v === 'string') text = true;
        else blob = true;
      });
      if (text) type = 'text'; else if (blob) type = 'blob'; else if (num) type = real ? 'real' : 'int';
      return type;
    });
  }

  // Виконує один запит. item: {sql, params, start, end, menu}
  function runOne(item) {
    var t0 = performance.now();
    var res = {
      sql: item.sql, menu: !!item.menu, start: item.start, end: item.end,
      paramsText: item.paramsText || '', ok: true, readOnly: isReadOnly(item.sql)
    };
    var stmt = null;
    try {
      stmt = db.prepare(item.sql);
      if (item.params) stmt.bind(item.params);
      var columns = stmt.getColumnNames();
      if (columns.length) {
        var rows = [], total = 0;
        while (stmt.step()) {
          total++;
          if (rows.length < ROW_LIMIT) rows.push(stmt.get());
        }
        res.columns = columns; res.rows = rows; res.total = total;
        res.types = columnTypes(columns, rows, item.sql);
      } else {
        stmt.step();
        res.modified = isWriteKind(item.sql) ? db.getRowsModified() : null;
      }
      stmt.free();
    } catch (e) {
      if (stmt) { try { stmt.free(); } catch (_) { /* вже звільнено */ } }
      res.ok = false;
      res.error = e && e.message ? e.message : String(e);
    }
    res.ms = performance.now() - t0;
    return res;
  }

  function runItems(items) {
    if (!db || !items.length) return;
    var results = [];
    for (var i = 0; i < items.length; i++) {
      var r = runOne(items[i]);
      results.push(r);
      if (!r.ok) break;
    }
    finishRun(results);
  }

  function finishRun(results) {
    var changed = results.some(function (r) { return r.ok && !r.readOnly; });
    results.forEach(function (r, i) {
      r.tabLabel = r.ok ? (r.columns ? 'Результат' : 'Запит') : 'Помилка';
      if (results.length > 1 && r.ok) r.tabLabel += ' ' + (i + 1);
    });
    state.results = results;
    state.messages = results.map(messageFor);
    if (changed) saveDb();
    addHistory(results);
    refreshInfo();
    var errIdx = -1;
    results.forEach(function (r, i) { if (!r.ok && errIdx < 0) errIdx = i; });
    var show = errIdx >= 0 ? errIdx : results.length - 1;
    var failed = errIdx >= 0;
    state.summary = failed ? '✗ Помилка' : '✓ Виконано запитів: ' + results.length;
    activate('r' + show);
    if (mobile.matches) el.bottom.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function messageFor(r) {
    var line = { time: fmtTime(new Date()), ok: r.ok, sql: shorten(norm(r.sql), 80), detail: '' };
    if (!r.ok) line.detail = r.error;
    else if (r.columns) line.detail = rowsText(r.total) + ', ' + fmtMs(r.ms);
    else if (r.modified !== null && r.modified !== undefined) line.detail = 'змінено рядків: ' + r.modified + ', ' + fmtMs(r.ms);
    else line.detail = 'виконано, ' + fmtMs(r.ms);
    if (r.menu) line.sql += ' (з меню)';
    return line;
  }

  // Запит з меню виконується тією самою функцією, що й запит учня
  function runMenuSql(sql) {
    var items = splitStatements(sql).map(function (s) { return { sql: s.sql, menu: true }; });
    runItems(items);
  }

  // Виконує все, що є в редакторі
  function runEditor() {
    if (!db) return;
    var list = splitStatements(el.query.value).map(function (s) {
      return { sql: s.sql, start: s.start, end: s.end };
    });
    if (!list.length) {
      state.results = [];
      state.messages = [{ time: fmtTime(new Date()), ok: false, sql: '', detail: 'Запит порожній. Введіть SQL-код' }];
      state.summary = 'Запит порожній';
      activate('msg');
      return;
    }
    guardAndRun(list);
  }

  // Захист від UPDATE/DELETE без WHERE
  function guardAndRun(list) {
    var risky = [];
    list.forEach(function (s) {
      var t = dangerousTable(s.sql);
      if (!t) return;
      var n = null;
      try { var c = db.exec('SELECT COUNT(*) FROM ' + quoteIdent(t)); n = c[0].values[0][0]; } catch (e) { /* помилку покаже виконання */ }
      if (n !== null) risky.push(n);
    });
    if (!risky.length) { collectParams(list); return; }
    var msg = 'Буде змінено всі ' + risky[0] + ' ' + plural(risky[0], ['запис', 'записи', 'записів']) + '. Продовжити?';
    if (risky.length > 1) msg = 'У ' + risky.length + ' запитах немає WHERE: буде змінено всі записи відповідних таблиць. Продовжити?';
    ask(msg, function () { collectParams(list); }, 'Так, продовжити', true);
  }

  // ---------- Параметри (:назва) ----------

  function toValue(s) {
    var t = s.trim().replace(/^(-?\d+),(\d+)$/, '$1.$2');
    if (/^-?\d+(\.\d+)?$/.test(t) && String(Number(t)) === t) return Number(t);
    return s;
  }

  function collectParams(list) {
    var names = [];
    list.forEach(function (s) {
      s.names = findParams(s.sql);
      s.names.forEach(function (n) { if (names.indexOf(n) < 0) names.push(n); });
    });
    if (!names.length) { runItems(list); return; }
    askParams(names, function (values) {
      list.forEach(function (s) {
        if (!s.names.length) return;
        s.params = {};
        var parts = [];
        s.names.forEach(function (n) { s.params[n] = toValue(values[n]); parts.push(n + ' = ' + values[n]); });
        s.paramsText = parts.join(', ');
      });
      runItems(list);
    });
  }

  function askParams(names, onOk) {
    var saved = lsJson(KEY.params, {});
    el.dlgFields.textContent = '';
    var inputs = {};
    names.forEach(function (n, i) {
      var wrap = make('div', 'sbx-field');
      var label = make('label', '', n);
      var id = 'param-' + i;
      label.setAttribute('for', id);
      var input = make('input');
      input.id = id; input.type = 'text'; input.required = true; input.autocomplete = 'off';
      input.value = saved[n] !== undefined ? saved[n] : '';
      inputs[n] = input;
      wrap.appendChild(label);
      wrap.appendChild(input);
      el.dlgFields.appendChild(wrap);
    });
    el.dlgForm.onsubmit = function (e) {
      e.preventDefault();
      var values = {};
      names.forEach(function (n) { values[n] = inputs[n].value; saved[n] = inputs[n].value; });
      lsSet(KEY.params, JSON.stringify(saved));
      el.dlg.close();
      onOk(values);
    };
    if (typeof el.dlg.showModal === 'function') el.dlg.showModal(); else el.dlg.setAttribute('open', '');
    var first = inputs[names[0]];
    first.focus(); first.select();
  }

  // ---------- Збереження бази ----------

  function setForeignKeys() {
    try { db.run('PRAGMA foreign_keys = ON;'); } catch (e) { /* не критично */ }
  }

  function saveDb() {
    try {
      var data = db.export();   // після export() sql.js перевідкриває базу: PRAGMA скидається
      setForeignKeys();
      var bin = '';
      for (var i = 0; i < data.length; i += 0x8000) {
        bin += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000));
      }
      if (!lsSet(KEY.db, btoa(bin))) throw new Error('quota');
      saveFailed = false;
    } catch (e) {
      setForeignKeys();
      saveFailed = true;
    }
  }

  function restoreDb() {
    var raw = lsGet(KEY.db);
    if (raw) {
      try {
        var bin = atob(raw), arr = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        var restored = new SQL.Database(arr);
        restored.exec('SELECT count(*) FROM sqlite_master');
        return restored;
      } catch (e) { lsDel(KEY.db); }
    }
    return new SQL.Database();
  }

  function resetDb() {
    if (db) db.close();
    db = new SQL.Database();
    setForeignKeys();
    lsDel(KEY.db);
    ui.selected = null;
    dgPos = {};
    state.results = [];
    state.messages = [{ time: fmtTime(new Date()), ok: true, sql: '', detail: 'Базу очищено (разом із збереженою копією). Історію запитів збережено.' }];
    state.summary = 'Базу очищено';
    refreshInfo();
    activate('msg');
  }

  // ---------- Помилки: підказки ----------

  function friendlyHint(message, sql) {
    var m = message.toLowerCase();
    var first = kindOf(sql || '');
    if (first === 'describe' || first === 'desc') return 'У SQLite немає DESCRIBE. Структуру таблиці показує PRAGMA table_info(назва_таблиці); або пункт «Структура» в меню таблиці';
    if (first === 'show') return 'У SQLite немає команди SHOW. Таблиці видно в лівій панелі, а структуру показує PRAGMA table_info(назва_таблиці);';
    if (first === 'use') return 'Команда USE тут не потрібна: база вже відкрита';
    if (m.indexOf('no such column') !== -1) {
      var word = message.replace(/^[^:]*:\s*/, '').replace(/^"|"$/g, '');
      if (/[Ѐ-ӿ]/.test(word)) return 'Можливо, забули лапки: \'' + word + '\'?';
      return 'Немає такого поля. Перевірте назву або лапки навколо тексту';
    }
    if (m.indexOf('no such table') !== -1) return 'Немає такої таблиці. Можливо, її ще не створено';
    if (m.indexOf('already exists') !== -1) return 'Таблиця вже існує. Щоб почати спочатку, відкрийте меню бази (⋯ біля заголовка «База») і виберіть «Очистити базу» або «Створити й заповнити»';
    if (m.indexOf('syntax error') !== -1) return 'Помилка в записі запиту: перевірте коми, лапки й крапку з комою';
    if (m.indexOf('unique constraint failed') !== -1) return 'Запис з таким ключем уже є';
    if (m.indexOf('foreign key constraint failed') !== -1) return 'У пов\'язаній таблиці немає запису з таким ключем';
    return '';
  }

  // ---------- Вкладки та панель результатів ----------

  function tabList() {
    var tabs = state.results.map(function (r, i) { return { id: 'r' + i, label: r.tabLabel, err: !r.ok }; });
    tabs.push({ id: 'msg', label: 'Повідомлення' }, { id: 'hist', label: 'Історія' });
    return tabs;
  }

  function activate(id, focusTab) {
    state.active = id;
    if (id.charAt(0) === 'r') state.lastResult = id;
    selectedCell = null;
    renderTabs(focusTab);
    renderPanel();
    updateStatus();
  }

  function renderTabs(focusTab) {
    el.tabs.textContent = '';
    tabList().forEach(function (t) {
      var b = make('button', 'sbx-tab' + (t.err ? ' is-err' : ''), t.label);
      b.type = 'button';
      b.id = 'tab-' + t.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', t.id === state.active ? 'true' : 'false');
      b.setAttribute('aria-controls', 'panel');
      b.tabIndex = t.id === state.active ? 0 : -1;
      b.addEventListener('click', function () { activate(t.id); });
      el.tabs.appendChild(b);
      if (focusTab && t.id === state.active) b.focus();
    });
    el.panel.setAttribute('aria-labelledby', 'tab-' + state.active);
  }

  function activeResult() {
    if (state.active.charAt(0) !== 'r') return null;
    return state.results[Number(state.active.slice(1))] || null;
  }

  function updateStatus() {
    var r = activeResult();
    var text = state.summary;
    el.stCell.textContent = '';
    if (r) {
      if (!r.ok) text = '✗ Помилка · ' + fmtMs(r.ms);
      else if (r.columns) {
        text = '✓ ' + rowsText(r.total) + ' · ' + colsText(r.columns.length) + ' · ' + fmtMs(r.ms);
        if (r.total > r.rows.length) text += ' (показано перші ' + r.rows.length + ')';
      } else if (r.modified !== null && r.modified !== undefined) text = '✓ Змінено рядків: ' + r.modified + ' · ' + fmtMs(r.ms);
      else text = '✓ Запит виконано · ' + fmtMs(r.ms);
    }
    if (saveFailed) text += ' · ⚠ базу не вдалося зберегти в браузері';
    el.stMsg.textContent = text;
    var can = !!(r && r.ok && r.columns);
    el.copy.disabled = !can;
    el.csv.disabled = !can;
  }

  function renderPanel() {
    el.panel.textContent = '';
    var id = state.active;
    if (id === 'msg') panelMessages();
    else if (id === 'hist') panelHistory();
    else { var r = activeResult(); if (r) panelResult(r); }
  }

  function panelMessages() {
    if (!state.messages.length) {
      el.panel.appendChild(make('p', 'sbx-muted sbx-pad', 'Тут з\'являться повідомлення про виконання. Напишіть запит і натисніть «Виконати».'));
      return;
    }
    var ul = make('ul', 'sbx-msgs');
    state.messages.forEach(function (m) {
      var li = make('li', m.ok ? '' : 'is-err');
      li.appendChild(make('span', 'sbx-msg-t', m.time));
      li.appendChild(make('span', 'sbx-msg-m', m.ok ? '✓' : '✗'));
      var body = make('span', 'sbx-msg-b');
      if (m.sql) body.appendChild(make('code', '', m.sql));
      body.appendChild(make('span', '', (m.sql ? ' — ' : '') + m.detail));
      li.appendChild(body);
      ul.appendChild(li);
    });
    el.panel.appendChild(ul);
  }

  function panelResult(r) {
    var wrap = make('div', 'sbx-res');
    var head = make('div', 'sbx-res-head');
    var q = make('pre', 'sbx-res-q');
    q.innerHTML = highlightLines(r.sql).map(function (l) { return l; }).join('\n');
    head.appendChild(q);
    if (r.menu) head.appendChild(make('span', 'sbx-badge', 'з меню'));
    wrap.appendChild(head);
    if (r.paramsText) wrap.appendChild(make('p', 'sbx-params', 'Параметри: ' + r.paramsText));

    if (!r.ok) {
      var box = make('div', 'error');
      var hint = friendlyHint(r.error, r.sql);
      if (hint) box.appendChild(make('p', 'error-hint', hint));
      box.appendChild(make('p', 'error-text', r.error));
      if (!r.menu && r.start !== undefined) {
        var fix = make('button', 'btn sbx-b-small', 'Виправити в редакторі');
        fix.type = 'button';
        fix.addEventListener('click', function () { focusStatement(r); });
        box.appendChild(fix);
      }
      wrap.appendChild(box);
    } else if (r.columns) {
      if (r.rows.length === 1 && r.columns.length === 1) {
        var big = make('div', 'sbx-big');
        big.appendChild(make('div', 'sbx-big-v', r.rows[0][0] === null ? 'NULL' : String(r.rows[0][0])));
        big.appendChild(make('div', 'sbx-big-l', r.columns[0]));
        wrap.appendChild(big);
      } else {
        wrap.appendChild(buildTable(r));
      }
    } else {
      var msg = r.modified !== null && r.modified !== undefined ? '✓ Запит виконано. Змінено рядків: ' + r.modified : '✓ Запит виконано';
      wrap.appendChild(make('p', 'res-ok', msg));
    }
    el.panel.appendChild(wrap);
  }

  function buildTable(r) {
    var wrap = make('div', 'table-wrap');
    var table = make('table', 'result');
    var thead = make('thead'), trh = make('tr');
    r.columns.forEach(function (c, i) {
      var th = make('th', r.types[i] === 'int' || r.types[i] === 'real' ? 'num' : '');
      th.scope = 'col';
      th.appendChild(make('span', 'cn', c));
      if (r.types[i]) th.appendChild(make('span', 'ct', r.types[i]));
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);
    var tbody = make('tbody');
    r.rows.forEach(function (row, ri) {
      var tr = make('tr');
      row.forEach(function (v, ci) {
        var td = make('td');
        td.setAttribute('data-r', ri);
        td.setAttribute('data-c', ci);
        if (v === null) { td.className = 'null'; td.textContent = 'NULL'; }
        else if (typeof v === 'number') { td.className = 'num'; td.textContent = String(v); }
        else if (typeof v === 'string') td.textContent = v;
        else td.textContent = '[BLOB, ' + v.length + ' Б]';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    wrap.addEventListener('click', function (e) {
      var td = e.target.closest('td');
      if (!td) return;
      var prev = wrap.querySelector('td.sel');
      if (prev) prev.classList.remove('sel');
      td.classList.add('sel');
      var ri = Number(td.getAttribute('data-r')), ci = Number(td.getAttribute('data-c'));
      el.stCell.textContent = 'Рядок ' + (ri + 1) + ' · ' + r.columns[ci] + ': ' + shorten(td.textContent, 40);
    });
    return wrap;
  }

  function focusStatement(r) {
    var ta = el.query;
    ta.focus();
    ta.setSelectionRange(r.start, r.end);
    var line = ta.value.slice(0, r.start).split('\n').length - 1;
    ta.scrollTop = Math.max(0, line * LINE_H - ta.clientHeight / 3);
    syncScroll();
    updateCaretLine();
    ta.scrollIntoView({ block: 'nearest' });
  }

  // ---------- Копіювання та CSV ----------

  function cellText(v) { return v === null ? '' : typeof v === 'object' ? '[BLOB]' : String(v); }

  function copyResult() {
    var r = activeResult();
    if (!r || !r.columns) return;
    var lines = [r.columns.join('\t')];
    r.rows.forEach(function (row) { lines.push(row.map(function (v) { return cellText(v).replace(/[\t\n]/g, ' '); }).join('\t')); });
    var text = lines.join('\n');
    var done = function () { flashStatus('Скопійовано'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    } else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) {
    var ta = make('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* немає доступу до буфера */ }
    document.body.removeChild(ta);
  }
  function flashStatus(text) {
    var old = el.stMsg.textContent;
    el.stMsg.textContent = text;
    setTimeout(updateStatus, 1500);
    return old;
  }

  function csvCell(v) {
    var s = cellText(v);
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadFile(name, text, type) {
    var blob = new Blob(['﻿' + text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadCsv() {
    var r = activeResult();
    if (!r || !r.columns) return;
    var lines = [r.columns.map(csvCell).join(';')];
    r.rows.forEach(function (row) { lines.push(row.map(csvCell).join(';')); });
    var d = new Date();
    downloadFile('result-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.csv', lines.join('\r\n'), 'text/csv;charset=utf-8');
  }

  // ---------- Історія ----------

  function loadHistory() {
    var data = lsJson(KEY.history, []);
    history = Array.isArray(data) ? data.filter(function (h) {
      return h && typeof h.sql === 'string' && typeof h.time === 'number';
    }) : [];
  }
  function saveHistory() { lsSet(KEY.history, JSON.stringify(history)); }

  function addHistory(results) {
    var now = Date.now();
    results.forEach(function (r) {
      history.push({ sql: r.sql.trim(), ok: r.ok, time: now, menu: r.menu, params: r.paramsText });
    });
    if (history.length > HISTORY_LIMIT) history = history.slice(-HISTORY_LIMIT);
    saveHistory();
  }

  function panelHistory() {
    var bar = make('div', 'sbx-hbar');
    var dl = make('button', 'btn sbx-b-small', 'Скачати мої запити (.txt)');
    dl.type = 'button';
    dl.addEventListener('click', downloadHistory);
    var clr = make('button', 'btn sbx-b-small', 'Очистити історію');
    clr.type = 'button';
    clr.addEventListener('click', function () {
      if (!history.length) return;
      ask('Очистити всю історію запитів? Це не можна скасувати.', function () {
        history = [];
        saveHistory();
        renderPanel();
      }, 'Так, очистити', true);
    });
    bar.appendChild(dl);
    bar.appendChild(clr);
    el.panel.appendChild(bar);
    if (!history.length) { el.panel.appendChild(make('p', 'sbx-muted sbx-pad', 'Історія порожня.')); return; }
    var ul = make('ul', 'sbx-history');
    for (var i = history.length - 1; i >= 0; i--) {
      (function (item) {
        var li = make('li');
        var btn = make('button');
        btn.type = 'button';
        btn.title = 'Додати запит у редактор';
        var mark = make('span', 'h-mark ' + (item.ok ? 'h-ok' : 'h-err'), item.ok ? '✓' : '✗');
        mark.setAttribute('aria-label', item.ok ? 'виконано' : 'помилка');
        btn.appendChild(mark);
        btn.appendChild(make('span', 'h-sql', norm(item.sql) + (item.params ? '   [' + item.params + ']' : '')));
        if (item.menu) btn.appendChild(make('span', 'sbx-badge', 'з меню'));
        btn.addEventListener('click', function () { insertInEditor(item.sql); });
        li.appendChild(btn);
        ul.appendChild(li);
      })(history[i]);
    }
    el.panel.appendChild(ul);
  }

  function downloadHistory() {
    var now = new Date();
    var lines = ['-- SQL-пісочниця: мої запити', '-- Дата: ' + fmtDate(now), ''];
    history.forEach(function (h) {
      if (!h.ok || h.menu) return;   // запити з меню у файл не потрапляють
      lines.push('-- [' + fmtTime(new Date(h.time)) + ']' + (h.params ? ' параметри: ' + h.params : ''));
      lines.push(h.sql.trim());
      lines.push('');
    });
    downloadFile('my-sql-queries-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.txt',
      lines.join('\r\n'), 'text/plain;charset=utf-8');
  }

  // ---------- Схема зв'язків між таблицями ----------

  var SVGNS = 'http://www.w3.org/2000/svg';
  var CARD_W = 210, GAP_X = 90, GAP_Y = 36, DG_PAD = 24;

  function openSchema() {
    if (!el.sdlg.open) el.sdlg.showModal();
    renderSchema();
  }
  function closeSchema() { if (el.sdlg.open) el.sdlg.close(); }

  // Малює діаграму у вікні схеми (вікно вже відкрите, тому розміри карток відомі)
  function renderSchema() {
    el.sbar.textContent = '';
    el.sbody.textContent = '';
    if (!info.length) {
      el.sbody.appendChild(make('p', 'sbx-muted sbx-pad', 'База порожня. Схема з\'явиться, коли в базі будуть таблиці.'));
      return;
    }
    var hasLinks = info.some(function (t) { return t.fks.length; });
    var bar = el.sbar;
    function zoomBtn(label, title, fn) {
      var b = make('button', 'btn sbx-b-small', label);
      b.type = 'button'; b.title = title; b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      bar.appendChild(b);
    }
    function zoomBy(delta) { ui.dgScale = Math.min(2, Math.max(0.4, +(ui.dgScale + delta).toFixed(2))); applyScale(); }
    zoomBtn('−', 'Зменшити', function () { zoomBy(-0.1); });
    zoomBtn('+', 'Збільшити', function () { zoomBy(0.1); });
    zoomBtn('100%', 'Звичайний масштаб', function () { ui.dgScale = 1; applyScale(); });
    el.sbody.appendChild(make('p', 'sbx-hint sbx-dg-note', hasLinks
      ? 'Перетягуйте картки. Наведіть на лінію, щоб побачити зв\'язок. Масштаб: кнопки або Ctrl/Cmd + коліщатко'
      : 'Зв\'язків між таблицями немає. Їх задають так: FOREIGN KEY (поле) REFERENCES таблиця(поле)'));

    var scroll = make('div', 'sbx-dg-scroll');
    var sizer = make('div', 'sbx-dg-sizer');
    var canvas = make('div', 'sbx-dg-canvas');
    var svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'sbx-dg-svg');
    svg.setAttribute('aria-hidden', 'true');
    canvas.appendChild(svg);
    var tip = make('div', 'sbx-dg-tip');
    tip.hidden = true;
    canvas.appendChild(tip);
    sizer.appendChild(canvas);
    scroll.appendChild(sizer);
    el.sbody.appendChild(scroll);
    scroll.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;   // звичайне коліщатко лише гортає; ущипування на тачпаді дає ctrl+wheel
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.1 : -0.1);
    }, { passive: false });

    var cards = {};
    info.forEach(function (t) {
      var card = make('div', 'sbx-card');
      card.style.width = CARD_W + 'px';
      card.tabIndex = 0;
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', 'Таблиця ' + t.name + ', записів: ' + t.count);
      var head = make('div', 'sbx-card-h');
      head.appendChild(make('span', 'sbx-card-n', t.name));
      head.appendChild(make('span', 'sbx-count', String(t.count)));
      card.appendChild(head);
      var ul = make('ul', 'sbx-card-f');
      var rows = {};
      t.cols.forEach(function (c) {
        var isFk = t.fks.some(function (f) { return f.from === c.name; });
        var li = make('li');
        li.appendChild(make('span', 'sbx-mark' + (isFk && !c.pk ? ' sbx-fk' : ''), c.pk ? '🔑' : isFk ? 'FK' : ''));
        li.appendChild(make('span', 'sbx-fname', c.name));
        li.appendChild(make('span', 'sbx-ftype', c.type));
        ul.appendChild(li);
        rows[c.name] = li;
      });
      card.appendChild(ul);
      canvas.appendChild(card);
      cards[t.name] = { el: card, rows: rows, t: t };
    });

    // Автоматична сітка: таблиці з найбільшою кількістю зв'язків першими
    function degree(t) {
      var d = t.fks.length;
      info.forEach(function (o) { o.fks.forEach(function (f) { if (f.table.toLowerCase() === t.name.toLowerCase() && o !== t) d++; }); });
      return d;
    }
    var order = info.slice().sort(function (a, b) { return degree(b) - degree(a); });
    var colsN = order.length <= 2 ? order.length : Math.ceil(Math.sqrt(order.length));
    var y = DG_PAD, rowH = 0;
    order.forEach(function (t, i) {
      var c = i % colsN;
      if (c === 0 && i > 0) { y += rowH + GAP_Y; rowH = 0; }
      if (!dgPos[t.name]) dgPos[t.name] = { x: DG_PAD + c * (CARD_W + GAP_X), y: y };
      rowH = Math.max(rowH, cards[t.name].el.offsetHeight);
    });

    function place() {
      var maxX = 0, maxY = 0;
      Object.keys(cards).forEach(function (n) {
        var cd = cards[n], p = dgPos[n];
        cd.el.style.left = p.x + 'px';
        cd.el.style.top = p.y + 'px';
        maxX = Math.max(maxX, p.x + CARD_W);
        maxY = Math.max(maxY, p.y + cd.el.offsetHeight);
      });
      var w = maxX + DG_PAD + 20, h = maxY + DG_PAD;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      svg.setAttribute('width', w);
      svg.setAttribute('height', h);
      canvas._w = w; canvas._h = h;
      applyScale();
    }
    function applyScale() {
      canvas.style.transform = 'scale(' + ui.dgScale + ')';
      sizer.style.width = (canvas._w * ui.dgScale) + 'px';
      sizer.style.height = (canvas._h * ui.dgScale) + 'px';
    }
    function side(cd, rowEl) {
      return { top: cd.el.offsetTop + rowEl.offsetTop + rowEl.offsetHeight / 2, left: cd.el.offsetLeft, right: cd.el.offsetLeft + CARD_W };
    }
    function svgEl(name, attrs) {
      var n = document.createElementNS(SVGNS, name);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      return n;
    }
    function drawLines() {
      svg.textContent = '';
      info.forEach(function (t) {
        t.fks.forEach(function (fk) {
          var a = cards[t.name], b = cards[findTable(info, fk.table) ? findTable(info, fk.table).name : ''];
          if (!b || !a.rows[fk.from] || !b.rows[fk.to]) return;
          var A = side(a, a.rows[fk.from]), B = side(b, b.rows[fk.to]);
          var x1, x2, d1, d2, k = 40;
          if (a === b) { x1 = A.right; x2 = B.right; d1 = d2 = 1; }
          else if (A.right + 20 <= B.left) { x1 = A.right; x2 = B.left; d1 = 1; d2 = -1; k = Math.max(40, (x2 - x1) / 2); }
          else if (B.right + 20 <= A.left) { x1 = A.left; x2 = B.right; d1 = -1; d2 = 1; k = Math.max(40, (x1 - x2) / 2); }
          else { x1 = A.left; x2 = B.left; d1 = d2 = -1; }
          var path = 'M' + x1 + ' ' + A.top + ' C' + (x1 + d1 * k) + ' ' + A.top + ' ' + (x2 + d2 * k) + ' ' + B.top + ' ' + x2 + ' ' + B.top;
          var label = t.name + '.' + fk.from + ' → ' + b.t.name + '.' + fk.to;
          var g = svgEl('g', { 'class': 'sbx-dg-link', tabindex: '0', role: 'img', 'aria-label': 'Зв\'язок ' + label });
          g.appendChild(svgEl('path', { d: path, 'class': 'ln-vis' }));
          g.appendChild(svgEl('path', { d: path, 'class': 'ln-hit' }));
          var many = svgEl('text', { x: x1 + d1 * 12, y: A.top - 6, 'class': 'ln-m', 'text-anchor': 'middle' });
          many.textContent = '∞';
          var one = svgEl('text', { x: x2 + d2 * 12, y: B.top - 6, 'class': 'ln-m', 'text-anchor': 'middle' });
          one.textContent = '1';
          g.appendChild(many);
          g.appendChild(one);
          var rowA = a.rows[fk.from], rowB = b.rows[fk.to];
          function on(e) {
            rowA.classList.add('hl'); rowB.classList.add('hl'); g.classList.add('hl');
            tip.textContent = label;
            tip.hidden = false;
            var p = e && e.clientX !== undefined && canvas.getBoundingClientRect();
            if (p) {
              tip.style.left = ((e.clientX - p.left) / ui.dgScale + 12) + 'px';
              tip.style.top = ((e.clientY - p.top) / ui.dgScale + 12) + 'px';
            } else {
              tip.style.left = ((x1 + x2) / 2) + 'px';
              tip.style.top = ((A.top + B.top) / 2) + 'px';
            }
          }
          function off() { rowA.classList.remove('hl'); rowB.classList.remove('hl'); g.classList.remove('hl'); tip.hidden = true; }
          g.addEventListener('mouseenter', on);
          g.addEventListener('mousemove', on);
          g.addEventListener('mouseleave', off);
          g.addEventListener('focus', function () { on(null); });
          g.addEventListener('blur', off);
          svg.appendChild(g);
        });
      });
    }

    // Перетягування карток; короткий клік відкриває меню таблиці
    Object.keys(cards).forEach(function (n) {
      var cd = cards[n], drag = null;
      cd.el.addEventListener('pointerdown', function (e) {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        drag = { x: e.clientX, y: e.clientY, px: dgPos[n].x, py: dgPos[n].y, moved: false };
        cd.el.setPointerCapture(e.pointerId);
      });
      cd.el.addEventListener('pointermove', function (e) {
        if (!drag) return;
        var dx = (e.clientX - drag.x) / ui.dgScale, dy = (e.clientY - drag.y) / ui.dgScale;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true;
        dgPos[n] = { x: Math.max(0, Math.round(drag.px + dx)), y: Math.max(0, Math.round(drag.py + dy)) };
        place();
        drawLines();
      });
      cd.el.addEventListener('pointerup', function (e) {
        var d = drag; drag = null;
        if (d && !d.moved) openTableMenu(n, cd.el, { x: e.clientX, y: e.clientY });
      });
      cd.el.addEventListener('pointercancel', function () { drag = null; });
      cd.el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          openTableMenu(n, cd.el);
        }
      });
    });

    place();
    drawLines();
  }

  // ---------- Висота нижньої панелі ----------

  function setBottomH(px) {
    var max = Math.max(160, el.editor.parentNode.clientHeight - 220);
    px = Math.max(120, Math.min(max, px));
    ui.bottomH = px;
    root.style.setProperty('--sbx-bottom-h', px + 'px');
    return px;
  }
  function bindResizer() {
    var drag = null;
    el.resizer.addEventListener('pointerdown', function (e) {
      drag = { y: e.clientY, h: el.bottom.offsetHeight };
      el.resizer.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.resizer.addEventListener('pointermove', function (e) {
      if (drag) setBottomH(drag.h - (e.clientY - drag.y));
    });
    function end() { if (drag) { drag = null; lsSet(KEY.ui, JSON.stringify({ bottomH: ui.bottomH })); } }
    el.resizer.addEventListener('pointerup', end);
    el.resizer.addEventListener('pointercancel', end);
    el.resizer.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      setBottomH(el.bottom.offsetHeight + (e.key === 'ArrowUp' ? 24 : -24));
      lsSet(KEY.ui, JSON.stringify({ bottomH: ui.bottomH }));
    });
  }

  // ---------- Підключення подій ----------

  function bind() {
    el.run.addEventListener('click', runEditor);
    el.runM.addEventListener('click', runEditor);

    el.query.addEventListener('input', onEditorChange);
    el.query.addEventListener('scroll', syncScroll);
    ['keyup', 'click', 'select', 'focus'].forEach(function (ev) { el.query.addEventListener(ev, updateCaretLine); });
    document.addEventListener('selectionchange', function () { if (document.activeElement === el.query) updateCaretLine(); });
    el.query.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        runEditor();
      }
    });

    el.baseMore.addEventListener('click', function () { openBaseMenu(el.baseMore); });
    attachContextMenu(el.baseMore.parentNode, el.baseMore, openBaseMenu);

    el.confirmYes.addEventListener('click', function () { var f = pendingYes; closeAsk(); if (f) f(); });
    el.confirmNo.addEventListener('click', closeAsk);
    el.sclose.addEventListener('click', closeSchema);
    // клік повз вікно (по затемненій розмитій підкладці) закриває схему і підтвердження
    [el.sdlg, el.cdlg].forEach(function (d) {
      d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
    });

    el.tabs.addEventListener('keydown', function (e) {
      var list = tabList(), idx = -1;
      list.forEach(function (t, i) { if (t.id === state.active) idx = i; });
      var next = -1;
      if (e.key === 'ArrowRight') next = (idx + 1) % list.length;
      else if (e.key === 'ArrowLeft') next = (idx - 1 + list.length) % list.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = list.length - 1;
      if (next < 0) return;
      e.preventDefault();
      activate(list[next].id, true);
    });

    el.copy.addEventListener('click', copyResult);
    el.csv.addEventListener('click', downloadCsv);
    $('params-cancel').addEventListener('click', function () { el.dlg.close(); });
    bindResizer();
  }

  function init() {
    loadHistory();
    var savedUi = lsJson(KEY.ui, {});
    if (savedUi && savedUi.bottomH) setBottomH(Number(savedUi.bottomH));
    var savedText = lsGet(KEY.editor);
    if (savedText) el.query.value = savedText;
    root.classList.add('sbx-hl-on');
    renderHighlight();
    bind();
    renderTabs();
    renderPanel();
    updateStatus();

    if (typeof initSqlJs !== 'function') {
      state.results = [{ ok: false, sql: '', error: 'Не вдалося завантажити SQL-рушій (vendor/sql-wasm.js).', menu: true, ms: 0, tabLabel: 'Помилка' }];
      activate('r0');
      return;
    }
    var vendorPath = window.SQL_VENDOR_PATH || 'vendor/';
    initSqlJs({ locateFile: function (file) { return vendorPath + file; } })
      .then(function (lib) {
        SQL = lib;
        db = restoreDb();
        setForeignKeys();
        refreshInfo();
        el.run.disabled = el.runM.disabled = false;
        state.summary = info.length ? 'Базу відновлено з браузера' : 'Готово';
        updateStatus();
        document.documentElement.setAttribute('data-ready', '1');
      })
      .catch(function (err) {
        state.results = [{
          ok: false, sql: '', menu: true, ms: 0, tabLabel: 'Помилка',
          error: 'Не вдалося запустити SQL-рушій: ' + (err && err.message ? err.message : err) +
            '. Якщо сторінку відкрито як файл (file://), запустіть її через локальний сервер або відкрийте з GitHub Pages.'
        }];
        activate('r0');
      });
  }

  init();
})();
