
const ApiClient = (() => {
  const SESSION_KEY = "brandtrace.session";

  const cfg = {
   .apiBase base: localStorage.getItem("brandtrace.apiBase") || "https://brandtrace-jhli.onrender.com",
    prefix: "/api",
    timeoutMs: 6000,
    healthMs: 2000,
    get forceMock() {
      return localStorage.getItem("brandtrace.forceMock") === "1";
    },
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

    const headers = {
      Accept: "application/json",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const authToken = token();

    if (authToken) {
      headers["Authorization"] = "Bearer " + authToken;
    }

    try {
      const url = cfg.base + cfg.prefix + path;

      console.log(`[BrandTrace API] ${method} ${url}`);

      const res = await fetch(url, {
        method,
        headers,
        signal: ctrl.signal,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        let errorBody = {};

        try {
          errorBody = await res.json();
        } catch (e) {
          // Response was not valid JSON.
        }

        throw new ApiError(
          errorBody.message ||
          errorBody.error ||
          `HTTP error ${res.status}`,
          res.status
        );
      }

      return await res.json();

    } catch (err) {
      if (err.name === "AbortError") {
        throw new ApiError("Request timed out connecting to server", 0);
      }

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

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.healthMs);

    try {
      const res = await fetch(cfg.base + "/api/health", {
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error("Backend health check failed");
      }

      window.setBackendStatus?.(true);
      return true;

    } catch (e) {
      window.setBackendStatus?.(false);
      return false;

    } finally {
      clearTimeout(timer);
    }
  }

  async function analyzeContent(content, guidelines) {
    const payload = {
      organisation_id: 1,
      content: content,
      guidelines_version: "v1",
      metadata: {
        channel: "marketing_copy",
      },
      guidelines: guidelines,
    };

    if (cfg.forceMock) {
      console.warn("[BrandTrace] Mock mode is enabled.");

      await new Promise(resolve => setTimeout(resolve, 600));

      return {
        ...SampleData.mockAnalyze(content, guidelines),
        source: "mock",
      };
    }

    try {
      const data = await request("POST", "/analyze", payload);

      const list =
        data.issues ||
        (data.data && data.data.issues) ||
        [];

      window.setBackendStatus?.(true);

      return {
        issues: list.map(normalizeIssue),
        source: "live",
      };

    } catch (err) {
      console.error(
        "[BrandTrace] Analysis failed:",
        err.message,
        err.status
      );

      window.setBackendStatus?.(false);

      // Do not silently replace a failed backend analysis with fake results.
      throw err;
    }
  }

  setInterval(checkHealth, 30000);

  return {
    request,
    analyzeContent,
    checkHealth,
    ApiError,

    setMock: v => {
      localStorage.setItem("brandtrace.forceMock", v ? "1" : "0");
    },

    endpoints: {
      // Correct paths matching backend/routes/guidelines.py
      getGuidelines: () =>
        request("GET", "/guidelines/1"),

      saveGuidelines: payload =>
        request("PUT", "/guidelines/1", payload),

      fetchDashboard: () =>
        request("GET", "/organisations/1/dashboard"),
    },
  };
})();
