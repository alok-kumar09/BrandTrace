(function () {
  async function checkAboutHealth() {
    const badge = document.getElementById("about-health-badge");
    const details = document.getElementById("about-health-details");
    if (!badge || !details) return;

    // Configuration keys matching api.js
    const BASE_KEY = "brandtrace.apiBase";
    const MOCK_KEY = "brandtrace.forceMock";

    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const defaultBase = isLocal ? "http://127.0.0.1:5000" : "https://0hackathon0common0.pythonanywhere.com";

    // Resolve base URL and mock status dynamically
    const baseUrl = localStorage.getItem(BASE_KEY) || defaultBase;
    const forceMock = localStorage.getItem(MOCK_KEY) === "1";

    if (forceMock) {
      badge.className = "badge high";
      badge.textContent = "Mock Mode (Forced)";
      details.textContent = `Forced mock mode is active via settings. Operating securely on local fallback mode.`;
      return;
    }

    const start = performance.now();
    try {
      const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
      const latency = Math.round(performance.now() - start);
      
      if (res.ok) {
        badge.className = "badge resolved";
        badge.textContent = `Online (${latency}ms)`;
        details.textContent = `Connected to backend (${baseUrl}). All governance inference nodes operational.`;
      } else {
        throw new Error("Server error");
      }
    } catch (err) {
      badge.className = "badge high";
      badge.textContent = "Offline / Mock Mode";
      details.textContent = `Unable to reach live backend at ${baseUrl}/api/health. Operating securely on local fallback mode.`;
    }
  }

  document.addEventListener("DOMContentLoaded", checkAboutHealth);
})();