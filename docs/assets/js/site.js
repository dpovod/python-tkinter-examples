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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addCopyButtons);
  } else {
    addCopyButtons();
  }
})();
