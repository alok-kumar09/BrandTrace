(function () {
  // auth.html may not include api.js: load it ourselves, then start.
  function boot() {
    if (typeof ApiClient !== "undefined") return init();
    const el = document.createElement("script");
    el.src = "js/api.js";
    el.onload = init;
    el.onerror = () => {
      const box = document.getElementById("auth-error");
      if (box) box.textContent = "Could not load js/api.js. Check the script path in auth.html.";
    };
    document.head.appendChild(el);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  function init() {
  const KEY = "brandtrace.session";
  const $ = id => document.getElementById(id);
  let mode = "login";

  const DEMO = { email: "admin@brandtrace.demo", password: "Demo@12345" };

  // A stale/mock session must never survive a visit to the login page.
  ApiClient.clearSession();

  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
    $("name-group").style.display = mode === "login" ? "none" : "";
    $("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("auth-error").textContent = "";
  }));
  
  function showError(msg) { $("auth-error").textContent = msg; }

  function setBusy(busy) {
    const btn = $("auth-submit");
    btn.disabled = busy;
    if (busy) { btn.dataset.label = btn.textContent; btn.textContent = "Please wait…"; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  }

  function saveSession(res, fallbackEmail) {
    const u = res.user || {};
    ApiClient.setMock(false);
    ApiClient.saveSession({
      access_token: res.access_token,
      token: res.access_token,
      user_id: u.id,
      name: u.name,
      email: u.email || fallbackEmail,
      role: u.role || "Member",
      org_id: u.organisation_id,
      org: u.organisation_name || "Organisation",
      mock: false,
    });
  }

  async function handleAuth(e) {
    e.preventDefault();
    showError("");

    const email = $("email").value.trim().toLowerCase();
    const pw = $("password").value;
    const name = ($("name")?.value || "").trim() || email.split("@")[0];

    if (!/^\S+@\S+\.\S+$/.test(email)) return showError("Please enter a valid email address.");
    if (pw.length < 8) return showError("Password must be at least 8 characters.");
    if (mode === "register" && !name) return showError("Please enter your name.");

    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
    const payload = mode === "login" ? { email, password: pw } : { name, email, password: pw };

    setBusy(true);
    try {
      const res = await ApiClient.request("POST", endpoint, payload, undefined, { auth: false });
      if (!res || !res.access_token) throw new ApiClient.ApiError("Server did not return a session token.", 500);
      saveSession(res, email);
      location.href = "content_analysis.html";
    } catch (err) {
      // NEVER fabricate a session here: show the real reason instead.
      if (err.status === 0 || err.name === "TypeError") {
        showError("Cannot reach the BrandTrace server at " + ApiClient.base + ". Is the backend running?");
      } else if (err.status === 409) {
        showError("An account with this email already exists. Switch to “Sign in”.");
      } else if (err.status === 401) {
        showError("Invalid email or password.");
      } else {
        showError(err.message || "Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  $("auth-form").addEventListener("submit", handleAuth);

  // Judge / demo button: sign in to the seeded demo account for REAL.
  // Only if the server is unreachable do we drop into clearly-labelled offline mode.
  $("guest-btn").addEventListener("click", async () => {
    showError("");
    try {
      const res = await ApiClient.request("POST", "/auth/login", DEMO, undefined, { auth: false });
      saveSession(res, DEMO.email);
      location.href = "content_analysis.html";
    } catch (err) {
      if (err.status === 0 || err.name === "TypeError") {
        ApiClient.setMock(true);
        ApiClient.saveSession({
          access_token: null, token: null, user_id: 0, name: "Demo (offline)",
          email: DEMO.email, role: "Owner", org_id: 1, org: "NovaTech Devices", mock: true,
        });
        location.href = "content_analysis.html";
      } else {
        showError("Demo account unavailable: " + (err.message || "unknown error"));
      }
    }
  });
  }
})();