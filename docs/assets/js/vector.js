(function () {
  "use strict";

  // Збільшення зразка на сторінках наборів: зображення в картці стає кнопкою,
  // яка відкриває його у вікні <dialog> на цій самій сторінці (не в новій вкладці).
  // Без JS зразок просто лишається малюнком у картці.
  function initZoom() {
    var images = document.querySelectorAll(".vcard__sample img");
    if (!images.length || typeof HTMLDialogElement === "undefined") return;

    var dialog = document.createElement("dialog");
    dialog.className = "vlightbox";
    dialog.setAttribute("aria-label", "Збільшене зображення");

    var big = document.createElement("img");
    big.className = "vlightbox__img";
    big.alt = "";

    var close = document.createElement("button");
    close.type = "button";
    close.className = "vlightbox__close";
    close.textContent = "Закрити";

    dialog.appendChild(big);
    dialog.appendChild(close);
    document.body.appendChild(dialog);

    close.addEventListener("click", function () {
      dialog.close();
    });
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });

    images.forEach(function (img) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "vcard__zoom";
      button.setAttribute("aria-label", "Збільшити зображення: " + img.alt);
      img.parentNode.insertBefore(button, img);
      button.appendChild(img);

      var hint = document.createElement("span");
      hint.className = "vcard__zoom-hint";
      hint.setAttribute("aria-hidden", "true");
      hint.textContent = "Збільшити";
      button.appendChild(hint);

      button.addEventListener("click", function () {
        big.src = img.currentSrc || img.src;
        big.alt = img.alt;
        dialog.showModal();
      });
    });
  }

  // Підказка «Як намалювати» відкривається панеллю поверх карток. Закриваємо її
  // клавішею Esc або кліком поза нею; відкриття іншої підказки закриває попередню.
  function initHints() {
    var hints = document.querySelectorAll(".vcard__hint");
    if (!hints.length) return;

    function closeAll(except) {
      hints.forEach(function (d) {
        if (d !== except) d.removeAttribute("open");
      });
    }

    hints.forEach(function (d) {
      d.addEventListener("toggle", function () {
        if (d.open) closeAll(d);
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".vcard__hint")) closeAll(null);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      hints.forEach(function (d) {
        if (d.open) {
          d.removeAttribute("open");
          var summary = d.querySelector("summary");
          if (summary) summary.focus();
        }
      });
    });
  }

  // Кнопка «Випадкова картка» на хабі «Векторна графіка».
  // Список карток бере з прихованого <ul id="vector-card-list">, який
  // будує Jekyll з _data/vector.yml. Без JS хаб лишається повноцінним.
  function init() {
    initZoom();
    initHints();

    var button = document.getElementById("vector-random-btn");
    var result = document.getElementById("vector-random-result");
    var list = document.getElementById("vector-card-list");
    if (!button || !result || !list) return;

    var items = list.querySelectorAll("a");
    if (!items.length) return;

    var last = -1;

    button.addEventListener("click", function () {
      var i = Math.floor(Math.random() * items.length);
      if (items.length > 1 && i === last) {
        i = (i + 1 + Math.floor(Math.random() * (items.length - 1))) % items.length;
      }
      last = i;

      var source = items[i];
      var link = document.createElement("a");
      link.href = source.getAttribute("href");
      link.textContent = source.getAttribute("data-title");

      result.textContent = "";
      result.appendChild(document.createTextNode("Твоя картка: "));
      result.appendChild(link);
      result.appendChild(
        document.createTextNode(" (набір «" + source.getAttribute("data-track") + "»)")
      );
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
