// frontend/js/app.js
(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  window.__btApp = function () {
    const onReady = fn =>
      document.readyState === "loading"
        ? document.addEventListener("DOMContentLoaded", fn)
        : fn();

    onReady(() => {
      if (window.ApiClient?.checkHealth || typeof ApiClient !== "undefined") {
        ApiClient.checkHealth();
      }

      const page = document.body.dataset.page;

      if ((page === "workbench" || $("analyse-btn")) && typeof window.initWorkbench === "function") {
        window.initWorkbench();
      }

      if ((page === "guidelines" || $("guidelines-form")) && typeof window.initGuidelines === "function") {
        window.initGuidelines();
      }
    });
  };
})();

// ---- Ensure all required base scripts and controllers are loaded ----
(function () {
  const deps = [
    ["Utils", "js/utils.js", () => typeof Utils !== "undefined"],
    ["Storage", "js/storage.js", () => typeof Storage !== "undefined" && typeof Storage.load === "function"],
    ["SampleData", "js/sample-data.js", () => typeof SampleData !== "undefined"],
    ["ApiClient", "js/api.js", () => typeof ApiClient !== "undefined"],
    ["WorkbenchController", "js/controllers/workbench.js", () => typeof window.initWorkbench === "function"],
    ["GuidelinesController", "js/controllers/guidelines.js", () => typeof window.initGuidelines === "function"]
  ];

  const base = (() => {
    const me = document.currentScript && document.currentScript.src;
    return me ? me.replace(/app\.js(\?.*)?$/, "") : "js/";
  })();

  const load = src =>
    new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = src;
      el.onload = resolve;
      el.onerror = () => reject(new Error("Could not load " + src));
      document.head.appendChild(el);
    });

  (async () => {
    try {
      for (const [name, file, present] of deps) {
        if (!present()) {
          console.warn(`[BrandTrace] ${name} was not loaded by the page; loading ${file}`);
          await load(base + file.replace(/^js\//, ""));
        }
      }
      window.__btApp();
    } catch (err) {
      console.error("[BrandTrace] Startup failed:", err);
      const b = document.createElement("div");
      b.style.cssText =
        "position:fixed;top:0;left:0;right:0;padding:10px;background:#b91c1c;color:#fff;z-index:9999;font:14px sans-serif";
      b.textContent = "BrandTrace failed to start: " + err.message;
      document.body.appendChild(b);
    }
  })();
})();