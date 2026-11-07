const ApiClient = (() => {
  const SESSION_KEY = "brandtrace.session";
  const cfg = {
    base: localStorage.getItem("brandtrace.apiBase") || "http://127.0.0.1:5000",
    prefix: "/api", // Change this from "" to "/api" so it appends correctly to Flask blueprints
    timeoutMs: 6000,
    healthMs: 2000,
    get forceMock() { return localStorage.getItem("brandtrace.forceMock") === "1"; },
  };

  class ApiError extends Error {
    constructor(message, status) { 
      super(message); 
      this.name = "ApiError"; 
      this.status = status; 
    }
  }

  function token() {
    try { 
      const session = JSON.parse(localStorage.getItem(SESSION_KEY));
      return session?.token || session?.access_token || null; 
    } catch (e) { 
      return null; 
    }
  }

  async function request(method, path, body, timeout = cfg.timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { Accept: "application/json" };
    
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    
    const authToken = token();
    if (authToken) {
      headers["Authorization"] = "Bearer " + authToken;
    }

    try {
      const url = cfg.base + cfg.prefix + path;
      console.log(`[BrandTrace API] ${method} ${url}`, body);
      
      const res = await fetch(url, {
        method, 
        headers, 
        signal: ctrl.signal, 
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errorBody;
        try { errorBody = await res.json(); } catch(e) { errorBody = {}; }
        throw new ApiError(errorBody.message || errorBody.error || `HTTP error ${res.status}`, res.status);
      }

      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") throw new ApiError("Request timed out connecting to server", 0);
      throw err;
    } finally { 
      clearTimeout(timer); 
    }
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
    if (cfg.forceMock) { 
      window.setBackendStatus?.(false); 
      return false; 
    }
    try {
      const ctrl = new AbortController(); 
      const t = setTimeout(() => ctrl.abort(), cfg.healthMs);
      // Remove /v1 from the health check since app.py defines it at /api/health
      await fetch(cfg.base + "/api/health", { signal: ctrl.signal }); 
      clearTimeout(t);
      window.setBackendStatus?.(true); 
      return true;
    } catch (e) { 
      window.setBackendStatus?.(false); 
      return false; 
    }
  }

  // --- Content Analysis Endpoint Connection ---
  async function analyzeContent(content, guidelines) {
    const payload = {
      organisation_id: 1,
      content: content,
      guidelines_version: "v1",
      metadata: { channel: "marketing_copy" },
      guidelines: guidelines
    };

    // If mock mode is explicitly forced by the user, bypass live API
    if (cfg.forceMock) {
      console.warn("[BrandTrace] Force Mock mode is enabled. Using mock engine.");
      await new Promise(r => setTimeout(r, 600));
      return { ...SampleData.mockAnalyze(content, guidelines), source: "mock" };
    }

    try {
      // Direct call to Flask backend POST /api/analyze (or /api/v1/analyze)
      const data = await request("POST", "/analyze", payload);
      const list = data.issues || (data.data && data.data.issues) || [];
      window.setBackendStatus?.(true);
      return { issues: list.map(normalizeIssue), source: "live" };
    } catch (err) {
      console.error("[BrandTrace] Live API /analyze error:", err.message, err.status);
      window.setBackendStatus?.(false);
      
      // If it's a client authentication/authorization error (401, 403), throw it directly 
      // so the user knows they need to sign in, rather than silently falling back to mock mode.
      if (err.status === 401 || err.status === 403) {
        throw err;
      }

      console.warn("[BrandTrace] Falling back to offline mock engine due to network/server issue.");
      await new Promise(r => setTimeout(r, 700));
      return { ...SampleData.mockAnalyze(content, guidelines), source: "mock" };
    }
  }

  setInterval(checkHealth, 30000);
  
  return { 
    request, 
    analyzeContent, 
    checkHealth, 
    ApiError, 
    setMock: v => localStorage.setItem("brandtrace.forceMock", v ? "1" : "0"),
    endpoints: {
      getGuidelines: () => request("GET", "/organisations/1/guidelines"),
      saveGuidelines: (payload) => request("PUT", "/organisations/1/guidelines", payload),
      fetchDashboard: () => request("GET", "/organisations/1/dashboard")
    }
  };
})();