(function () {
  "use strict";

  const root = document.documentElement;
  const themeToggle = document.getElementById("loginTheme");
  const themeMeta = document.getElementById("themeColor");
  const year = document.getElementById("year");
  const authModeText = document.getElementById("authModeText");
  const authSub = document.getElementById("authSub");
  const authUnavailable = document.getElementById("authUnavailable");
  const registerRoleTip = document.getElementById("registerRoleTip");
  const tabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
  const panels = {
    login: document.getElementById("panelLogin"),
    register: document.getElementById("panelRegister"),
  };

  const localLoginForm = document.getElementById("localLoginForm");
  const loginIdentifier = document.getElementById("loginIdentifier");
  const loginPassword = document.getElementById("loginPassword");
  const localLoginSubmit = document.getElementById("localLoginSubmit");
  const localLoginMsg = document.getElementById("localLoginMsg");

  const localRegisterForm = document.getElementById("localRegisterForm");
  const registerUsername = document.getElementById("registerUsername");
  const registerEmail = document.getElementById("registerEmail");
  const registerPassword = document.getElementById("registerPassword");
  const registerConfirm = document.getElementById("registerConfirm");
  const localRegisterSubmit = document.getElementById("localRegisterSubmit");
  const localRegisterMsg = document.getElementById("localRegisterMsg");

  const cloudAuth = window.cloud && window.cloud.auth;
  const query = new URLSearchParams(location.search);
  const forceSwitch = query.get("switch") === "1";
  const nextTarget = query.get("next") === "admin" ? "admin.html" : "index.html";
  let mode = "detecting";

  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     Theme
     --------------------------------------------------------- */
  function setTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    if (themeMeta) themeMeta.setAttribute("content", next === "dark" ? "#10110f" : "#f3efe5");
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(next === "dark"));
      themeToggle.setAttribute("aria-label", next === "dark" ? "切换到浅色模式" : "切换到深色模式");
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

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
    });
  }

  /* ---------------------------------------------------------
     Tabs and messages
     --------------------------------------------------------- */
  function selectTab(name) {
    const target = name === "register" ? "register" : "login";
    tabs.forEach(function (tab) {
      const active = tab.dataset.authTab === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = key !== target;
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectTab(tab.dataset.authTab);
    });
  });

  const authTabList = document.querySelector(".auth-tabs");
  if (authTabList) {
    authTabList.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const current = tabs.indexOf(document.activeElement);
      const offset = event.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(current + offset + tabs.length) % tabs.length];
      if (!next) return;
      next.focus();
      selectTab(next.dataset.authTab);
    });
  }

  selectTab(location.hash === "#register" || query.get("tab") === "register" ? "register" : "login");

  function setMsg(element, text, type) {
    if (!element) return;
    element.textContent = text || "";
    element.className = "auth-msg" + (type ? " is-" + type : "");
  }

  function setInvalid(field, invalid) {
    if (!field) return;
    if (invalid) field.setAttribute("aria-invalid", "true");
    else field.removeAttribute("aria-invalid");
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
    const text = button.querySelector(".auth-submit__label");
    if (text) text.textContent = label;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function validUsername(value) {
    return /^[\p{L}\p{N}_-]{2,20}$/u.test(value);
  }

  function validPassword(value) {
    return typeof value === "string" && value.length >= 8 && value.length <= 72;
  }

  function modeSet(next) {
    mode = next;
    document.querySelectorAll(".auth-mode-local").forEach(function (element) {
      element.hidden = next !== "local";
    });
    document.querySelectorAll(".auth-mode-cloud").forEach(function (element) {
      element.hidden = next !== "cloud";
    });
    if (authUnavailable) authUnavailable.hidden = next !== "unavailable";

    if (authModeText) {
      authModeText.textContent =
        next === "local" ? "本地账户" : next === "cloud" ? "云端验证" : "服务未连接";
    }
    if (authSub) {
      authSub.textContent =
        next === "local"
          ? "使用用户名和密码登录，或创建一个新账户。"
          : next === "cloud"
            ? "使用邮箱验证码登录或注册。首次验证会自动创建账户。"
            : "登录服务暂不可用，请稍后再试。";
    }
  }

  /* ---------------------------------------------------------
     Local account mode
     --------------------------------------------------------- */
  async function checkLocalSession() {
    try {
      const response = await fetch("/api/auth/session", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.user && !forceSwitch) window.location.replace(nextTarget);
    } catch (error) {
      /* Staying on the login page is safe. */
    }
  }

  function localError(element, message) {
    setMsg(element, message, "error");
  }

  if (localLoginForm) {
    localLoginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const identifier = loginIdentifier.value.trim();
      const password = loginPassword.value;
      if (!identifier) {
        setInvalid(loginIdentifier, true);
        localError(localLoginMsg, "请输入用户名或邮箱");
        loginIdentifier.focus();
        return;
      }
      if (!password) {
        setInvalid(loginPassword, true);
        localError(localLoginMsg, "请输入密码");
        loginPassword.focus();
        return;
      }
      setLoading(localLoginSubmit, true, "正在登录");
      setMsg(localLoginMsg, "正在验证账户…");
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ identifier, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          localError(localLoginMsg, data.error || "登录失败，请检查用户名和密码");
          setLoading(localLoginSubmit, false, "登录");
          return;
        }
        setMsg(localLoginMsg, "登录成功，正在进入网站…", "success");
        setLoading(localLoginSubmit, true, "登录成功");
        window.setTimeout(function () {
          window.location.replace(nextTarget);
        }, 550);
      } catch (error) {
        localError(localLoginMsg, "网络异常，请稍后重试");
        setLoading(localLoginSubmit, false, "登录");
      }
    });
  }

  if (localRegisterForm) {
    localRegisterForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const username = registerUsername.value.trim();
      const email = registerEmail.value.trim();
      const password = registerPassword.value;
      const confirm = registerConfirm.value;

      if (!validUsername(username)) {
        setInvalid(registerUsername, true);
        localError(localRegisterMsg, "用户名需要 2–20 位，可使用中文、字母、数字、下划线或短横线");
        registerUsername.focus();
        return;
      }
      if (!validEmail(email)) {
        setInvalid(registerEmail, true);
        localError(localRegisterMsg, "请输入有效的邮箱地址");
        registerEmail.focus();
        return;
      }
      if (!validPassword(password)) {
        setInvalid(registerPassword, true);
        localError(localRegisterMsg, "密码至少需要 8 位");
        registerPassword.focus();
        return;
      }
      if (password !== confirm) {
        setInvalid(registerConfirm, true);
        localError(localRegisterMsg, "两次输入的密码不一致");
        registerConfirm.focus();
        return;
      }

      setLoading(localRegisterSubmit, true, "正在创建");
      setMsg(localRegisterMsg, "正在创建账户…");
      try {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          localError(localRegisterMsg, data.error || "注册失败，请稍后重试");
          setLoading(localRegisterSubmit, false, "创建账户");
          return;
        }
        if (data.firstUser) {
          setMsg(localRegisterMsg, "注册成功，你已成为站点管理员。正在进入后台…", "success");
          setLoading(localRegisterSubmit, true, "正在进入后台");
          window.setTimeout(function () {
            window.location.replace("admin.html");
          }, 750);
        } else {
          setMsg(localRegisterMsg, "注册成功，正在进入网站…", "success");
          setLoading(localRegisterSubmit, true, "注册成功");
          window.setTimeout(function () {
            window.location.replace(nextTarget);
          }, 650);
        }
      } catch (error) {
        localError(localRegisterMsg, "网络异常，请稍后重试");
        setLoading(localRegisterSubmit, false, "创建账户");
      }
    });
  }

  [
    [loginIdentifier, localLoginMsg],
    [loginPassword, localLoginMsg],
    [registerUsername, localRegisterMsg],
    [registerEmail, localRegisterMsg],
    [registerPassword, localRegisterMsg],
    [registerConfirm, localRegisterMsg],
  ].forEach(function (pair) {
    if (!pair[0]) return;
    pair[0].addEventListener("input", function () {
      setInvalid(pair[0], false);
      if (pair[1] && pair[1].classList.contains("is-error")) {
        setMsg(pair[1], "");
      }
    });
  });

  /* ---------------------------------------------------------
     Cloud OTP fallback
     --------------------------------------------------------- */
  function saveCloudProfile(email, username) {
    if (!username) return;
    try {
      const key = "wb_cloud_profiles";
      const profiles = JSON.parse(localStorage.getItem(key) || "{}");
      profiles[email.toLowerCase()] = {
        username,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(profiles));
    } catch (error) {
      /* Profile display can fall back to email. */
    }
  }

  function createCloudFlow(config) {
    if (!config.form) return;
    let pending = null;
    let sending = false;
    let countdown = 0;
    let timer = null;

    function restoreSendButton() {
      window.clearInterval(timer);
      config.sendBtn.disabled = false;
      config.sendBtn.textContent = "获取验证码";
    }

    function startCountdown() {
      window.clearInterval(timer);
      countdown = 60;
      config.sendBtn.disabled = true;
      config.sendBtn.textContent = countdown + "s 后重发";
      timer = window.setInterval(function () {
        countdown -= 1;
        if (countdown <= 0) {
          restoreSendButton();
          config.sendBtn.textContent = "重新发送";
          return;
        }
        config.sendBtn.textContent = countdown + "s 后重发";
      }, 1000);
    }

    function validate() {
      if (typeof config.beforeSend === "function" && !config.beforeSend()) return false;
      if (!validEmail(config.emailInput.value.trim())) {
        setInvalid(config.emailInput, true);
        setMsg(config.msg, "请输入有效的邮箱地址", "error");
        config.emailInput.focus();
        return false;
      }
      return true;
    }

    config.sendBtn.addEventListener("click", async function () {
      if (sending || !validate()) return;
      const email = config.emailInput.value.trim();
      sending = true;
      config.sendBtn.disabled = true;
      config.sendBtn.textContent = "发送中…";
      setMsg(config.msg, "正在发送验证码…");
      try {
        const res = await cloudAuth.sendOtp({ email });
        if (!res || res.error) {
          setMsg(config.msg, (res && res.error && res.error.message) || "发送失败，请稍后重试", "error");
          restoreSendButton();
          return;
        }
        const data = res.data || {};
        pending = {
          email,
          verificationId: data.verificationId,
          isExistingUser: Boolean(data.isExistingUser),
        };
        setMsg(config.msg, "验证码已发送至 " + email + "，请查收邮件。", "success");
        startCountdown();
        config.codeInput.focus();
      } catch (error) {
        setMsg(config.msg, "网络异常，请稍后重试", "error");
        restoreSendButton();
      } finally {
        sending = false;
      }
    });

    config.codeInput.addEventListener("input", function () {
      config.codeInput.value = config.codeInput.value.replace(/\D/g, "").slice(0, 6);
      setInvalid(config.codeInput, false);
    });

    config.emailInput.addEventListener("input", function () {
      setInvalid(config.emailInput, false);
      if (pending && pending.email !== config.emailInput.value.trim()) {
        pending = null;
        setMsg(config.msg, "邮箱已更改，请重新获取验证码");
      }
    });

    config.form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!validate()) return;
      const email = config.emailInput.value.trim();
      const token = config.codeInput.value.trim();
      if (!pending || pending.email !== email) {
        setMsg(config.msg, "请先获取当前邮箱的验证码", "error");
        return;
      }
      if (!/^\d{6}$/.test(token)) {
        setInvalid(config.codeInput, true);
        setMsg(config.msg, "请输入 6 位数字验证码", "error");
        config.codeInput.focus();
        return;
      }
      setLoading(config.submitBtn, true, "正在验证");
      setMsg(config.msg, "正在验证，请稍候…");
      try {
        const res = await cloudAuth.verifyOtp({
          email: pending.email,
          verificationId: pending.verificationId,
          isExistingUser: pending.isExistingUser,
          token,
        });
        if (!res || res.error) {
          setMsg(config.msg, (res && res.error && res.error.message) || "验证失败，请检查验证码", "error");
          setLoading(config.submitBtn, false, config.submitLabel);
          return;
        }
        if (typeof config.onSuccess === "function") config.onSuccess(email);
        pending = null;
        setMsg(config.msg, "验证成功，正在进入网站…", "success");
        setLoading(config.submitBtn, true, "验证成功");
        window.setTimeout(function () {
          window.location.replace(nextTarget);
        }, 600);
      } catch (error) {
        setMsg(config.msg, "网络异常，请稍后重试", "error");
        setLoading(config.submitBtn, false, config.submitLabel);
      }
    });
  }

  if (cloudAuth) {
    const cloudLoginForm = document.getElementById("cloudLoginForm");
    const cloudEmail = document.getElementById("cloudEmail");
    const cloudCode = document.getElementById("cloudCode");
    const cloudSendBtn = document.getElementById("cloudSendBtn");
    const cloudLoginSubmit = document.getElementById("cloudLoginSubmit");
    const cloudLoginMsg = document.getElementById("cloudLoginMsg");

    createCloudFlow({
      form: cloudLoginForm,
      emailInput: cloudEmail,
      codeInput: cloudCode,
      sendBtn: cloudSendBtn,
      submitBtn: cloudLoginSubmit,
      msg: cloudLoginMsg,
      submitLabel: "登录",
    });

    const cloudRegisterForm = document.getElementById("cloudRegisterForm");
    const cloudRegUsername = document.getElementById("cloudRegUsername");
    const cloudRegEmail = document.getElementById("cloudRegEmail");
    const cloudRegCode = document.getElementById("cloudRegCode");
    const cloudRegSendBtn = document.getElementById("cloudRegSendBtn");
    const cloudRegSubmit = document.getElementById("cloudRegSubmit");
    const cloudRegMsg = document.getElementById("cloudRegMsg");

    createCloudFlow({
      form: cloudRegisterForm,
      emailInput: cloudRegEmail,
      codeInput: cloudRegCode,
      sendBtn: cloudRegSendBtn,
      submitBtn: cloudRegSubmit,
      msg: cloudRegMsg,
      submitLabel: "注册并登录",
      beforeSend: function () {
        const username = cloudRegUsername.value.trim();
        if (!validUsername(username)) {
          setInvalid(cloudRegUsername, true);
          setMsg(cloudRegMsg, "用户名需要 2–20 位，可使用中文、字母、数字、下划线或短横线", "error");
          cloudRegUsername.focus();
          return false;
        }
        return true;
      },
      onSuccess: function (email) {
        saveCloudProfile(email, cloudRegUsername.value.trim());
      },
    });

    if (cloudRegUsername) {
      cloudRegUsername.addEventListener("input", function () {
        setInvalid(cloudRegUsername, false);
      });
    }
  }

  /* ---------------------------------------------------------
     Detect local server, then cloud fallback
     --------------------------------------------------------- */
  async function detectMode() {
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, 1800);
      const response = await fetch("/api/health", {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      if (response.ok) {
        const data = await response.json();
        if (data && data.ok && data.mode === "local") {
          const registrationOpen = data.registrationOpen !== false;
          const registerTab = document.getElementById("tabRegister");
          if (registerTab) registerTab.hidden = !registrationOpen;
          if (!registrationOpen) selectTab("login");
          if (registerRoleTip) {
            registerRoleTip.textContent = data.needsSetup
              ? "首个注册账户会自动成为站点管理员。"
              : "注册后将以普通用户身份加入站点。";
          }
          modeSet("local");
          if (forceSwitch) {
            try {
              await fetch("/api/auth/logout", {
                method: "POST",
                headers: { Accept: "application/json" },
              });
            } catch (error) {
              /* A switch request can continue even if no session exists. */
            }
          } else {
            checkLocalSession();
          }
          return;
        }
      }
    } catch (error) {
      /* No local server; try cloud auth. */
    }

    if (cloudAuth) {
      modeSet("cloud");
      if (forceSwitch && typeof cloudAuth.signOut === "function") {
        try {
          await cloudAuth.signOut();
        } catch (error) {
          /* Switching accounts can continue even if the old session is gone. */
        }
      }
      if (typeof cloudAuth.getSession === "function") {
        cloudAuth.getSession()
          .then(function (result) {
            if (result && result.data && result.data.user && !forceSwitch) {
              window.location.replace(nextTarget);
            }
          })
          .catch(function () {
            /* No session is fine. */
          });
      }
      return;
    }

    modeSet("unavailable");
  }

  detectMode();
})();
