(function () {
  "use strict";

  function addCopyButtons() {
    var blocks = document.querySelectorAll(".code-block");
    blocks.forEach(function (block) {
      var codeEl = block.querySelector("code") || block.querySelector("pre");
      if (!codeEl || !navigator.clipboard) return;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "code-block__copy";
      button.textContent = "Копіювати";
      button.setAttribute("aria-live", "polite");

      button.addEventListener("click", function () {
        navigator.clipboard.writeText(codeEl.textContent).then(function () {
          var original = "Копіювати";
          button.textContent = "Скопійовано";
          setTimeout(function () {
            button.textContent = original;
          }, 2000);
        });
      });

      block.appendChild(button);
    });
  }

  var GRADES = [6, 7, 8, 9, 10, 11];
  var STORAGE_KEY = "kod-uroky-selected-grade";

  function readStoredGrade() {
    try {
      var v = parseInt(window.localStorage.getItem(STORAGE_KEY), 10);
      return GRADES.indexOf(v) !== -1 ? v : null;
    } catch (e) {
      return null;
    }
  }

  function storeGrade(n) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(n));
    } catch (e) {
      /* private mode or storage disabled — ignore */
    }
  }

  function initHomeView() {
    var topicsPanel = document.getElementById("topics");
    var classesPanel = document.getElementById("classes-section");
    if (!topicsPanel || !classesPanel) return;

    var tabTopics = document.getElementById("tab-topics");
    var tabClasses = document.getElementById("tab-classes");
    var hint = document.getElementById("view-hint");
    var gradeChips = classesPanel.querySelectorAll(".grade-chip");
    var gradePanels = classesPanel.querySelectorAll(".grade-panel");

    function setActiveGrade(n) {
      gradeChips.forEach(function (chip) {
        var active = chip.id === "grade-chip-" + n;
        chip.setAttribute("aria-selected", active ? "true" : "false");
      });
      gradePanels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.id === "grade-" + n);
      });
      tabClasses.setAttribute("href", "#grade-" + n);
    }

    function showTopics() {
      topicsPanel.classList.add("is-active");
      classesPanel.classList.remove("is-active");
      tabTopics.setAttribute("aria-selected", "true");
      tabClasses.setAttribute("aria-selected", "false");
      hint.textContent = "Розділи згруповано за предметами";
    }

    function showClasses(n) {
      topicsPanel.classList.remove("is-active");
      classesPanel.classList.add("is-active");
      tabTopics.setAttribute("aria-selected", "false");
      tabClasses.setAttribute("aria-selected", "true");
      hint.textContent = "Оберіть клас — теми можуть повторюватись у кількох класах";
      setActiveGrade(n);
    }

    function applyHash() {
      var hash = window.location.hash;
      var gradeMatch = /^#grade-(\d+)$/.exec(hash);
      if (gradeMatch && GRADES.indexOf(parseInt(gradeMatch[1], 10)) !== -1) {
        var n = parseInt(gradeMatch[1], 10);
        showClasses(n);
        storeGrade(n);
      } else {
        showTopics();
      }
    }

    var defaultGrade = readStoredGrade() || GRADES[0];
    tabClasses.setAttribute("href", "#grade-" + defaultGrade);

    [tabTopics, tabClasses].concat(Array.prototype.slice.call(gradeChips)).forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        var href = link.getAttribute("href");
        if (window.location.hash === href) {
          applyHash();
        } else {
          window.location.hash = href;
        }
      });
    });

    window.addEventListener("hashchange", applyHash);
    applyHash();
  }

  function enableArrowKeyTabs(container, selector) {
    if (!container) return;
    container.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var items = Array.prototype.slice.call(container.querySelectorAll(selector));
      var i = items.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      var next = e.key === "ArrowRight" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
      items[next].click();
    });
  }

  function init() {
    addCopyButtons();
    initHomeView();
    enableArrowKeyTabs(document.querySelector(".view-switcher"), ".view-tab");
    enableArrowKeyTabs(document.querySelector(".grade-chips"), ".grade-chip");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
