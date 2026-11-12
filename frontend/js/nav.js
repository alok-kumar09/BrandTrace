(function () {
  "use strict";

  const THEME_KEY = "brandtrace.theme";
  const SESSION_KEY = "brandtrace.session";

  // Must match the breakpoint in css/components/11-global-foundations-and-controls.css
  const MOBILE_BREAKPOINT = 900;

  const safe = fn => {
    try {
      return fn();
    } catch (error) {
      return null;
    }
  };

  // ---- Theme ----
  const storedTheme = safe(() => localStorage.getItem(THEME_KEY));

  let theme = storedTheme || (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  );

  document.documentElement.dataset.theme = theme;

  // ---- Session ----
  const session = safe(() =>
    JSON.parse(localStorage.getItem(SESSION_KEY))
  ) || {};

  const userName =
    typeof session.name === "string" && session.name.trim()
      ? session.name.trim()
      : "Demo Judge";

  const userRole =
    typeof session.role === "string" && session.role.trim()
      ? session.role.trim()
      : "Brand Manager";

  const orgName =
    typeof session.org === "string" && session.org.trim()
      ? session.org.trim()
      : "NovaTech Devices";

  // Every item is now its own real page, so active-state is a plain filename match.
  const navLinks = [
    { href: "dashboard.html",  label: "Dashboard",              icon: "📊" },
    { href: "content_analysis.html",      label: "Content Analysis",       icon: "🔍" },
    { href: "guidelines.html", label: "Brand Guidelines",       icon: "⚙️" },
    { href: "history.html",    label: "Review History",         icon: "📜" },
    { href: "approvals.html",  label: "Review Approvals",       icon: "🛡️" },
    { href: "settings.html",   label: "Organisation & Members", icon: "👥" },
    { href: "about.html",      label: "Governance & About",     icon: "ℹ️" },
    { href: "analytics.html", label: "Analytics", icon: "📈" }
  ];

  const current = location.pathname.split("/").pop() || "content_analysis.html";

  const esc = value =>
    String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  const isPublicPage =
    document.body.classList.contains("auth-body") ||
    current === "index.html" ||
    current === "auth.html";

  // ---- Auth guard: protected pages need a real JWT (or explicit offline demo) ----
  const looksLikeJwt = t => typeof t === "string" && t.split(".").length === 3;
  const offlineDemo = safe(() => localStorage.getItem("brandtrace.forceMock")) === "1" && session.mock === true;
  const hasSession = looksLikeJwt(session.access_token || session.token) || offlineDemo;

  if (!isPublicPage && !hasSession) {
    // Drop any stale/mock session so the login page starts clean.
    safe(() => localStorage.removeItem(SESSION_KEY));
    location.replace("auth.html?reason=signin");
    return;
  }

  // ---- Inject Internal Application Shell ----
  if (!isPublicPage) {
    document.body.classList.add("app-shell-layout");

    // Mobile navigation styles load themselves, so no HTML file needs editing.
    if (!document.querySelector('link[href$="css/components/11-global-foundations-and-controls.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "css/components/11-global-foundations-and-controls.css";
      document.head.appendChild(link);
    }

    const sidebarHTML = `
      <aside class="app-sidebar" id="app-sidebar" aria-label="Sidebar">

        <div class="sidebar-header">
          <a class="logo" href="index.html">
            Brand<span>Trace</span>
          </a>

          <div class="org-selector-pill">
            🏢 <strong>${esc(orgName)}</strong>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Main SaaS Navigation">

          ${navLinks.map(link => {
            const active = link.href === current;

            return `
              <a href="${link.href}"
                 class="nav-item${active ? " active" : ""}"
                 ${active ? 'aria-current="page"' : ""}>

                <span class="icon">${link.icon}</span>
                <span class="label">${link.label}</span>

              </a>
            `;
          }).join("")}

        </nav>

        <div class="sidebar-footer">

          <div id="backend-status" class="status-badge-pill">
            ⏳ Checking server…
          </div>

          <div class="sidebar-user">

            <div class="user-avatar">
              ${esc(userName.charAt(0).toUpperCase())}
            </div>

            <div class="user-meta">
              <strong>${esc(userName)}</strong>
              <small>${esc(userRole)}</small>
            </div>

            <button
              id="logout-btn"
              class="icon-btn-sm"
              title="Sign out"
              aria-label="Sign out"
              type="button">
              🚪
            </button>

          </div>
        </div>

      </aside>

      <div class="sidebar-backdrop" id="sidebar-backdrop"></div>
    `;

    const topbarHTML = `
      <header class="app-topbar">

        <button
          id="sidebar-toggle"
          class="hamburger-btn"
          type="button"
          aria-label="Open navigation menu"
          aria-controls="app-sidebar"
          aria-expanded="false">
          ☰
        </button>

        <div class="topbar-right">

          <button
            id="theme-toggle"
            class="icon-btn"
            type="button"
            aria-label="Toggle Theme">
            🌙
          </button>

          <a href="content_analysis.html"
             class="btn btn-primary btn-sm">
            🚀 New Audit
          </a>

        </div>
      </header>
    `;

    // ---- Wrap Main Content ----
    const mainEl =
      document.querySelector("main") ||
      document.body.firstElementChild;

    const wrapper = document.createElement("div");
    wrapper.className = "app-main-container";

    const contentArea = document.createElement("div");
    contentArea.className = "app-content-area";

    wrapper.appendChild(contentArea);
    document.body.prepend(wrapper);

    if (mainEl && mainEl !== wrapper) {
      contentArea.appendChild(mainEl);
    }

    document.body.insertAdjacentHTML("afterbegin", sidebarHTML);
    contentArea.insertAdjacentHTML("afterbegin", topbarHTML);

    // ---- Enterprise Footer (now lists every page, so it is a true fallback) ----
    if (!document.querySelector(".saas-enterprise-footer")) {

      wrapper.insertAdjacentHTML("beforeend", `
        <footer class="saas-enterprise-footer">

          <div>
            <strong>BrandTrace Enterprise</strong>
            · AI-Powered Brand Governance
          </div>

          <div class="footer-links">
            ${navLinks.map(l => `<a href="${l.href}">${l.label}</a>`).join("")}
          </div>

        </footer>
      `);
    }
  }

  // ---- Theme Toggles ----
  const themeToggles = document.querySelectorAll(
    "#theme-toggle, #mobile-theme-toggle"
  );

  const paintThemeButtons = () => {
    themeToggles.forEach(button => {
      button.textContent = theme === "dark" ? "☀️" : "🌙";
    });
  };

  const toggleTheme = () => {
    theme = theme === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = theme;

    safe(() => localStorage.setItem(THEME_KEY, theme));

    paintThemeButtons();
  };

  paintThemeButtons();

  themeToggles.forEach(button => {
    button.addEventListener("click", toggleTheme);
  });

  // ---- Mobile Sidebar (drawer + backdrop) ----
  const sidebar = document.getElementById("app-sidebar");
  const toggleButton = document.getElementById("sidebar-toggle");
  const backdrop = document.getElementById("sidebar-backdrop");

  const setNavOpen = open => {
    if (!sidebar) return;
    sidebar.classList.toggle("mobile-open", open);
    document.body.classList.toggle("nav-open", open);
    toggleButton?.setAttribute("aria-expanded", String(open));
    toggleButton?.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    if (toggleButton) toggleButton.textContent = open ? "✕" : "☰";
  };

  toggleButton?.addEventListener("click", () => {
    setNavOpen(!sidebar.classList.contains("mobile-open"));
  });

  backdrop?.addEventListener("click", () => setNavOpen(false));

  sidebar?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => setNavOpen(false));
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setNavOpen(false);
  });

  // Rotating a tablet or widening the window must never leave the drawer "stuck" open.
  if (window.matchMedia) {
    window
      .matchMedia(`(min-width: ${MOBILE_BREAKPOINT + 1}px)`)
      .addEventListener("change", e => { if (e.matches) setNavOpen(false); });
  }

  // ---- Sign Out ----
  document.querySelectorAll("#logout-btn, [data-logout]").forEach(button => {

    button.addEventListener("click", () => {

      safe(() => {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("brandtrace.forceMock");
      });

      location.href = "auth.html";

    });

  });

  // ---- Backend Status ----
  window.setBackendStatus = function (live) {

    const element = document.getElementById("backend-status");

    if (!element) return;

    element.textContent = live
      ? "🟢 Live API Connected"
      : "🟡 Offline Mock Mode";

    element.style.borderColor = live
      ? "var(--success)"
      : "var(--warning)";

  };

})();