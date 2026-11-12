const ApiClient = (() => {

  class ApiError extends Error {
    constructor(message, status) {
      super(message);
      this.status = status;
      this.name = "ApiError";
    }
  }

  const SESSION_KEY = "brandtrace.session";
  const BASE_KEY = "brandtrace.apiBase";
  const MOCK_KEY = "brandtrace.forceMock";

  const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  
  // Use https:// for your production Vercel domain so requests don't fail due to mixed content/protocol errors
  const defaultBase = isLocal ? "http://127.0.0.1:5000" : "https://0hackathon0common0.pythonanywhere.com";

  // ---- CONFIG OBJECT DEFINED HERE FIRST ----
  const cfg = {
    base: localStorage.getItem(BASE_KEY) || defaultBase,
    prefix: "/api",
    timeoutMs: 8000,
    healthMs: 2000,
    get forceMock() { return localStorage.getItem(MOCK_KEY) === "1"; },
  };
  
  // ---------- session ----------
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
  function clearSession() {
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

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

  // ---- NOW SAFE TO RUN CONNECTION CHECK AFTER cfg IS DECLARED ----
  (async function verifyBackendConnection() {
    console.log(`[ApiClient] Initializing. Target Base URL: ${cfg.base}`);
    console.log(`[ApiClient] Force Mock Mode Enabled: ${cfg.forceMock}`);
    
    try {
      const start = performance.now();
      const alive = await checkHealth();
      const duration = Math.round(performance.now() - start);
      
      if (alive) {
        console.log(`%c[ApiClient] ✅ Successfully connected to backend analyser at ${cfg.base} (${duration}ms)`, "color: #10b981; font-weight: bold;");
      } else {
        console.warn(`%c[ApiClient] ⚠️ Backend health check failed. The app is currently offline or unreachable at ${cfg.base}.`, "color: #f59e0b; font-weight: bold;");
      }
    } catch (err) {
      console.error(`%c[ApiClient] ❌ Connection error reaching backend at ${cfg.base}:`, "color: #ef4444; font-weight: bold;", err.message);
    }
  })();


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
      // keep what the backend sends so the workbench can highlight the exact span
      start_offset: Number.isInteger(i.start_offset) ? i.start_offset : null,
      end_offset: Number.isInteger(i.end_offset) ? i.end_offset : null,
      rule_reference: i.rule_reference || null,
    };
  }


  async function analyzeContent(content, guidelines) {
    const orgId = getOrgId();
    console.log("[ApiClient] POST /api/analyze payload prepared:", { organisation_id: orgId, content_length: content?.length });

    if (cfg.forceMock) {
      console.log("[ApiClient] Bypassing live analysis because Force Mock is active.");
      await new Promise(r => setTimeout(r, 600));
      return { ...SampleData.mockAnalyze(content, guidelines), source: "mock" };
    }

    const send = () => request("POST", "/analyze", { organisation_id: orgId, content }, 30000);

    let data;
    try {
      data = await send();
      console.log("[ApiClient] POST /api/analyze response received successfully:", data);
    } catch (err) {
      console.error("[ApiClient] POST /api/analyze failed with status:", err.status, err.message);
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
      analysis_mode: data.analysis_mode,
      provider: data.provider,
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
    
    // --- Toshit's Aligned Round 3 Endpoints ---
    analyzeContentLive: async (content, orgId = getOrgId()) => {
      if (cfg.forceMock) return SampleData.mockAnalyze(content, {});
      return request("POST", "/analyze", { organisation_id: orgId, content });
    },
    getRewriteSuggestions: async (reviewId, selectedViolationIds = [], orgId = getOrgId()) => {
      if (cfg.forceMock) return SampleData.mockRewrite(reviewId);
      return request("POST", "/rewrite", { organisation_id: orgId, review_id: reviewId, selected_violation_ids: selectedViolationIds }, 45000);
    },
    decideSuggestion: async (reviewId, suggestionId, status, orgId = getOrgId()) => {
      if (cfg.forceMock) return { success: true, suggestion_id: suggestionId, status };
      return request("PUT", `/approvals/${reviewId}/suggestions/${suggestionId}`, { organisation_id: orgId, status });
    },
    applyRewrites: async (reviewId, saveAsNew = false, orgId = getOrgId()) => {
      if (cfg.forceMock) return { review_id: reviewId, rewritten_content: "Mock rewritten text applied successfully." };
      return request("POST", "/rewrite/apply", { organisation_id: orgId, review_id: reviewId, save_as_new_version: saveAsNew });
    },
    getAnalytics: async (timespan = "30d", orgId = getOrgId()) => {
      if (cfg.forceMock) return SampleData.mockAnalytics(timespan);
      return request("GET", `/analytics/${orgId}`);
    }
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