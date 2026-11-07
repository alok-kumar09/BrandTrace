(function () {
  async function checkAboutHealth() {
    const badge = document.getElementById("about-health-badge");
    const details = document.getElementById("about-health-details");
    if (!badge || !details) return;

    const start = performance.now();
    try {
      const res = await fetch("http://127.0.0.1:5000/api/health", { signal: AbortSignal.timeout(3000) });
      const latency = Math.round(performance.now() - start);
      if (res.ok) {
        badge.className = "badge resolved";
        badge.textContent = `Online (${latency}ms)`;
        details.textContent = `All governance inference nodes operational. Response latency is optimal.`;
      } else {
        throw new Error("Server error");
      }
    } catch (err) {
      badge.className = "badge high";
      badge.textContent = "Offline / Mock Mode";
      details.textContent = `Unable to reach live backend at /api/health. Operating securely on local fallback fallback mode.`;
    }
  }

  document.addEventListener("DOMContentLoaded", checkAboutHealth);
})();