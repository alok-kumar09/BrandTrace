const ApiClient = (() => {
  const SESSION_KEY = "brandtrace.session";
  const cfg = {
    base: localStorage.getItem("brandtrace.apiBase") || "http://localhost:5000",
    prefix: "/api/v1",
    timeoutMs: 4000,
    healthMs: 1500,
    get forceMock() { return localStorage.getItem("brandtrace.forceMock") === "1"; },
  };

  class ApiError extends Error {
    constructor(message, status) { super(message); this.name = "ApiError"; this.status = status; }
  }

  function token() {
    try { return (JSON.parse(localStorage.getItem(SESSION_KEY)) || {}).token || null; } catch (e) { return null; }
  }

  async function request(method, path, body, timeout = cfg.timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    const headers = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token()) headers.Authorization = "Bearer " + token();
    try {
      const res = await fetch(cfg.base + cfg.prefix + path, {
        method, headers, signal: ctrl.signal, body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) throw new ApiError("HTTP " + res.status, res.status);
      return await res.json();
    } catch (err) {
      if (err.name === "AbortError") throw new ApiError("Request timed out", 0);
      throw err;
    } finally { clearTimeout(timer); }
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
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), cfg.healthMs);
      await fetch(cfg.base + cfg.prefix + "/health", { signal: ctrl.signal }); clearTimeout(t);
      window.setBackendStatus?.(true); return true;
    } catch (e) { window.setBackendStatus?.(false); return false; }
  }

  // Standardized backend-ready contract wrappers
  async function analyzeContent(content, guidelines) {
    const payload = {
      document_id: "doc-" + Date.now(),
      content: content,
      guidelines_version: "v1",
      metadata: { channel: "marketing_copy" },
      guidelines: guidelines
    };

    if (!cfg.forceMock) {
      try {
        const data = await request("POST", "/analyze", payload);
        const list = data.issues || (data.data && data.data.issues) || [];
        window.setBackendStatus?.(true);
        return { issues: list.map(normalizeIssue), source: "live" };
      } catch (err) {
        console.warn("[BrandTrace] Live API failed, using mock engine:", err.message);
        window.setBackendStatus?.(false);
      }
    }
    await new Promise(r => setTimeout(r, 900));
    return { ...SampleData.mockAnalyze(content, guidelines), source: "mock" };
  }

  setInterval(checkHealth, 30000);
  
  return { 
    request, 
    analyzeContent, 
    checkHealth, 
    ApiError, 
    setMock: v => localStorage.setItem("brandtrace.forceMock", v ? "1" : "0"),
    // Standard REST endpoint mappings for future hooks
    endpoints: {
      getGuidelines: () => request("GET", "/guidelines"),
      saveGuidelines: (payload) => request("POST", "/guidelines", payload),
      fetchAuditLogs: () => request("GET", "/audit-logs")
    }
  };
})();