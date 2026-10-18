const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, ".data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const SESSION_COOKIE = "wb_session";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

const DEFAULT_CHANGELOG = [
  {
    id: "seed-2-1",
    date: "2026-10-18",
    version: "2.1",
    type: "feature",
    title: "账户系统与更新日志上线",
    items: [
      "新增用户名注册与密码登录",
      "新增管理后台：用户搜索、角色与状态管理",
      "新增网站更新日志",
      "登录页支持登录 / 注册切换",
    ],
  },
  {
    id: "seed-2-0",
    date: "2026-10-18",
    version: "2.0",
    type: "design",
    title: "首页与工作台重构",
    items: [
      "重做首页视觉、导航与响应式布局",
      "新增项目筛选、项目详情弹窗与笔记阅读",
      "完善待办筛选、打卡连续天数与撤销操作",
    ],
  },
  {
    id: "seed-1-1",
    date: "2026-10-14",
    version: "1.1",
    type: "feature",
    title: "工作台与邮箱登录",
    items: ["加入待办、打卡、数据概览与时间线", "接入邮箱验证码登录"],
  },
  {
    id: "seed-1-0",
    date: "2026-10-10",
    version: "1.0",
    type: "release",
    title: "个人网站上线",
    items: ["关于、作品、笔记与联系方式四个基础区块"],
  },
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const initial = {
      users: [],
      sessions: [],
      changelog: DEFAULT_CHANGELOG,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
  }
}

function loadStore() {
  ensureStore();
  try {
    const store = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
    store.users = Array.isArray(store.users) ? store.users : [];
    store.sessions = Array.isArray(store.sessions) ? store.sessions : [];
    store.changelog = Array.isArray(store.changelog) ? store.changelog : DEFAULT_CHANGELOG;
    return store;
  } catch (error) {
    const backup = STORE_FILE + ".corrupt-" + Date.now();
    try {
      fs.renameSync(STORE_FILE, backup);
    } catch (renameError) {
      /* Keep serving with a fresh store if the backup cannot be written. */
    }
    const initial = {
      users: [],
      sessions: [],
      changelog: DEFAULT_CHANGELOG,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), "utf8");
    return initial;
  }
}

function saveStore(store) {
  const temporary = STORE_FILE + ".tmp";
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temporary, STORE_FILE);
}

function json(res, status, payload, extraHeaders) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...(extraHeaders || {}),
  });
  res.end(JSON.stringify(payload));
}

function fail(res, status, message, code) {
  json(res, status, { ok: false, error: message, code: code || "" });
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > (limit || 1024 * 1024)) {
        reject(new Error("请求内容过大"));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("请求格式不是有效的 JSON"));
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const result = {};
  header.split(";").forEach((part) => {
    const index = part.indexOf("=");
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  });
  return result;
}

function isSecureRequest(req) {
  return req.headers["x-forwarded-proto"] === "https" || Boolean(req.socket.encrypted);
}

function setSessionCookie(req, res, token) {
  const secure = isSecureRequest(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_TTL / 1000
    )}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function createSession(store, userId) {
  const now = Date.now();
  store.sessions = store.sessions.filter(
    (session) => session.expiresAt > now && session.userId !== userId
  );
  const token = crypto.randomBytes(32).toString("hex");
  store.sessions.push({
    token,
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  });
  const userSessions = store.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (userSessions.length > 8) {
    const keep = new Set(userSessions.slice(0, 8).map((session) => session.token));
    store.sessions = store.sessions.filter(
      (session) => session.userId !== userId || keep.has(session.token)
    );
  }
  return token;
}

function getSession(req, store) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const now = Date.now();
  const session = store.sessions.find(
    (item) => item.token === token && item.expiresAt > now
  );
  if (!session) return null;
  const user = store.users.find((item) => item.id === session.userId);
  if (!user || user.status !== "active") return null;
  return { token, session, user };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || null,
  };
}

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(value) {
  return /^[\p{L}\p{N}_-]{2,20}$/u.test(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPassword(value) {
  return typeof value === "string" && value.length >= 8 && value.length <= 72;
}

function hashPassword(password, salt) {
  const nextSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, nextSalt, 64).toString("hex");
  return { salt: nextSalt, hash };
}

function verifyPassword(password, salt, hash) {
  try {
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch (error) {
    return false;
  }
}

function usernameTaken(store, username, exceptId) {
  const value = username.toLowerCase();
  return store.users.some(
    (user) => user.id !== exceptId && user.username.toLowerCase() === value
  );
}

function emailTaken(store, email, exceptId) {
  const value = email.toLowerCase();
  return store.users.some(
    (user) => user.id !== exceptId && user.email.toLowerCase() === value
  );
}

function activeAdminCount(store, exceptId) {
  return store.users.filter(
    (user) =>
      user.id !== exceptId &&
      user.role === "admin" &&
      user.status === "active"
  ).length;
}

function requireUser(req, res, store) {
  const session = getSession(req, store);
  if (!session) {
    fail(res, 401, "请先登录", "unauthenticated");
    return null;
  }
  return session;
}

function requireAdmin(req, res, store) {
  const session = requireUser(req, res, store);
  if (!session) return null;
  if (session.user.role !== "admin") {
    fail(res, 403, "需要管理员权限", "permission-denied");
    return null;
  }
  return session;
}

const loginAttempts = new Map();

function loginKey(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "local").split(",")[0];
}

function checkLoginRate(req) {
  const key = loginKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.start > 10 * 60 * 1000) {
    loginAttempts.set(key, { start: now, count: 0 });
    return true;
  }
  return record.count < 12;
}

function noteLoginFailure(req) {
  const key = loginKey(req);
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now - record.start > 10 * 60 * 1000) {
    loginAttempts.set(key, { start: now, count: 1 });
  } else {
    record.count += 1;
  }
}

function clearLoginFailures(req) {
  loginAttempts.delete(loginKey(req));
}

function sanitizeChangelog(entry) {
  return {
    id: entry.id,
    date: entry.date,
    version: entry.version || "",
    type: entry.type || "update",
    title: entry.title || "",
    items: Array.isArray(entry.items) ? entry.items : [],
  };
}

function sortedChangelog(store) {
  return store.changelog
    .slice()
    .sort((a, b) => {
      const dateCompare = String(b.date).localeCompare(String(a.date));
      if (dateCompare !== 0) return dateCompare;
      return String(b.version).localeCompare(String(a.version), undefined, { numeric: true });
    })
    .map(sanitizeChangelog);
}

function changelogFromBody(body) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ""))
    ? String(body.date)
    : new Date().toISOString().slice(0, 10);
  const version = String(body.version || "").trim().slice(0, 20);
  const title = String(body.title || "").trim().slice(0, 100);
  const type = ["feature", "design", "fix", "release", "update"].includes(body.type)
    ? body.type
    : "update";
  const items = (Array.isArray(body.items) ? body.items : String(body.items || "").split("\n"))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, 12);
  return { date, version, title, type, items };
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  const method = req.method;
  const store = loadStore();

  if (pathname === "/api/health" && method === "GET") {
    json(res, 200, {
      ok: true,
      mode: "local",
      needsSetup: !store.users.some((user) => user.role === "admin"),
      registrationOpen:
        process.env.ALLOW_REGISTRATION !== "false" || store.users.length === 0,
    });
    return true;
  }

  if (pathname === "/api/auth/session" && method === "GET") {
    const session = getSession(req, store);
    json(res, 200, {
      ok: true,
      user: session ? publicUser(session.user) : null,
    });
    return true;
  }

  if (pathname === "/api/auth/register" && method === "POST") {
    if (process.env.ALLOW_REGISTRATION === "false" && store.users.length > 0) {
      fail(res, 403, "当前站点已关闭公开注册", "registration-closed");
      return true;
    }
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error.message, "invalid-body");
      return true;
    }
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    if (!validUsername(username)) {
      fail(res, 400, "用户名需要 2–20 位，可使用中文、字母、数字、下划线或短横线", "invalid-username");
      return true;
    }
    if (!validEmail(email)) {
      fail(res, 400, "请输入有效的邮箱地址", "invalid-email");
      return true;
    }
    if (!validPassword(password)) {
      fail(res, 400, "密码至少需要 8 位", "invalid-password");
      return true;
    }
    if (usernameTaken(store, username)) {
      fail(res, 409, "这个用户名已经被使用", "username-taken");
      return true;
    }
    if (emailTaken(store, email)) {
      fail(res, 409, "这个邮箱已经注册过", "email-taken");
      return true;
    }
    const isFirstUser = store.users.length === 0;
    const passwordRecord = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      role: isFirstUser ? "admin" : "user",
      status: "active",
      salt: passwordRecord.salt,
      passwordHash: passwordRecord.hash,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };
    store.users.push(user);
    const token = createSession(store, user.id);
    saveStore(store);
    setSessionCookie(req, res, token);
    json(res, 201, { ok: true, user: publicUser(user), firstUser: isFirstUser });
    return true;
  }

  if (pathname === "/api/auth/login" && method === "POST") {
    if (!checkLoginRate(req)) {
      fail(res, 429, "尝试次数过多，请稍后再试", "rate-limited");
      return true;
    }
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error.message, "invalid-body");
      return true;
    }
    const identifier = String(body.identifier || body.username || body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    const user = store.users.find(
      (item) =>
        item.username.toLowerCase() === identifier ||
        item.email.toLowerCase() === identifier
    );
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      noteLoginFailure(req);
      fail(res, 401, "用户名或密码不正确", "invalid-credentials");
      return true;
    }
    if (user.status !== "active") {
      fail(res, 403, "这个账户已被停用，请联系管理员", "account-disabled");
      return true;
    }
    clearLoginFailures(req);
    user.lastLoginAt = new Date().toISOString();
    const token = createSession(store, user.id);
    saveStore(store);
    setSessionCookie(req, res, token);
    json(res, 200, { ok: true, user: publicUser(user) });
    return true;
  }

  if (pathname === "/api/auth/logout" && method === "POST") {
    const session = getSession(req, store);
    if (session) {
      store.sessions = store.sessions.filter((item) => item.token !== session.token);
      saveStore(store);
    }
    clearSessionCookie(res);
    json(res, 200, { ok: true });
    return true;
  }

  if (pathname === "/api/me" && method === "PATCH") {
    const session = requireUser(req, res, store);
    if (!session) return true;
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error.message, "invalid-body");
      return true;
    }
    const username = normalizeUsername(body.username);
    if (!validUsername(username)) {
      fail(res, 400, "用户名需要 2–20 位，可使用中文、字母、数字、下划线或短横线", "invalid-username");
      return true;
    }
    if (usernameTaken(store, username, session.user.id)) {
      fail(res, 409, "这个用户名已经被使用", "username-taken");
      return true;
    }
    session.user.username = username;
    saveStore(store);
    json(res, 200, { ok: true, user: publicUser(session.user) });
    return true;
  }

  if (pathname === "/api/admin/users" && method === "GET") {
    const session = requireAdmin(req, res, store);
    if (!session) return true;
    const query = String(url.searchParams.get("q") || "").trim().toLowerCase();
    const status = String(url.searchParams.get("status") || "all");
    const role = String(url.searchParams.get("role") || "all");
    const users = store.users
      .filter((user) => {
        if (status !== "all" && user.status !== status) return false;
        if (role !== "all" && user.role !== role) return false;
        if (!query) return true;
        return (
          user.username.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .map(publicUser);
    json(res, 200, {
      ok: true,
      users,
      total: store.users.length,
      active: store.users.filter((user) => user.status === "active").length,
      admins: store.users.filter((user) => user.role === "admin").length,
      today: store.users.filter(
        (user) => String(user.createdAt).slice(0, 10) === new Date().toISOString().slice(0, 10)
      ).length,
    });
    return true;
  }

  if (pathname === "/api/admin/users" && method === "POST") {
    const session = requireAdmin(req, res, store);
    if (!session) return true;
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error.message, "invalid-body");
      return true;
    }
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const role = body.role === "admin" ? "admin" : "user";
    if (!validUsername(username)) {
      fail(res, 400, "用户名格式不正确", "invalid-username");
      return true;
    }
    if (!validEmail(email)) {
      fail(res, 400, "邮箱格式不正确", "invalid-email");
      return true;
    }
    if (!validPassword(password)) {
      fail(res, 400, "密码至少需要 8 位", "invalid-password");
      return true;
    }
    if (usernameTaken(store, username) || emailTaken(store, email)) {
      fail(res, 409, "用户名或邮箱已被使用", "account-exists");
      return true;
    }
    const passwordRecord = hashPassword(password);
    const user = {
      id: crypto.randomUUID(),
      username,
      email,
      role,
      status: "active",
      salt: passwordRecord.salt,
      passwordHash: passwordRecord.hash,
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      createdBy: session.user.id,
    };
    store.users.push(user);
    saveStore(store);
    json(res, 201, { ok: true, user: publicUser(user) });
    return true;
  }

  const userMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (userMatch) {
    const session = requireAdmin(req, res, store);
    if (!session) return true;
    const target = store.users.find((user) => user.id === userMatch[1]);
    if (!target) {
      fail(res, 404, "账户不存在", "not-found");
      return true;
    }
    if (method === "PATCH") {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        fail(res, 400, error.message, "invalid-body");
        return true;
      }
      const nextUsername =
        body.username === undefined ? target.username : normalizeUsername(body.username);
      const nextRole = body.role === undefined ? target.role : body.role;
      const nextStatus = body.status === undefined ? target.status : body.status;
      if (!validUsername(nextUsername)) {
        fail(res, 400, "用户名格式不正确", "invalid-username");
        return true;
      }
      if (usernameTaken(store, nextUsername, target.id)) {
        fail(res, 409, "这个用户名已经被使用", "username-taken");
        return true;
      }
      if (nextRole !== "admin" && nextRole !== "user") {
        fail(res, 400, "角色不正确", "invalid-role");
        return true;
      }
      if (nextStatus !== "active" && nextStatus !== "disabled") {
        fail(res, 400, "账户状态不正确", "invalid-status");
        return true;
      }
      if (target.id === session.user.id && nextStatus !== "active") {
        fail(res, 400, "不能停用当前登录的管理员账户", "cannot-disable-self");
        return true;
      }
      if (target.id === session.user.id && nextRole !== "admin") {
        fail(res, 400, "不能移除自己的管理员权限", "cannot-demote-self");
        return true;
      }
      const removesActiveAdmin =
        target.role === "admin" &&
        target.status === "active" &&
        (nextRole !== "admin" || nextStatus !== "active");
      if (removesActiveAdmin && activeAdminCount(store, target.id) === 0) {
        fail(res, 400, "站点至少需要保留一个启用中的管理员", "last-admin");
        return true;
      }
      target.username = nextUsername;
      target.role = nextRole;
      target.status = nextStatus;
      if (nextStatus !== "active") {
        store.sessions = store.sessions.filter((item) => item.userId !== target.id);
      }
      saveStore(store);
      json(res, 200, { ok: true, user: publicUser(target) });
      return true;
    }
    if (method === "DELETE") {
      if (target.id === session.user.id) {
        fail(res, 400, "不能删除当前登录的账户", "cannot-delete-self");
        return true;
      }
      if (target.role === "admin" && activeAdminCount(store, target.id) === 0) {
        fail(res, 400, "站点至少需要保留一个启用中的管理员", "last-admin");
        return true;
      }
      store.users = store.users.filter((user) => user.id !== target.id);
      store.sessions = store.sessions.filter((session) => session.userId !== target.id);
      saveStore(store);
      json(res, 200, { ok: true });
      return true;
    }
    fail(res, 405, "不支持这个操作", "method-not-allowed");
    return true;
  }

  if (pathname === "/api/changelog" && method === "GET") {
    json(res, 200, { ok: true, entries: sortedChangelog(store) });
    return true;
  }

  if (pathname === "/api/admin/changelog" && method === "POST") {
    const session = requireAdmin(req, res, store);
    if (!session) return true;
    let body;
    try {
      body = await readBody(req);
    } catch (error) {
      fail(res, 400, error.message, "invalid-body");
      return true;
    }
    const entry = changelogFromBody(body);
    if (!entry.title) {
      fail(res, 400, "请填写更新标题", "invalid-title");
      return true;
    }
    const record = { id: crypto.randomUUID(), ...entry, createdBy: session.user.id };
    store.changelog.push(record);
    saveStore(store);
    json(res, 201, { ok: true, entry: sanitizeChangelog(record) });
    return true;
  }

  const changelogMatch = pathname.match(/^\/api\/admin\/changelog\/([^/]+)$/);
  if (changelogMatch) {
    const session = requireAdmin(req, res, store);
    if (!session) return true;
    const index = store.changelog.findIndex((entry) => entry.id === changelogMatch[1]);
    if (index < 0) {
      fail(res, 404, "日志条目不存在", "not-found");
      return true;
    }
    if (method === "DELETE") {
      store.changelog.splice(index, 1);
      saveStore(store);
      json(res, 200, { ok: true });
      return true;
    }
    if (method === "PATCH") {
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        fail(res, 400, error.message, "invalid-body");
        return true;
      }
      const entry = changelogFromBody({ ...store.changelog[index], ...body });
      if (!entry.title) {
        fail(res, 400, "请填写更新标题", "invalid-title");
        return true;
      }
      store.changelog[index] = { ...store.changelog[index], ...entry };
      saveStore(store);
      json(res, 200, { ok: true, entry: sanitizeChangelog(store.changelog[index]) });
      return true;
    }
    fail(res, 405, "不支持这个操作", "method-not-allowed");
    return true;
  }

  fail(res, 404, "接口不存在", "not-found");
  return true;
}

function safeStaticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return null;
  }
  if (decoded === "/") return path.join(PUBLIC_ROOT, "index.html");
  if (decoded === "/login") return path.join(PUBLIC_ROOT, "login.html");
  if (decoded === "/admin") return path.join(PUBLIC_ROOT, "admin.html");
  const segments = decoded.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith(".") || segment === "server.js")) {
    return null;
  }
  const file = path.resolve(PUBLIC_ROOT, "." + decoded);
  if (!file.startsWith(PUBLIC_ROOT + path.sep)) return null;
  return file;
}

function serveStatic(req, res, pathname) {
  const file = safeStaticPath(pathname);
  if (!file) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  fs.stat(file, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const type = MIME_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stats.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
    });
    fs.createReadStream(file)
      .on("error", () => {
        res.destroy();
      })
      .pipe(res);
  });
}

ensureStore();

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  } catch (error) {
    fail(res, 400, "请求地址无效", "invalid-url");
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) fail(res, 500, "服务器处理请求时出错", "server-error");
      else res.end();
    }
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    fail(res, 405, "不支持这个请求方法", "method-not-allowed");
    return;
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Personal site running at http://${HOST}:${PORT}`);
  console.log("First registered account becomes the site administrator.");
});
