
(function () {
  "use strict";

  const THEME_KEY = "brandtrace.theme";
  const SESSION_KEY = "brandtrace.session";

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

  const navLinks = [
    { href: "index.html", label: "Dashboard", icon: "📊" },
    { href: "index.html#workbench", label: "Content Analysis", icon: "🔍" },
    { href: "guidelines.html", label: "Brand Guidelines", icon: "⚙️" },
    { href: "history.html", label: "Review History", icon: "📜" },
    { href: "approvals.html", label: "Review Approvals", icon: "🛡️" },
    { href: "settings.html", label: "Organisation & Members", icon: "👥" },
    { href: "about.html", label: "Governance & About", icon: "ℹ️" }
  ];

  const current = location.pathname.split("/").pop() || "index.html";

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
    current === "landing.html" ||
    current === "auth.html";

  // ---- Inject Internal Application Shell ----
  if (!isPublicPage) {
    document.body.classList.add("app-shell-layout");

    const sidebarHTML = `
      <aside class="app-sidebar" id="app-sidebar">

        <div class="sidebar-header">
          <a class="logo" href="landing.html">
            Brand<span>Trace</span>
          </a>

          <div class="org-selector-pill">
            🏢 <strong>${esc(orgName)}</strong>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Main SaaS Navigation">

          ${navLinks.map(link => {
            const active =
              link.href === current ||
              (
                link.href === "index.html#workbench" &&
                current === "index.html" &&
                location.hash === "#workbench"
              );

            return `
              <a href="${link.href}"
                 class="nav-item${active ? " active" : ""}">

                <span class="icon">${link.icon}</span>
                <span class="label">${link.label}</span>

              </a>
            `;
          }).join("")}

        </nav>

        <div class="sidebar-footer">

          <div id="backend-status" class="status-badge-pill">
            🟡 Live API
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
    `;

    const topbarHTML = `
      <header class="app-topbar">

        <button
          id="sidebar-toggle"
          class="hamburger-btn"
          type="button"
          aria-label="Toggle Navigation">
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

          <a href="index.html#workbench"
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

    document.body.insertAdjacentHTML(
      "afterbegin",
      sidebarHTML
    );

    contentArea.insertAdjacentHTML(
      "afterbegin",
      topbarHTML
    );

    // ---- Enterprise Footer ----
    if (!document.querySelector(".saas-enterprise-footer")) {

      wrapper.insertAdjacentHTML("beforeend", `
        <footer class="saas-enterprise-footer">

          <div>
            <strong>BrandTrace Enterprise</strong>
            · AI-Powered Brand Governance
          </div>

          <div class="footer-links">
            <a href="index.html">Dashboard</a>
            <a href="guidelines.html">Guidelines</a>
            <a href="history.html">History Log</a>
            <a href="approvals.html">Approvals</a>
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

    safe(() =>
      localStorage.setItem(THEME_KEY, theme)
    );

    paintThemeButtons();
  };

  paintThemeButtons();

  themeToggles.forEach(button => {
    button.addEventListener("click", toggleTheme);
  });

  // ---- Mobile Sidebar ----
  const sidebar = document.getElementById("app-sidebar");
  const toggleButton = document.getElementById("sidebar-toggle");

  const closeMobileSidebar = () => {
    sidebar?.classList.remove("mobile-open");
  };

  toggleButton?.addEventListener("click", event => {
    event.stopPropagation();
    sidebar?.classList.toggle("mobile-open");
  });

  sidebar?.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMobileSidebar);
  });

  document.addEventListener("click", event => {

    if (
      sidebar?.classList.contains("mobile-open") &&
      !sidebar.contains(event.target) &&
      event.target !== toggleButton
    ) {
      closeMobileSidebar();
    }

  });

  // ---- Sign Out ----
  document.querySelectorAll(
    "#logout-btn, [data-logout]"
  ).forEach(button => {

    button.addEventListener("click", () => {

      safe(() => {
        localStorage.removeItem(SESSION_KEY);
      });

      location.href = "auth.html";

    });

  });

  // ---- Backend Status ----
  window.setBackendStatus = function (live) {

    const element = document.getElementById(
      "backend-status"
    );

    if (!element) return;

    element.textContent = live
      ? "🟢 Live API Connected"
      : "🟡 Offline Mock Mode";

    element.style.borderColor = live
      ? "var(--success)"
      : "var(--warning)";

  };

})();
