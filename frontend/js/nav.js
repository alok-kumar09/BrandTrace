
(function () {
  const THEME_KEY = "brandtrace.theme", SESSION_KEY = "brandtrace.session";
  const safe = fn => { try { return fn(); } catch (e) { return null; } };

  // ---- Theme ----
  const stored = safe(() => localStorage.getItem(THEME_KEY));
  let theme = stored || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;

  // ---- Session ----
  const session = safe(() => JSON.parse(localStorage.getItem(SESSION_KEY)));

  const links = [
    { href: "landing.html", label: "Home" },
    { href: "index.html", label: "Dashboard" },
    { href: "guidelines.html", label: "Guidelines" },
    { href: "settings.html", label: "Settings" },
    { href: "about.html", label: "About" },
  ];

  const current = location.pathname.split("/").pop() || "index.html";
  const items = links.map(l =>
    `<a href="${l.href}" class="${l.href === current ? "active" : ""}">${l.label}</a>`
  ).join("");

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

  // ---- User session ----
  const userHTML = (mobile = false) => session
    ? `<div class="user-chip">
        <span>👤 ${esc(session.name)} · <small>${esc(session.role)}</small></span>
        <button id="${mobile ? "mobile-logout-btn" : "logout-btn"}" class="link-btn" data-logout type="button">Sign out</button>
      </div>`
    : `<a class="btn btn-primary btn-sm" href="auth.html">Sign in</a>`;

  // ---- Header structure ----
  const header = document.createElement("header");
  header.className = "site-header";

  header.innerHTML = `
    <div class="header-inner">
      <a class="logo" href="landing.html">Brand<span>Trace</span></a>
      <nav class="nav-links" aria-label="Main navigation">${items}</nav>
      <div id="backend-status" class="status-badge">🟡 Checking…</div>
      <button id="hamburger-toggle" class="hamburger-btn" type="button"
        aria-label="Toggle navigation menu" aria-expanded="false"
        aria-controls="mobile-nav-drawer">☰</button>
      <button id="theme-toggle" class="icon-btn" type="button"
        aria-label="Toggle dark mode"></button>
      <div class="desktop-session">${userHTML()}</div>
    </div>
    <div id="mobile-nav-drawer" class="mobile-nav-drawer"
      aria-label="Mobile navigation" aria-hidden="true">
      <nav class="mobile-nav-links" aria-label="Mobile main navigation">${items}</nav>
      <div class="mobile-nav-footer">
        ${userHTML(true)}
        <button id="mobile-theme-toggle" class="icon-btn" type="button"
          aria-label="Toggle dark mode"></button>
      </div>
    </div>
  `;

  document.body.prepend(header);

  // ---- Theme controls ----
  const themeToggles = [
    document.getElementById("theme-toggle"),
    document.getElementById("mobile-theme-toggle")
  ];

  const paint = () => {
    themeToggles.forEach(toggle => {
      toggle.textContent = theme === "dark" ? "☀️" : "🌙";
      toggle.title = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
    });
  };

  const toggleTheme = () => {
    theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    safe(() => localStorage.setItem(THEME_KEY, theme));
    paint();
  };

  paint();
  themeToggles.forEach(toggle => toggle.addEventListener("click", toggleTheme));

  // ---- Mobile navigation drawer ----
  const hamburger = document.getElementById("hamburger-toggle");
  const drawer = document.getElementById("mobile-nav-drawer");

  const closeMenu = () => {
    drawer.classList.remove("open");
    hamburger.textContent = "☰";
    hamburger.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
  };

  const openMenu = () => {
    drawer.classList.add("open");
    hamburger.textContent = "✕";
    hamburger.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
  };

  const toggleMenu = () => {
    drawer.classList.contains("open") ? closeMenu() : openMenu();
  };

  hamburger.addEventListener("click", toggleMenu);

  // Close when a navigation link is selected.
  drawer.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", closeMenu);
  });

  // Close when clicking outside the drawer and hamburger.
  document.addEventListener("click", event => {
    if (!drawer.contains(event.target) && !hamburger.contains(event.target)) {
      closeMenu();
    }
  });

  // Close when Escape is pressed.
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  // ---- Logout ----
  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", () => {
      safe(() => localStorage.removeItem(SESSION_KEY));
      location.href = "landing.html";
    });
  });

  // ---- Backend status ----
  window.setBackendStatus = function (live) {
    const el = document.getElementById("backend-status");
    if (el) el.textContent = live ? "🟢 Live API" : "🟡 Mock Mode";
  };
})();
