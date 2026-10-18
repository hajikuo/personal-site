(function () {
  "use strict";

  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readString(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeString(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      /* Private mode can reject storage; the page still works for this session. */
    }
  }

  /* ---------------------------------------------------------
     Toasts
     --------------------------------------------------------- */
  const toast = document.getElementById("toast");
  const toastText = document.getElementById("toastText");
  const toastAction = document.getElementById("toastAction");
  let toastTimer = null;

  function hideToast() {
    if (!toast) return;
    toast.classList.remove("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = null;
  }

  function showToast(message, options) {
    if (!toast || !toastText || !toastAction) return;
    const settings = options || {};
    toastText.textContent = message;
    toastAction.hidden = !settings.actionLabel;
    toastAction.textContent = settings.actionLabel || "";
    toastAction.onclick = settings.actionLabel
      ? function () {
          if (typeof settings.onAction === "function") settings.onAction();
          hideToast();
        }
      : null;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(hideToast, settings.duration || 3000);
  }

  /* ---------------------------------------------------------
     Theme
     --------------------------------------------------------- */
  const themeToggle = document.getElementById("themeToggle");
  const themeMeta = document.getElementById("themeColor");
  const themeColor = { light: "#f3efe5", dark: "#10110f" };

  function applyTheme(theme, persist) {
    const next = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    if (themeMeta) themeMeta.setAttribute("content", themeColor[next]);
    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(next === "dark"));
      themeToggle.setAttribute("aria-label", next === "dark" ? "切换到浅色模式" : "切换到深色模式");
    }
    if (persist) writeString("theme", next);
  }

  applyTheme(root.getAttribute("data-theme"), false);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next, true);
    });
  }

  const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
  if (typeof colorScheme.addEventListener === "function") {
    colorScheme.addEventListener("change", function (event) {
      if (!readString("theme")) applyTheme(event.matches ? "dark" : "light", false);
    });
  }

  /* ---------------------------------------------------------
     Header, mobile navigation and scroll progress
     --------------------------------------------------------- */
  const header = document.getElementById("siteHeader");
  const progress = document.getElementById("scrollProgress");
  const toTop = document.getElementById("toTop");
  const burger = document.getElementById("navBurger");
  const navLinks = document.getElementById("navLinks");
  const sectionIds = ["about", "work", "blog", "workbench", "changelog", "contact"];
  let menuOpen = false;
  let scrollQueued = false;

  function setMenu(open) {
    if (!burger || !navLinks) return;
    menuOpen = open;
    navLinks.classList.toggle("is-open", open);
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单");
    document.body.classList.toggle("menu-open", open);
  }

  function updateActiveNav() {
    if (!navLinks) return;
    const marker = window.scrollY + window.innerHeight * 0.32;
    let activeId = "";
    sectionIds.forEach(function (id) {
      const section = document.getElementById(id);
      if (section && section.offsetTop <= marker) activeId = id;
    });
    navLinks.querySelectorAll("a").forEach(function (link) {
      const active = link.getAttribute("href") === "#" + activeId;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  function updateScrollUi() {
    scrollQueued = false;
    const top = window.scrollY;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, top / scrollable)) : 0;
    if (progress) progress.style.width = (ratio * 100).toFixed(2) + "%";
    if (header) header.classList.toggle("is-scrolled", top > 12);
    if (toTop) toTop.classList.toggle("is-visible", top > 620);
    updateActiveNav();
  }

  function queueScrollUi() {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollUi);
  }

  window.addEventListener("scroll", queueScrollUi, { passive: true });
  window.addEventListener("resize", queueScrollUi, { passive: true });

  if (burger && navLinks) {
    burger.addEventListener("click", function () {
      setMenu(!menuOpen);
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setMenu(false);
      });
    });

    document.addEventListener("click", function (event) {
      if (!menuOpen) return;
      if (event.target.closest(".nav")) return;
      setMenu(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && menuOpen) {
        setMenu(false);
        burger.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900 && menuOpen) setMenu(false);
    });
  }

  if (toTop) {
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    });
  }

  updateScrollUi();

  /* ---------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------- */
  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  root.classList.add("reveal-ready");

  if ("IntersectionObserver" in window && !reducedMotion) {
    const revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -5% 0px" }
    );
    revealElements.forEach(function (element) {
      revealObserver.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add("is-visible");
    });
  }

  /* ---------------------------------------------------------
     Project filtering
     --------------------------------------------------------- */
  const filters = Array.from(document.querySelectorAll("[data-filter]"));
  const projectCards = Array.from(document.querySelectorAll(".project-card"));

  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      const filter = button.dataset.filter;
      filters.forEach(function (item) {
        const active = item === button;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-pressed", String(active));
      });
      projectCards.forEach(function (card) {
        const visible = filter === "all" || card.dataset.category === filter;
        card.classList.toggle("is-hidden", !visible);
        card.classList.toggle("is-visible", visible);
        card.setAttribute("aria-hidden", String(!visible));
      });
    });
  });

  /* ---------------------------------------------------------
     Detail dialog data
     --------------------------------------------------------- */
  const projectData = {
    workbench: {
      kicker: "WEB / TOOL · 2026",
      title: "个人学习工作台",
      status: "已上线",
      lead: "把待办、打卡和最近的进展收进一个页面，让每天的学习节奏变得可见。",
      sections: [
        ["出发点", "我希望打开个人网站时，不只看简历，也能顺手记录今天要做什么、坚持了多久。"],
        ["做了什么", "用原生 JavaScript 和 localStorage 做了一个轻量工作台，包含待办筛选、连续打卡、数据概览和最近动态。"],
        ["下一步", "把学习笔记和项目进度也接进来，并在需要时尝试和云端账号系统联动。"],
      ],
      tags: ["HTML / CSS", "JavaScript", "localStorage", "响应式"],
      link: { href: "#workbench", label: "直接体验工作台" },
      note: "这个项目就在当前页面下方，可以直接添加待办或打卡。",
    },
    modeling: {
      kicker: "MODELING / NOTES · ONGOING",
      title: "数学建模可视化笔记",
      status: "整理中",
      lead: "把建模思路、公式和结果整理成可回看的页面，让一次分析不只停在论文里。",
      sections: [
        ["为什么做", "数学建模里真正有价值的，往往是从问题到假设、再到结果的推理过程。散落在文档里的过程很难回看。"],
        ["正在整理", "从常见的评价、预测类问题入手，把问题拆解、模型选择和结果解释整理成更适合阅读的页面。"],
        ["下一步", "补充可交互的图表和参数示例，让读者能自己改一改、看一看结果如何变化。"],
      ],
      tags: ["数学建模", "数据可视化", "学习笔记"],
      link: { href: "#blog", label: "看看相关笔记" },
      note: "这是一个持续整理中的方向，内容会逐步补充。",
    },
    automation: {
      kicker: "AI / AUTOMATION · ONGOING",
      title: "自动化 × AI 实验室",
      status: "探索中",
      lead: "关注感知、决策与执行链路，记录课程之外的小实验，把学到的概念跑起来。",
      sections: [
        ["关注什么", "自动化专业给了我理解系统的方式，AI 则提供了新的工具。我想看看两者结合后，能不能解决一些具体的小问题。"],
        ["现在做什么", "以学习和复现为主，记录从传感器数据到简单决策，再到执行反馈的完整链路。"],
        ["下一步", "从一个小场景开始做可演示的原型，并把过程整理成可以复用的实验记录。"],
      ],
      tags: ["AI", "自动化", "实验记录"],
      link: { href: "#contact", label: "交流这个方向" },
      note: "实验还在早期阶段，欢迎交流思路。",
    },
    motion: {
      kicker: "MOTION / VISUAL · ONGOING",
      title: "动效练习场",
      status: "练习中",
      lead: "用动画拆解运动规律与界面反馈，练习把一件事讲清楚，而不只是加一点效果。",
      sections: [
        ["为什么做", "动画不只是装饰。节奏、停顿和方向都会影响信息被理解的方式。"],
        ["练习内容", "从简单的位移、缓动和状态反馈开始，观察不同参数如何改变观看感受。"],
        ["下一步", "把练习整理成一组短小的案例，记录每次调整前后的差别。"],
      ],
      tags: ["动画", "动效", "视觉表达"],
      link: { href: "#contact", label: "一起交流创作" },
      note: "页面中的项目封面也用了 SVG 绘制，算是一次小型视觉练习。",
    },
  };

  const noteData = {
    workbench: {
      kicker: "工程笔记 · 2026-10-12",
      title: "把工作台搬到首页之后，我重新理解了「记录」",
      meta: ["4 MIN READ", "工程笔记"],
      lead: "待办和打卡不只是功能，它们让抽象的「坚持」变成了每天都能看见的一小步。",
      paragraphs: [
        "一开始做工作台，只是想给个人网站增加一点互动。后来发现，真正有用的不是「有这些功能」，而是它们能把一个模糊的状态变得具体：今天要做什么，已经完成了多少，上一次坐下来学习是什么时候。",
        "待办清单让我把任务写得更小。以前会在脑子里放着一句「今天要学 AI」，现在会拆成「看完一节课程」「把示例跑通」「记录一个问题」。任务变小之后，开始变得容易，完成也变得可见。",
        "打卡则更像一个温柔的提醒。连续天数当然不是目的，但它提供了一个信号：我最近有没有给自己留出一点固定的时间。即使中断，也可以从今天重新开始。",
        "这次重做页面时，我尽量让工作台保持轻量。数据只存在浏览器里，不需要注册，也不会因为网络问题而影响使用。先把最简单的闭环做顺，再考虑要不要接云端。",
      ],
      quote: "记录不是为了证明自己很努力，而是为了看清下一步该往哪里走。",
    },
    "ai-learning": {
      kicker: "学习记录 · 2026-09-28",
      title: "大二这一年，我想把 AI 学得更「能用」",
      meta: ["5 MIN READ", "学习记录"],
      lead: "从看教程到做小工具，真正让我理解一个概念的，往往是把它放进具体问题里。",
      paragraphs: [
        "自动化专业的学习让我习惯从系统角度看问题：输入是什么，状态如何变化，输出能不能反馈回来。接触 AI 之后，我很自然地开始想，这些方法能不能放进同一条链路里。",
        "但只看教程很容易产生一种错觉：每一步都看懂了，合起来却不知道怎么用。后来我给自己换了一个标准——每学一个概念，就尝试做一个很小、但能运行的东西。",
        "小工具不需要复杂。它可能只是一个整理文本的脚本，一个把数据画成图的页面，或者一个能根据输入给出建议的简单应用。重点是让它真的跑起来，然后观察哪里不符合预期。",
        "这一年我想少追一点新名词，多留一点时间在具体问题上。把 AI 学得更「能用」，大概就是知道什么时候该用它，也知道什么时候不该用。",
      ],
      quote: "理解一个概念，往往发生在把它做出来之后。",
    },
    motion: {
      kicker: "创作手记 · 2026-09-10",
      title: "用动画讲清楚一件事，比堆效果更难",
      meta: ["3 MIN READ", "创作手记"],
      lead: "节奏、停顿和方向都在传递信息。好的动效应该帮助理解，而不是抢走注意力。",
      paragraphs: [
        "刚开始做动画时，很容易被各种效果吸引：弹跳、发光、粒子、转场。效果本身没有错，但如果它们和内容没有关系，观众记住的就只有效果。",
        "后来我试着先问自己：这一秒想让观众注意到什么？如果答案是「这里发生了变化」，那么动画就应该把变化的方向和因果关系讲清楚，而不是同时制造更多变化。",
        "节奏也很重要。该快的地方要快，该停下来的地方要留白。一个短暂的停顿，有时候比多加十个关键帧更能帮助理解。",
        "现在做练习时，我会先做一版几乎没有装饰的动画，只保留必要的位移和状态变化。等信息讲清楚了，再考虑要不要加一点质感。",
      ],
      quote: "动效的第一目标不是好看，而是让信息更容易被看见。",
    },
  };

  const detailDialog = document.getElementById("detailDialog");
  const detailContent = document.getElementById("detailContent");
  const detailClose = document.getElementById("detailClose");
  let dialogTrigger = null;

  function openDialog(html, trigger) {
    if (!detailDialog || !detailContent) return;
    dialogTrigger = trigger || document.activeElement;
    detailContent.innerHTML = html;
    document.body.classList.add("modal-open");
    if (typeof detailDialog.showModal === "function") {
      detailDialog.showModal();
    } else {
      detailDialog.setAttribute("open", "");
    }
  }

  function closeDialog() {
    if (!detailDialog) return;
    if (typeof detailDialog.close === "function" && detailDialog.open) detailDialog.close();
    else detailDialog.removeAttribute("open");
    document.body.classList.remove("modal-open");
    if (dialogTrigger && typeof dialogTrigger.focus === "function") dialogTrigger.focus();
  }

  function projectHtml(project) {
    const sections = project.sections
      .map(function (section) {
        return (
          '<section class="detail__section"><h4>' +
          escapeHtml(section[0]) +
          "</h4><p>" +
          escapeHtml(section[1]) +
          "</p></section>"
        );
      })
      .join("");
    const tags = project.tags
      .map(function (tag) {
        return "<span>" + escapeHtml(tag) + "</span>";
      })
      .join("");
    return (
      '<p class="detail__kicker">' +
      escapeHtml(project.kicker) +
      '</p><h2 class="detail__title" id="detailTitle">' +
      escapeHtml(project.title) +
      '</h2><p class="detail__lead">' +
      escapeHtml(project.lead) +
      '</p><div class="detail__meta"><span>' +
      escapeHtml(project.status) +
      "</span></div>" +
      '<div class="detail__sections">' +
      sections +
      '</div><div class="detail__tags">' +
      tags +
      '</div><div class="detail__actions"><a class="btn btn--primary" href="' +
      escapeHtml(project.link.href) +
      '">' +
      escapeHtml(project.link.label) +
      ' <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"></path></svg></a>' +
      '<button class="btn btn--ghost" type="button" data-close-dialog>关闭</button></div>' +
      '<p class="detail__note">' +
      escapeHtml(project.note) +
      "</p>"
    );
  }

  function noteHtml(note) {
    const meta = note.meta
      .map(function (item) {
        return "<span>" + escapeHtml(item) + "</span>";
      })
      .join("");
    const paragraphs = note.paragraphs
      .map(function (paragraph) {
        return "<p>" + escapeHtml(paragraph) + "</p>";
      })
      .join("");
    return (
      '<p class="detail__kicker">' +
      escapeHtml(note.kicker) +
      '</p><h2 class="detail__title" id="detailTitle">' +
      escapeHtml(note.title) +
      '</h2><p class="detail__lead">' +
      escapeHtml(note.lead) +
      '</p><div class="detail__meta">' +
      meta +
      '</div><div class="detail__article">' +
      paragraphs +
      "<blockquote>" +
      escapeHtml(note.quote) +
      "</blockquote></div>" +
      '<div class="detail__actions"><button class="btn btn--primary" type="button" data-close-dialog>读完了</button></div>' +
      '<p class="detail__note">这是一篇随笔草稿，内容会继续补充。</p>'
    );
  }

  projectCards.forEach(function (card) {
    card.addEventListener("click", function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const key = card.dataset.project;
      if (!key || !projectData[key]) return;
      event.preventDefault();
      openDialog(projectHtml(projectData[key]), card);
    });
  });

  document.querySelectorAll("[data-note]").forEach(function (button) {
    button.addEventListener("click", function () {
      const key = button.dataset.note;
      if (!key || !noteData[key]) return;
      openDialog(noteHtml(noteData[key]), button);
    });
  });

  if (detailClose) {
    detailClose.addEventListener("click", closeDialog);
  }

  if (detailDialog) {
    detailDialog.addEventListener("click", function (event) {
      if (event.target === detailDialog) closeDialog();
    });
    detailDialog.addEventListener("close", function () {
      document.body.classList.remove("modal-open");
    });
  }

  if (detailContent) {
    detailContent.addEventListener("click", function (event) {
      const closeButton = event.target.closest("[data-close-dialog]");
      if (closeButton) {
        closeDialog();
        return;
      }
      const anchor = event.target.closest('a[href^="#"]');
      if (!anchor) return;
      const targetId = anchor.getAttribute("href");
      const target = targetId.length > 1 ? document.querySelector(targetId) : null;
      if (!target) return;
      event.preventDefault();
      closeDialog();
      window.setTimeout(function () {
        target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
      }, 60);
    });
  }

  /* ---------------------------------------------------------
     Workbench: todos
     --------------------------------------------------------- */
  const todoForm = document.getElementById("todoForm");
  const todoInput = document.getElementById("todoInput");
  const todoList = document.getElementById("todoList");
  const todoCount = document.getElementById("todoCount");
  const clearDone = document.getElementById("clearDone");
  const todoFilterButtons = Array.from(document.querySelectorAll("[data-todo-filter]"));
  const todoCountLabels = Array.from(document.querySelectorAll("[data-todo-count]"));
  const statTodo = document.getElementById("statTodo");
  const statStreak = document.getElementById("statStreak");
  const statProjects = document.getElementById("statProjects");
  const statNotes = document.getElementById("statNotes");
  const checkinWeek = document.getElementById("checkinWeek");
  const checkinBtn = document.getElementById("checkinBtn");
  const streakNum = document.getElementById("streakNum");
  const confettiLayer = document.getElementById("confettiLayer");

  const TODO_KEY = "wb_todos";
  const CHECK_KEY = "wb_checkins";
  let todos = readJson(TODO_KEY, []);
  let todoFilter = "all";

  if (!Array.isArray(todos)) todos = [];
  todos = todos
    .filter(function (item) {
      return item && typeof item.text === "string";
    })
    .map(function (item, index) {
      return {
        id: Number(item.id) || Date.now() + index,
        text: item.text,
        done: Boolean(item.done),
      };
    });

  function saveTodos() {
    writeJson(TODO_KEY, todos);
  }

  function visibleTodos() {
    if (todoFilter === "active") return todos.filter(function (item) { return !item.done; });
    if (todoFilter === "done") return todos.filter(function (item) { return item.done; });
    return todos;
  }

  function updateTodoStats() {
    const active = todos.filter(function (item) { return !item.done; }).length;
    const done = todos.length - active;
    if (todoCount) todoCount.textContent = active + " 项待完成";
    todoCountLabels.forEach(function (label) {
      const type = label.dataset.todoCount;
      label.textContent = String(type === "active" ? active : type === "done" ? done : todos.length);
    });
    if (clearDone) clearDone.disabled = done === 0;
    if (statTodo) statTodo.textContent = done + "/" + todos.length;
  }

  function renderTodos() {
    if (!todoList) return;
    const items = visibleTodos();
    todoList.innerHTML = "";
    if (items.length === 0) {
      const empty = document.createElement("li");
      empty.className = "todo-empty";
      const copy = todoFilter === "done"
        ? ["还没有完成项", "完成一条待办后，它会出现在这里。"]
        : todoFilter === "active"
          ? ["现在没有进行中的任务", "给今天加一件小事，或者切回「全部」看看。"]
          : ["清单还是空的", "从一件五分钟能做的小事开始。"];
      empty.innerHTML = "<div><strong>" + copy[0] + "</strong>" + copy[1] + "</div>";
      todoList.appendChild(empty);
    } else {
      items.forEach(function (item) {
        const li = document.createElement("li");
        li.className = "todo-item" + (item.done ? " is-done" : "");
        li.dataset.id = String(item.id);
        li.innerHTML =
          '<input type="checkbox" ' +
          (item.done ? "checked " : "") +
          'aria-label="' +
          (item.done ? "标记为未完成：" : "标记为完成：") +
          escapeHtml(item.text) +
          '">' +
          '<span class="todo-text">' +
          escapeHtml(item.text) +
          "</span>" +
          '<button class="todo-delete" type="button" aria-label="删除：' +
          escapeHtml(item.text) +
          '"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 3h4M6 6l1 11h6l1-11M9 9v5M11 9v5"></path></svg></button>';
        todoList.appendChild(li);
      });
    }
    updateTodoStats();
  }

  if (todoForm && todoInput) {
    todoForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const text = todoInput.value.trim();
      if (!text) {
        todoInput.focus();
        showToast("先写下一件想做的事");
        return;
      }
      todos.unshift({
        id: Date.now() + Math.floor(Math.random() * 1000),
        text: text,
        done: false,
      });
      todoInput.value = "";
      saveTodos();
      todoFilter = "all";
      syncTodoFilterButtons();
      renderTodos();
      todoInput.focus();
      showToast("已添加到今天的清单");
    });
  }

  function syncTodoFilterButtons() {
    todoFilterButtons.forEach(function (button) {
      const active = button.dataset.todoFilter === todoFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  todoFilterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      todoFilter = button.dataset.todoFilter;
      syncTodoFilterButtons();
      renderTodos();
    });
  });

  if (todoList) {
    todoList.addEventListener("change", function (event) {
      const checkbox = event.target.closest('input[type="checkbox"]');
      if (!checkbox) return;
      const row = checkbox.closest(".todo-item");
      if (!row) return;
      const item = todos.find(function (todo) { return String(todo.id) === row.dataset.id; });
      if (!item) return;
      item.done = checkbox.checked;
      saveTodos();
      renderTodos();
      showToast(item.done ? "完成了一件小事" : "已放回进行中", { duration: 1800 });
    });

    todoList.addEventListener("click", function (event) {
      const deleteButton = event.target.closest(".todo-delete");
      if (!deleteButton) return;
      const row = deleteButton.closest(".todo-item");
      if (!row) return;
      const index = todos.findIndex(function (todo) { return String(todo.id) === row.dataset.id; });
      if (index < 0) return;
      const removed = todos[index];
      todos.splice(index, 1);
      saveTodos();
      renderTodos();
      showToast("已删除一条待办", {
        actionLabel: "撤销",
        duration: 4200,
        onAction: function () {
          todos.splice(Math.min(index, todos.length), 0, removed);
          saveTodos();
          renderTodos();
          showToast("已撤销删除");
        },
      });
    });
  }

  if (clearDone) {
    clearDone.addEventListener("click", function () {
      const completed = todos.filter(function (item) { return item.done; });
      if (completed.length === 0) return;
      const previous = todos.slice();
      todos = todos.filter(function (item) { return !item.done; });
      saveTodos();
      renderTodos();
      showToast("已清除 " + completed.length + " 条已完成待办", {
        actionLabel: "撤销",
        duration: 4500,
        onAction: function () {
          todos = previous;
          saveTodos();
          renderTodos();
          showToast("已恢复待办");
        },
      });
    });
  }

  /* ---------------------------------------------------------
     Workbench: check-ins
     --------------------------------------------------------- */
  const weekday = ["日", "一", "二", "三", "四", "五", "六"];
  let checkins = readJson(CHECK_KEY, []);
  if (!Array.isArray(checkins)) checkins = [];
  checkins = Array.from(new Set(checkins.filter(function (item) {
    return typeof item === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item);
  }))).sort();

  function dateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  const today = new Date();
  const todayKey = dateKey(today);

  function lastSevenDays() {
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      days.push(day);
    }
    return days;
  }

  function computeStreak() {
    let streak = 0;
    const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (checkins.indexOf(dateKey(cursor)) === -1) cursor.setDate(cursor.getDate() - 1);
    while (checkins.indexOf(dateKey(cursor)) !== -1) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderCheckins() {
    const streak = computeStreak();
    if (streakNum) streakNum.textContent = String(streak);
    if (statStreak) statStreak.textContent = String(streak);
    if (checkinWeek) {
      checkinWeek.innerHTML = lastSevenDays()
        .map(function (day) {
          const key = dateKey(day);
          const checked = checkins.indexOf(key) !== -1;
          const classes = ["day"];
          if (key === todayKey) classes.push("is-today");
          if (checked) classes.push("is-checked");
          return (
            '<div class="' +
            classes.join(" ") +
            '" title="' +
            key +
            (checked ? " 已打卡" : " 未打卡") +
            '"><span class="day__week">' +
            weekday[day.getDay()] +
            '</span><span class="day__date">' +
            String(day.getDate()).padStart(2, "0") +
            "</span></div>"
          );
        })
        .join("");
    }
    if (checkinBtn) {
      const doneToday = checkins.indexOf(todayKey) !== -1;
      const label = checkinBtn.querySelector("span");
      if (label) label.textContent = doneToday ? "今天已打卡" : "今天打卡";
      checkinBtn.classList.toggle("is-done", doneToday);
      checkinBtn.setAttribute("aria-pressed", String(doneToday));
    }
  }

  function burstConfetti(origin) {
    if (!confettiLayer || reducedMotion || !origin) return;
    const rect = origin.getBoundingClientRect();
    const colors = ["#e85d3f", "#b9d94c", "#3f5bd9", "#f3efe5"];
    for (let index = 0; index < 16; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = rect.left + rect.width / 2 + "px";
      piece.style.top = rect.top + rect.height / 2 + "px";
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--dx", (Math.random() * 240 - 120).toFixed(0) + "px");
      piece.style.setProperty("--dy", (Math.random() * 150 + 55).toFixed(0) + "px");
      piece.style.setProperty("--rot", (Math.random() * 520 - 260).toFixed(0) + "deg");
      piece.style.animationDelay = (Math.random() * 0.08).toFixed(2) + "s";
      confettiLayer.appendChild(piece);
      window.setTimeout(function () {
        piece.remove();
      }, 1200);
    }
  }

  if (checkinBtn) {
    checkinBtn.addEventListener("click", function () {
      const index = checkins.indexOf(todayKey);
      if (index === -1) {
        checkins.push(todayKey);
        checkins.sort();
        writeJson(CHECK_KEY, checkins);
        renderCheckins();
        burstConfetti(checkinBtn);
        showToast("今天也留下了痕迹");
      } else {
        checkins.splice(index, 1);
        writeJson(CHECK_KEY, checkins);
        renderCheckins();
        showToast("已取消今天的打卡", { duration: 2200 });
      }
    });
  }

  /* ---------------------------------------------------------
     Workbench: count summary
     --------------------------------------------------------- */
  function updateSummary() {
    if (statProjects) {
      statProjects.textContent = String(projectCards.length).padStart(2, "0");
    }
    if (statNotes) {
      statNotes.textContent = String(Object.keys(noteData).length).padStart(2, "0");
    }
  }

  /* ---------------------------------------------------------
     Changelog preview
     --------------------------------------------------------- */
  const changelogPreview = document.getElementById("changelogPreview");
  const changelogLabels = {
    feature: "功能",
    design: "设计",
    fix: "修复",
    release: "上线",
    update: "更新",
  };

  function renderChangelog(entries) {
    if (!changelogPreview || !Array.isArray(entries) || entries.length === 0) return;
    changelogPreview.innerHTML = entries
      .slice(0, 3)
      .map(function (entry) {
        const items = (Array.isArray(entry.items) ? entry.items : [])
          .map(function (item) {
            return "<li>" + escapeHtml(item) + "</li>";
          })
          .join("");
        return (
          '<article class="change-item">' +
          '<div class="change-item__meta"><span class="change-version">v' +
          escapeHtml(entry.version || "—") +
          "</span><time datetime=\"" +
          escapeHtml(entry.date) +
          '">' +
          escapeHtml(entry.date) +
          '</time><span class="change-type">' +
          escapeHtml(changelogLabels[entry.type] || "更新") +
          '</span></div><div class="change-item__body"><h3>' +
          escapeHtml(entry.title) +
          "</h3><ul>" +
          items +
          "</ul></div></article>"
        );
      })
      .join("");
  }

  if (changelogPreview) {
    fetch("/api/changelog", { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error("Changelog unavailable");
        return response.json();
      })
      .then(function (data) {
        if (data && data.ok) renderChangelog(data.entries);
      })
      .catch(function () {
        /* The static fallback already contains the latest entries. */
      });
  }

  /* ---------------------------------------------------------
     Copy buttons
     --------------------------------------------------------- */
  function fallbackCopy(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
    field.remove();
    return copied;
  }

  document.querySelectorAll("[data-copy]").forEach(function (button) {
    button.addEventListener("click", async function () {
      const text = button.dataset.copy || "";
      let copied = false;
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (error) {
        copied = fallbackCopy(text);
      }
      if (!copied) {
        showToast("复制失败，请手动选择内容");
        return;
      }
      const placeholder = /example\.com|yourname/i.test(text);
      const copyLabel = button.dataset.copyLabel || "内容";
      showToast(placeholder ? "已复制占位内容，记得替换成你的联系方式" : copyLabel + "已复制");
    });
  });

  /* ---------------------------------------------------------
     Footer year
     --------------------------------------------------------- */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------------------------------------------------------
     Initial render
     --------------------------------------------------------- */
  syncTodoFilterButtons();
  renderTodos();
  renderCheckins();
  updateSummary();
})();
