(function () {
  "use strict";

  const authNav = document.getElementById("authNav");
  if (!authNav) return;

  const cloudAuth = window.cloud && window.cloud.auth;
  let mode = "detecting";

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

  function initialOf(name) {
    return String(name || "吕").trim().slice(0, 1).toUpperCase();
  }

  function cloudDisplayName(user) {
    if (!user) return "";
    let username = "";
    try {
      const profiles = JSON.parse(localStorage.getItem("wb_cloud_profiles") || "{}");
      const profile = user.email ? profiles[String(user.email).toLowerCase()] : null;
      if (profile && profile.username) username = profile.username;
    } catch (error) {
      /* Fall back to the cloud profile fields. */
    }
    return username || user.name || user.email || "我的账户";
  }

  function logout() {
    if (mode === "local") {
      return fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
      }).catch(function () {
        /* Local session may already be gone. */
      });
    }
    if (cloudAuth && typeof cloudAuth.signOut === "function") {
      return cloudAuth.signOut();
    }
    return Promise.resolve();
  }

  function render(user, displayName, isAdmin) {
    if (user) {
      const name = displayName || user.username || user.email || "我的账户";
      authNav.innerHTML =
        '<span class="auth-user" title="' +
        escapeHtml(name) +
        '">' +
        '<span class="auth-avatar" aria-hidden="true">' +
        escapeHtml(initialOf(name)) +
        "</span>" +
        '<span class="auth-name">' +
        escapeHtml(name) +
        "</span>" +
        (isAdmin
          ? '<a class="nav__admin" href="admin.html">后台</a>'
          : "") +
        '<button id="logoutBtn" class="nav__logout" type="button" title="退出登录" aria-label="退出登录">退出</button>' +
        "</span>";

      const logoutButton = document.getElementById("logoutBtn");
      if (logoutButton) {
        logoutButton.addEventListener("click", async function () {
          logoutButton.disabled = true;
          logoutButton.textContent = "退出中";
          await logout();
          render(null);
        });
      }
    } else {
      authNav.innerHTML = '<a class="nav__login" href="login.html">登录</a>';
    }
  }

  async function initLocal() {
    try {
      const response = await fetch("/api/auth/session", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data) return false;
      mode = "local";
      if (data.user) {
        render(data.user, data.user.username, data.user.role === "admin");
      } else {
        render(null);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async function initCloud() {
    mode = "cloud";
    if (!cloudAuth || typeof cloudAuth.getSession !== "function") {
      render(null);
      return;
    }
    try {
      const result = await cloudAuth.getSession();
      const user = result && result.data && result.data.user ? result.data.user : null;
      render(user, cloudDisplayName(user), false);
    } catch (error) {
      render(null);
    }
    if (typeof cloudAuth.onAuthStateChange === "function") {
      cloudAuth.onAuthStateChange(function (event, session) {
        const user = session && session.user ? session.user : null;
        render(user, cloudDisplayName(user), false);
      });
    }
  }

  async function init() {
    try {
      const response = await fetch("/api/health", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok && data.mode === "local") {
          const handled = await initLocal();
          if (handled) return;
        }
      }
    } catch (error) {
      /* Static deployment: use the cloud auth session. */
    }
    initCloud();
  }

  init();
})();
