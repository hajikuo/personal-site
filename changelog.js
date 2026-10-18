(function () {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("changelogTheme");
  const meta = document.getElementById("themeColor");
  const year = document.getElementById("year");
  const list = document.getElementById("changelogFull");
  const labels = {
    feature: "功能",
    design: "设计",
    fix: "修复",
    release: "上线",
    update: "更新",
  };

  if (year) year.textContent = String(new Date().getFullYear());

  function setTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    if (meta) meta.setAttribute("content", next === "dark" ? "#10110f" : "#f3efe5");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(next === "dark"));
      toggle.setAttribute("aria-label", next === "dark" ? "切换到浅色模式" : "切换到深色模式");
    }
    if (persist) {
      try {
        localStorage.setItem("theme", next);
      } catch (error) {
        /* Storage is optional. */
      }
    }
  }

  setTheme(root.getAttribute("data-theme"), false);
  if (toggle) {
    toggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[character];
    });
  }

  function render(entries) {
    if (!list || !Array.isArray(entries) || entries.length === 0) return;
    list.innerHTML = entries
      .map(function (entry) {
        const items = (entry.items || [])
          .map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
          })
          .join("");
        return (
          '<article class="change-item">' +
          '<div class="change-item__meta"><span class="change-version">v' +
          escapeHtml(entry.version || "—") +
          '</span><time datetime="' +
          escapeHtml(entry.date) +
          '">' +
          escapeHtml(entry.date) +
          '</time><span class="change-type">' +
          escapeHtml(labels[entry.type] || "更新") +
          '</span></div><div class="change-item__body"><h3>' +
          escapeHtml(entry.title) +
          "</h3><ul>" +
          items +
          "</ul></div></article>"
        );
      })
      .join("");
  }

  if (list) {
    fetch("/api/changelog", { headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Changelog unavailable");
        return response.json();
      })
      .then(function (data) {
        if (data && data.ok) render(data.entries);
      })
      .catch(function () {
        /* Keep the static fallback already in the document. */
      });
  }
})();
