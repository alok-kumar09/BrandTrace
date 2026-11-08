const ApiClient = (() => {
  const SESSION_KEY = "brandtrace.session";
  const BASE_KEY = "brandtrace.apiBase";
  const MOCK_KEY = "brandtrace.forceMock";

  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const defaultBase = isLocal ? "http://127.0.0.1:5000" : "https://brandtrace-jhli.onrender.com";

  const cfg = {
    base: localStorage.getItem(BASE_KEY) || defaultBase,
    prefix: "/api",
    timeoutMs: 8000,
    healthMs: 2000,
    get forceMock() { return localStorage.getItem(MOCK_KEY) === "1"; },
  };

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  }

  // ---------- session ----------
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  // A real JWT has exactly 3 dot-separated segments. Anything else
  // ("mock-jwt-token-for-demo-mode", "demo-judge-token") makes
  // flask-jwt-extended answer 422/401, so we never send it.
  const looksLikeJwt = t => typeof t === "string" && t.split(".").length === 3;

  function token() {
    const s = getSession();
    const t = s.access_token || s.token || null;
    return looksLikeJwt(t) ? t : null;
  }

  function hasValidSession() { return !!token(); }

  function getOrgId() {
    const s = getSession();
    const id = Number(s.org_id || s.organisation_id);
    return Number.isInteger(id) && id > 0 ? id : 1;
  }

  function redirectToLogin(reason) {
    clearSession();
    if (!/auth\.html$|landing\.html$/.test(location.pathname)) {
      const q = reason ? "?reason=" + encodeURIComponent(reason) : "";
      location.href = "auth.html" + q;
    }
  }

  // ---------- core request ----------
  // opts.auth === false  -> do not attach the Authorization header (login/register)
  async function request(method, path, body, timeout = cfg.timeoutMs, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const authToken = opts.auth === false ? null : token();
    if (authToken) headers["Authorization"] = "Bearer " + authToken;

    try {
      const res = await fetch(cfg.base + cfg.prefix + path, {
        method, headers, signal: ctrl.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errorBody = {};
        try { errorBody = await res.json(); } catch (e) {}
        const msg = errorBody.error || errorBody.message || errorBody.msg || `HTTP error ${res.status}`;

        // 401 (and 422 from any stale JWT) on a protected call = session is dead.
        if ((res.status === 401 || res.status === 422) && opts.auth !== false) {
          redirectToLogin("expired");
        }
        throw new ApiError(msg, res.status);
      }
      return await res.json();

    } catch (err) {
      if (err.name === "AbortError") throw new ApiError("Request timed out connecting to server", 0);
      // fetch() network failure (server down / CORS / wrong port) is a TypeError
      if (err instanceof TypeError) throw new ApiError("Cannot reach server at " + cfg.base, 0);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  const isOffline = err => !!err && err.status === 0;

  // ---------- guidelines shape helpers ----------
  // Local (Storage) shape  <->  backend shape
  function toBackendGuidelines(g) {
    let facts = g.approved_facts;
    if (!facts || typeof facts !== "object" || Array.isArray(facts)) facts = {};
    return {
      tone: (g.tone || "").trim() || "Confident, clear and customer-friendly.",
      restricted_words: (g.restricted_words || []).filter(w => typeof w === "string" && w.trim()),
      approved_terms: (g.approved_terms || []).filter(w => typeof w === "string" && w.trim()),
      approved_facts: facts,
    };
  }

  function normalizeIssue(i, n) {
    const sev = String(i.severity || "low").toLowerCase();
    return {
      id: i.id || "iss-" + n,
      category: i.category || i.type || "Issue",
      severity: ["high", "medium", "low"].includes(sev) ? sev : "low",
      original_text: i.original_text || i.original || i.excerpt || "",
      explanation: i.explanation || i.reason || "",
      suggestion: i.suggestion || i.suggested_edit || "",
    };
  }

  async function checkHealth() {
    if (cfg.forceMock) { window.setBackendStatus?.(false); return false; }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.healthMs);
    try {
      const res = await fetch(cfg.base + "/api/health", { signal: ctrl.signal });
      if (!res.ok) throw new Error("health failed");
      window.setBackendStatus?.(true);
      return true;
    } catch (e) {
      window.setBackendStatus?.(false);
      return false;
    } finally { clearTimeout(timer); }
  }

  async function analyzeContent(content, guidelines) {
    const orgId = getOrgId();

    if (cfg.forceMock) {
      await new Promise(r => setTimeout(r, 600));
      return { ...SampleData.mockAnalyze(content, guidelines), source: "mock" };
    }

    const send = () => request("POST", "/analyze", { organisation_id: orgId, content });

    let data;
    try {
      try {
        data = await send();
      } catch (err) {
        // Org has no guidelines on the server yet: push the local ones once, retry.
        if (err.status === 404 && /guidelines/i.test(err.message)) {
          await request("PUT", `/guidelines/${orgId}`, toBackendGuidelines(guidelines));
          data = await send();
        } else { throw err; }
      }
    } catch (err) {
      window.setBackendStatus?.(!isOffline(err));
      throw err;
    }

    window.setBackendStatus?.(true);
    const list = data.issues || (data.data && data.data.issues) || [];
    return {
      issues: list.map(normalizeIssue),
      source: "live",
      review_id: data.review_id,
      overall_status: data.overall_status,
    };
  }

  setInterval(checkHealth, 30000);

  const endpoints = {
    getGuidelines: (orgId = getOrgId()) => request("GET", `/guidelines/${orgId}`),
    saveGuidelines: (payload, orgId = getOrgId()) => request("PUT", `/guidelines/${orgId}`, payload),
    fetchDashboard: (orgId = getOrgId()) => request("GET", `/organisations/${orgId}/dashboard`),
    fetchHistory: (orgId = getOrgId()) => request("GET", `/organisations/${orgId}/history`),
    fetchOrganisation: (orgId = getOrgId()) => request("GET", `/organisations/${orgId}`),
    updateOrganisation: (payload, orgId = getOrgId()) => request("PUT", `/organisations/${orgId}`, payload),
    addMember: (email, orgId = getOrgId()) => request("POST", `/organisations/${orgId}/members`, { email }),
    decideReview: (reviewId, status, orgId = getOrgId()) =>
      request("PUT", `/approvals/${reviewId}`, { organisation_id: orgId, approval_status: status }),
  };

  return {
    request, analyzeContent, checkHealth, ApiError, getOrgId, getSession, saveSession,
    clearSession, hasValidSession, isOffline, toBackendGuidelines, redirectToLogin,
    // back-compat aliases (app.js used these without `.endpoints`)
    getGuidelines: endpoints.getGuidelines,
    saveGuidelines: endpoints.saveGuidelines,
    get base() { return cfg.base; },
    get isMock() { return cfg.forceMock; },
    setMock: v => localStorage.setItem(MOCK_KEY, v ? "1" : "0"),
    endpoints,
  };
})();
