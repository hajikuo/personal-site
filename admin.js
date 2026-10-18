(function () {
  "use strict";

  const root = document.documentElement;
  const adminTheme = document.getElementById("adminTheme");
  const themeMeta = document.getElementById("themeColor");
  const adminLogout = document.getElementById("adminLogout");
  const adminApp = document.getElementById("adminApp");
  const adminName = document.getElementById("adminName");
  const adminAvatar = document.getElementById("adminAvatar");
  const adminTotal = document.getElementById("adminTotal");
  const adminActive = document.getElementById("adminActive");
  const adminAdmins = document.getElementById("adminAdmins");
  const adminToday = document.getElementById("adminToday");
  const userRows = document.getElementById("userRows");
  const userEmpty = document.getElementById("userEmpty");
  const userSearch = document.getElementById("userSearch");
  const statusFilter = document.getElementById("statusFilter");
  const roleFilter = document.getElementById("roleFilter");
  const newUserBtn = document.getElementById("newUserBtn");
  const newChangeBtn = document.getElementById("newChangeBtn");
  const adminChangelog = document.getElementById("adminChangelog");
  const adminToast = document.getElementById("adminToast");
  const userDialog = document.getElementById("userDialog");
  const userForm = document.getElementById("userForm");
  const userDialogTitle = document.getElementById("userDialogTitle");
  const userDialogKicker = document.getElementById("userDialogKicker");
  const dialogUsername = document.getElementById("dialogUsername");
  const dialogEmail = document.getElementById("dialogEmail");
  const dialogPassword = document.getElementById("dialogPassword");
  const dialogRole = document.getElementById("dialogRole");
  const dialogStatus = document.getElementById("dialogStatus");
  const dialogStatusField = document.getElementById("dialogStatusField");
  const dialogEmailField = document.getElementById("dialogEmailField");
  const dialogPasswordField = document.getElementById("dialogPasswordField");
  const userDialogMsg = document.getElementById("userDialogMsg");
  const userDialogSubmit = document.getElementById("userDialogSubmit");
  const changeDialog = document.getElementById("changeDialog");
  const changeForm = document.getElementById("changeForm");
  const changeDate = document.getElementById("changeDate");
  const changeVersion = document.getElementById("changeVersion");
  const changeTitle = document.getElementById("changeTitle");
  const changeType = document.getElementById("changeType");
  const changeItems = document.getElementById("changeItems");
  const changeDialogMsg = document.getElementById("changeDialogMsg");
  const changeDialogSubmit = document.getElementById("changeDialogSubmit");

  const state = {
    me: null,
    users: [],
    entries: [],
    editingUserId: null,
  };

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

  function dateTime(value) {
    if (!value) return "从未登录";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0") +
      " " +
      String(date.getHours()).padStart(2, "0") +
      ":" +
      String(date.getMinutes()).padStart(2, "0")
    );
  }

  function todayString() {
    const date = new Date();
    return (
      date.getFullYear() +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }

  function setTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    if (themeMeta) themeMeta.setAttribute("content", next === "dark" ? "#10110f" : "#f3efe5");
    if (adminTheme) {
      adminTheme.setAttribute("aria-pressed", String(next === "dark"));
      adminTheme.setAttribute("aria-label", next === "dark" ? "切换到浅色模式" : "切换到深色模式");
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
  if (adminTheme) {
    adminTheme.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  }

  let toastTimer = null;
  function toast(message) {
    if (!adminToast) return;
    adminToast.textContent = message;
    adminToast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      adminToast.classList.remove("is-visible");
    }, 2800);
  }

  async function api(path, options) {
    const settings = options || {};
    const headers = {
      Accept: "application/json",
      ...(settings.body ? { "Content-Type": "application/json" } : {}),
      ...(settings.headers || {}),
    };
    const response = await fetch(path, {
      ...settings,
      headers,
      cache: "no-store",
    });
    let data = {};
    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }
    if (!response.ok || data.ok === false) {
      const error = new Error(data.error || "请求失败，请稍后重试");
      error.status = response.status;
      error.code = data.code;
      throw error;
    }
    return data;
  }

  function showState(id) {
    ["adminLoading", "adminOffline", "adminLogin", "adminDenied"].forEach(function (stateId) {
      const element = document.getElementById(stateId);
      if (element) element.hidden = stateId !== id;
    });
    if (adminApp) adminApp.hidden = true;
    if (adminLogout) adminLogout.hidden = true;
  }

  function showApp() {
    ["adminLoading", "adminOffline", "adminLogin", "adminDenied"].forEach(function (stateId) {
      const element = document.getElementById(stateId);
      if (element) element.hidden = true;
    });
    if (adminApp) adminApp.hidden = false;
    if (adminLogout) adminLogout.hidden = false;
  }

  function renderIdentity() {
    if (!state.me) return;
    if (adminName) adminName.textContent = state.me.username;
    if (adminAvatar) adminAvatar.textContent = initialOf(state.me.username);
  }

  function renderStats(stats) {
    if (adminTotal) adminTotal.textContent = String(stats.total || 0);
    if (adminActive) adminActive.textContent = String(stats.active || 0);
    if (adminAdmins) adminAdmins.textContent = String(stats.admins || 0);
    if (adminToday) adminToday.textContent = String(stats.today || 0);
  }

  function filteredUsers() {
    const query = (userSearch ? userSearch.value : "").trim().toLowerCase();
    const status = statusFilter ? statusFilter.value : "all";
    const role = roleFilter ? roleFilter.value : "all";
    return state.users.filter(function (user) {
      if (status !== "all" && user.status !== status) return false;
      if (role !== "all" && user.role !== role) return false;
      if (!query) return true;
      return (
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      );
    });
  }

  function renderUsers() {
    if (!userRows) return;
    const users = filteredUsers();
    if (userEmpty) userEmpty.hidden = users.length !== 0;
    userRows.innerHTML = users
      .map(function (user) {
        const isSelf = state.me && user.id === state.me.id;
        const roleText = user.role === "admin" ? "管理员" : "普通用户";
        const statusText = user.status === "active" ? "启用" : "停用";
        return (
          '<div class="user-row" data-user-id="' +
          escapeHtml(user.id) +
          '">' +
          '<div class="user-identity"><span class="user-avatar" aria-hidden="true">' +
          escapeHtml(initialOf(user.username)) +
          "</span><div><strong>" +
          escapeHtml(user.username) +
          "</strong><small>" +
          (isSelf ? "当前账户" : "ID · " + escapeHtml(user.id.slice(0, 8))) +
          "</small></div></div>" +
          '<span class="user-email" title="' +
          escapeHtml(user.email) +
          '">' +
          escapeHtml(user.email) +
          "</span>" +
          '<span class="role-badge' +
          (user.role === "admin" ? " role-badge--admin" : "") +
          '">' +
          roleText +
          "</span>" +
          '<span class="status-badge' +
          (user.status === "active" ? "" : " status-badge--disabled") +
          '">' +
          statusText +
          "</span>" +
          '<span class="user-last">' +
          escapeHtml(dateTime(user.lastLoginAt)) +
          "</span>" +
          '<div class="user-actions">' +
          '<button class="user-action" type="button" data-user-action="edit" data-user-id="' +
          escapeHtml(user.id) +
          '">编辑</button>' +
          '<button class="user-action" type="button" data-user-action="toggle" data-user-id="' +
          escapeHtml(user.id) +
          '"' +
          (isSelf ? " disabled title=\"不能停用当前账户\"" : "") +
          ">" +
          (user.status === "active" ? "停用" : "启用") +
          "</button>" +
          '<button class="user-action user-action--danger" type="button" data-user-action="delete" data-user-id="' +
          escapeHtml(user.id) +
          '"' +
          (isSelf ? " disabled title=\"不能删除当前账户\"" : "") +
          ">删除</button></div></div>"
        );
      })
      .join("");
  }

  function changelogLabel(type) {
    return (
      {
        feature: "功能",
        design: "设计",
        fix: "修复",
        release: "上线",
        update: "更新",
      }[type] || "更新"
    );
  }

  function renderChangelog() {
    if (!adminChangelog) return;
    if (state.entries.length === 0) {
      adminChangelog.innerHTML = '<div class="admin-empty"><strong>还没有更新日志</strong><span>点击「新增日志」记录第一次更新。</span></div>';
      return;
    }
    adminChangelog.innerHTML = state.entries
      .map(function (entry) {
        const items = (entry.items || []).join(" · ");
        return (
          '<div class="admin-change">' +
          '<div class="admin-change__meta"><strong>v' +
          escapeHtml(entry.version || "—") +
          "</strong><span>" +
          escapeHtml(entry.date) +
          "</span><span>" +
          escapeHtml(changelogLabel(entry.type)) +
          "</span></div>" +
          '<div class="admin-change__body"><strong>' +
          escapeHtml(entry.title) +
          "</strong><span>" +
          escapeHtml(items) +
          "</span></div>" +
          '<button class="user-action user-action--danger" type="button" data-change-action="delete" data-change-id="' +
          escapeHtml(entry.id) +
          '">删除</button></div>'
        );
      })
      .join("");
  }

  async function loadData() {
    const [userData, changelogData] = await Promise.all([
      api("/api/admin/users"),
      api("/api/changelog"),
    ]);
    state.users = userData.users || [];
    state.entries = changelogData.entries || [];
    renderStats(userData);
    renderUsers();
    renderChangelog();
  }

  function openDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.classList.add("modal-open");
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else dialog.removeAttribute("open");
    document.body.classList.remove("modal-open");
  }

  function openUserDialog(user) {
    state.editingUserId = user ? user.id : null;
    if (userDialogTitle) userDialogTitle.textContent = user ? "编辑账户" : "新建账户";
    if (userDialogKicker) userDialogKicker.textContent = user ? "EDIT ACCOUNT" : "NEW ACCOUNT";
    if (userDialogMsg) userDialogMsg.textContent = "";
    if (dialogUsername) dialogUsername.value = user ? user.username : "";
    if (dialogEmail) {
      dialogEmail.value = user ? user.email : "";
      dialogEmail.readOnly = Boolean(user);
    }
    if (dialogPassword) dialogPassword.value = "";
    if (dialogRole) dialogRole.value = user ? user.role : "user";
    if (dialogStatus) dialogStatus.value = user ? user.status : "active";
    if (dialogEmailField) dialogEmailField.hidden = false;
    if (dialogPasswordField) dialogPasswordField.hidden = Boolean(user);
    if (dialogStatusField) dialogStatusField.hidden = !user;
    if (userDialogSubmit) userDialogSubmit.textContent = user ? "保存修改" : "创建账户";
    openDialog(userDialog);
    if (dialogUsername) window.setTimeout(function () { dialogUsername.focus(); }, 50);
  }

  async function submitUserForm(event) {
    event.preventDefault();
    const username = dialogUsername.value.trim();
    const email = dialogEmail.value.trim();
    const password = dialogPassword.value;
    const role = dialogRole.value;
    const status = dialogStatus.value;
    if (userDialogMsg) userDialogMsg.textContent = "";
    if (!username) {
      if (userDialogMsg) userDialogMsg.textContent = "请输入用户名";
      dialogUsername.focus();
      return;
    }
    if (!state.editingUserId) {
      if (!email) {
        if (userDialogMsg) userDialogMsg.textContent = "请输入邮箱";
        dialogEmail.focus();
        return;
      }
      if (!password || password.length < 8) {
        if (userDialogMsg) userDialogMsg.textContent = "初始密码至少需要 8 位";
        dialogPassword.focus();
        return;
      }
    }
    userDialogSubmit.disabled = true;
    try {
      if (state.editingUserId) {
        await api("/api/admin/users/" + encodeURIComponent(state.editingUserId), {
          method: "PATCH",
          body: JSON.stringify({ username, role, status }),
        });
        if (state.me && state.editingUserId === state.me.id) {
          state.me.username = username;
          renderIdentity();
        }
        toast("账户信息已更新");
      } else {
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({ username, email, password, role }),
        });
        toast("账户已创建");
      }
      closeDialog(userDialog);
      await loadData();
    } catch (error) {
      if (userDialogMsg) userDialogMsg.textContent = error.message;
    } finally {
      userDialogSubmit.disabled = false;
    }
  }

  function openChangeDialog() {
    if (changeForm) changeForm.reset();
    if (changeDate) changeDate.value = todayString();
    if (changeVersion) changeVersion.value = "";
    if (changeTitle) changeTitle.value = "";
    if (changeType) changeType.value = "feature";
    if (changeItems) changeItems.value = "";
    if (changeDialogMsg) changeDialogMsg.textContent = "";
    openDialog(changeDialog);
    if (changeTitle) window.setTimeout(function () { changeTitle.focus(); }, 50);
  }

  async function submitChangeForm(event) {
    event.preventDefault();
    const title = changeTitle.value.trim();
    if (!title) {
      if (changeDialogMsg) changeDialogMsg.textContent = "请填写更新标题";
      changeTitle.focus();
      return;
    }
    changeDialogSubmit.disabled = true;
    try {
      await api("/api/admin/changelog", {
        method: "POST",
        body: JSON.stringify({
          date: changeDate.value,
          version: changeVersion.value.trim(),
          title,
          type: changeType.value,
          items: changeItems.value,
        }),
      });
      closeDialog(changeDialog);
      toast("更新日志已发布");
      await loadData();
    } catch (error) {
      if (changeDialogMsg) changeDialogMsg.textContent = error.message;
    } finally {
      changeDialogSubmit.disabled = false;
    }
  }

  async function toggleUser(userId) {
    const user = state.users.find(function (item) { return item.id === userId; });
    if (!user) return;
    const nextStatus = user.status === "active" ? "disabled" : "active";
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId), {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      toast(nextStatus === "active" ? "账户已启用" : "账户已停用");
      await loadData();
    } catch (error) {
      toast(error.message);
    }
  }

  async function deleteUser(userId) {
    const user = state.users.find(function (item) { return item.id === userId; });
    if (!user) return;
    if (!window.confirm("确定删除账户「" + user.username + "」吗？此操作不可撤销。")) return;
    try {
      await api("/api/admin/users/" + encodeURIComponent(userId), { method: "DELETE" });
      toast("账户已删除");
      await loadData();
    } catch (error) {
      toast(error.message);
    }
  }

  async function deleteChange(changeId) {
    if (!window.confirm("确定删除这条更新日志吗？")) return;
    try {
      await api("/api/admin/changelog/" + encodeURIComponent(changeId), { method: "DELETE" });
      toast("日志已删除");
      await loadData();
    } catch (error) {
      toast(error.message);
    }
  }

  if (userRows) {
    userRows.addEventListener("click", function (event) {
      const button = event.target.closest("[data-user-action]");
      if (!button) return;
      const userId = button.dataset.userId;
      const action = button.dataset.userAction;
      if (action === "edit") {
        const user = state.users.find(function (item) { return item.id === userId; });
        if (user) openUserDialog(user);
      } else if (action === "toggle") {
        toggleUser(userId);
      } else if (action === "delete") {
        deleteUser(userId);
      }
    });
  }

  if (adminChangelog) {
    adminChangelog.addEventListener("click", function (event) {
      const button = event.target.closest("[data-change-action]");
      if (!button || button.dataset.changeAction !== "delete") return;
      deleteChange(button.dataset.changeId);
    });
  }

  if (userForm) userForm.addEventListener("submit", submitUserForm);
  if (changeForm) changeForm.addEventListener("submit", submitChangeForm);
  if (newUserBtn) newUserBtn.addEventListener("click", function () { openUserDialog(null); });
  if (newChangeBtn) newChangeBtn.addEventListener("click", openChangeDialog);
  if (userSearch) userSearch.addEventListener("input", renderUsers);
  if (statusFilter) statusFilter.addEventListener("change", renderUsers);
  if (roleFilter) roleFilter.addEventListener("change", renderUsers);

  [userDialog, changeDialog].forEach(function (dialog) {
    if (!dialog) return;
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) closeDialog(dialog);
    });
  });

  document.querySelectorAll("[data-close-dialog]").forEach(function (button) {
    button.addEventListener("click", function () {
      closeDialog(button.closest("dialog"));
    });
  });

  if (adminLogout) {
    adminLogout.addEventListener("click", async function () {
      try {
        await api("/api/auth/logout", { method: "POST" });
      } catch (error) {
        /* Redirect regardless of the network result. */
      }
      window.location.replace("login.html");
    });
  }

  async function boot() {
    let needsSetup = false;
    try {
      const health = await api("/api/health");
      if (!health.ok || health.mode !== "local") throw new Error("offline");
      needsSetup = Boolean(health.needsSetup);
    } catch (error) {
      showState("adminOffline");
      return;
    }

    try {
      const session = await api("/api/auth/session");
      if (!session.user) {
        const setupLink = document.getElementById("adminSetupLink");
        if (setupLink) setupLink.hidden = !needsSetup;
        showState("adminLogin");
        return;
      }
      if (session.user.role !== "admin") {
        showState("adminDenied");
        return;
      }
      state.me = session.user;
      renderIdentity();
      showApp();
      await loadData();
    } catch (error) {
      if (error.status === 401) showState("adminLogin");
      else showState("adminOffline");
    }
  }

  boot();
})();
