/* BrandTrace analytics controller
   Depends on: ApiClient (api.js), Utils (utils.js), Chart.js (CDN). */
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const esc = Utils.esc;
  const RANGE_DAYS = { "7d": 7, "30d": 30, "90d": 90 };
  const PALETTE = ["--primary", "--gold", "--info", "--accent", "--warning", "--danger"];

  const state = { range: "30d", data: null, charts: {} };

  // ---------- helpers ----------
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pick = (obj, keys, fallback) => {
    for (const k of keys) if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    return fallback;
  };
  // Accept 0-1 fractions or 0-100 percentages
  const pct = v => { const n = num(v); return n > 0 && n <= 1 ? n * 100 : n; };
  const pretty = s => String(s || "Other").replace(/[_-]+/g, " ").replace(/^./, c => c.toUpperCase());
  const fmt = n => Math.round(n).toLocaleString();

  function animateNumber(el, target, suffix = "") {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = fmt(target) + suffix; return;
    }
    const start = performance.now(), dur = 700;
    const tick = now => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = fmt(target * (1 - Math.pow(1 - t, 3))) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- normalise API response (tolerant of different backend shapes) ----------
  function normCategories(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw)
      ? raw.map(c => ({ label: pretty(pick(c, ["category", "name", "label", "type"], "Other")), count: num(pick(c, ["count", "total", "value"], 0)) }))
      : Object.entries(raw).map(([k, v]) => ({ label: pretty(k), count: num(typeof v === "object" ? pick(v, ["count", "total"], 0) : v) }));
    return list.filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  }

  function normSeverity(raw) {
    const out = { high: 0, medium: 0, low: 0 };
    if (!raw) return out;
    if (Array.isArray(raw)) raw.forEach(r => {
      const k = String(pick(r, ["severity", "level", "name"], "")).toLowerCase();
      if (k in out) out[k] += num(pick(r, ["count", "total", "value"], 0));
    });
    else Object.keys(out).forEach(k => { out[k] = num(typeof raw[k] === "object" ? pick(raw[k], ["count"], 0) : raw[k]); });
    return out;
  }

  function normTrends(raw) {
    const list = Array.isArray(raw) ? raw : [];
    return list.map(t => ({
      date: pick(t, ["date", "day", "period", "label"], ""),
      rate: pct(pick(t, ["compliance_rate", "rate", "compliance"], 0)),
      reviews: num(pick(t, ["reviews", "review_count", "total_reviews", "volume", "count"], 0)),
    }));
  }

  function normRecurring(raw) {
    return (Array.isArray(raw) ? raw : []).map(r => ({
      text: pick(r, ["text", "violation", "phrase", "original_text", "pattern", "title"], "Unspecified"),
      category: pretty(pick(r, ["category", "type"], "Other")),
      severity: ["high", "medium", "low"].includes(String(r.severity).toLowerCase()) ? String(r.severity).toLowerCase() : "low",
      count: num(pick(r, ["count", "occurrences", "times", "frequency"], 0)),
      recommendation: pick(r, ["recommendation", "suggestion", "fix"], ""),
    })).sort((a, b) => b.count - a.count);
  }

  function normRecs(raw) {
    return (Array.isArray(raw) ? raw : []).map(r =>
      typeof r === "string" ? { title: r, text: "" }
        : { title: pick(r, ["title", "headline", "recommendation"], "Recommendation"), text: pick(r, ["text", "description", "detail", "explanation"], "") }
    );
  }

  function normalize(raw) {
    const d = (raw && raw.data) || raw || {};
    const s = d.summary || d.kpis || d.metrics || d;
    return {
      total_reviews: num(pick(s, ["total_reviews", "totalReviews", "reviews"], 0)),
      compliance_rate: pct(pick(s, ["compliance_rate", "complianceRate", "compliance"], 0)),
      total_violations: num(pick(s, ["total_violations", "totalViolations", "violations"], 0)),
      avg_semantic: pct(pick(s, ["avg_semantic_score", "average_semantic_score", "avg_semantic", "semantic_score"], 0)),
      trends: d.trends || d.trend,
      categories: d.categories || d.category_breakdown || d.violation_categories,
      severity: d.severity || d.severity_breakdown,
      recurring: d.recurring_violations || d.recurring || d.top_violations,
      recommendations: d.recommendations || d.insights,
    };
  }

  // If the main endpoint doesn't carry the breakdowns, ask the dedicated ones
  async function fillFromSubEndpoints(d, range) {
    const orgId = ApiClient.getOrgId();
    const need = [["trends", "trends"], ["categories", "categories"], ["severity", "severity"]].filter(([key]) => !d[key]);
    if (!need.length) return;
    const results = await Promise.allSettled(
      need.map(([, path]) => ApiClient.request("GET", `/analytics/${orgId}/${path}?range=${encodeURIComponent(range)}`))
    );
    results.forEach((r, i) => {
      if (r.status !== "fulfilled") return;
      const body = r.value || {};
      const key = need[i][0];
      d[key] = body[key] || body.data || body;
    });
  }

  // ---------- derived recommendations (only when the API sends none) ----------
  function deriveRecs(d) {
    const out = [];
    if (d.categories.length) {
      const top = d.categories[0];
      out.push({ title: `Focus on ${top.label.toLowerCase()} first`, text: `${top.label} accounts for ${fmt(top.count)} of your ${fmt(d.total_violations || top.count)} violations. Tighten that part of your guidelines.` });
    }
    if (d.severityCounts.high > 0) out.push({ title: "Review high-severity items before publishing", text: `${fmt(d.severityCounts.high)} high-severity violations were flagged. Route these through approvals.` });
    if (d.recurring.length) out.push({ title: `Add "${d.recurring[0].text}" to your guidelines`, text: `It appeared ${fmt(d.recurring[0].count)} times. An explicit rule or approved alternative should stop it recurring.` });
    if (d.compliance_rate && d.compliance_rate < 80) out.push({ title: "Compliance is below 80%", text: "Share the guidelines with content authors and run audits before drafts reach review." });
    return out;
  }

  // ---------- rendering ----------
  function setView(view) {
    $("an-error").hidden = view !== "error";
    $("an-empty").hidden = view !== "empty";
    $("an-content").hidden = view === "error" || view === "empty";
    $("an-content").classList.toggle("is-loading", view === "loading");
  }

  function renderKpis(d) {
    animateNumber($("kpi-reviews"), d.total_reviews);
    animateNumber($("kpi-rate"), d.compliance_rate, "%");
    animateNumber($("kpi-violations"), d.total_violations);
    animateNumber($("kpi-semantic"), d.avg_semantic);
    $("kpi-rate-bar").style.width = Math.min(100, d.compliance_rate) + "%";
    $("kpi-reviews-note").textContent = $("an-range").selectedOptions[0].textContent;
    $("kpi-violations-note").textContent = d.total_reviews
      ? `${(d.total_violations / d.total_reviews).toFixed(1)} per review` : "";
  }

  function destroyChart(key) { if (state.charts[key]) { state.charts[key].destroy(); state.charts[key] = null; } }

  function renderTrend(d) {
    destroyChart("trend");
    const note = $("trend-note");
    note.hidden = true;
    let rows = d.trends;
    const days = RANGE_DAYS[state.range];
    if (days && rows.length && rows.every(r => !isNaN(Date.parse(r.date)))) {
      const cutoff = Date.now() - days * 864e5;
      const inRange = rows.filter(r => Date.parse(r.date) >= cutoff);
      if (inRange.length) rows = inRange;
      else { note.textContent = "No reviews in this window. Showing all available data."; note.hidden = false; }
    }
    if (!window.Chart) return;
    const labels = rows.map(r => {
      const dt = new Date(r.date);
      return isNaN(dt) ? r.date : dt.toLocaleDateString([], { month: "short", day: "numeric" });
    });
    const grid = css("--border"), muted = css("--muted");
    state.charts.trend = new Chart($("chart-trend"), {
      data: {
        labels,
        datasets: [
          { type: "line", label: "Compliance rate (%)", data: rows.map(r => r.rate), yAxisID: "y", borderColor: css("--success"), backgroundColor: css("--success-soft"), fill: true, tension: .35, pointRadius: 3, borderWidth: 2.5, order: 1 },
          { type: "bar", label: "Reviews", data: rows.map(r => r.reviews), yAxisID: "y1", backgroundColor: css("--accent"), borderRadius: 4, maxBarThickness: 28, order: 2 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: { legend: { position: "bottom", labels: { color: muted, usePointStyle: true } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, maxRotation: 0, autoSkip: true } },
          y: { min: 0, max: 100, grid: { color: grid }, ticks: { color: muted, callback: v => v + "%" } },
          y1: { position: "right", beginAtZero: true, grid: { display: false }, ticks: { color: muted, precision: 0 } },
        },
      },
    });
  }

  function renderCategories(d) {
    destroyChart("categories");
    if (!window.Chart) return;
    const total = d.categories.reduce((s, c) => s + c.count, 0);
    const centerText = {
      id: "centerText",
      afterDraw(chart) {
        const { ctx, chartArea: a } = chart;
        const x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
        ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = css("--text"); ctx.font = `700 24px ${css("--font")}`; ctx.fillText(fmt(total), x, y - 8);
        ctx.fillStyle = css("--muted"); ctx.font = `12px ${css("--font")}`; ctx.fillText("violations", x, y + 14);
        ctx.restore();
      },
    };
    state.charts.categories = new Chart($("chart-categories"), {
      type: "doughnut",
      data: {
        labels: d.categories.map(c => c.label),
        datasets: [{ data: d.categories.map(c => c.count), backgroundColor: d.categories.map((_, i) => css(PALETTE[i % PALETTE.length])), borderColor: css("--surface"), borderWidth: 3 }],
      },
      options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom", labels: { color: css("--muted"), usePointStyle: true } } } },
      plugins: [centerText],
    });
    if (!d.categories.length) destroyChart("categories");
  }

  function renderSeverity(d) {
    const sev = d.severityCounts, total = sev.high + sev.medium + sev.low;
    $("severity-list").innerHTML = ["high", "medium", "low"].map(k => {
      const share = total ? Math.round((sev[k] / total) * 100) : 0;
      return `<div>
        <div class="an-sev-row-top"><span class="an-chip ${k}">${pretty(k)}</span><span><strong>${fmt(sev[k])}</strong> <span style="color:var(--muted)">(${share}%)</span></span></div>
        <div class="an-bar" role="img" aria-label="${pretty(k)} severity ${share}%"><span class="${k}" data-w="${share}"></span></div>
      </div>`;
    }).join("");
    requestAnimationFrame(() => $("severity-list").querySelectorAll("[data-w]").forEach(el => { el.style.width = el.dataset.w + "%"; }));
  }

  function renderRecurring(d) {
    $("recurring-body").innerHTML = d.recurring.length
      ? d.recurring.slice(0, 8).map(r => `<tr>
          <td><span class="an-quote">${esc(r.text)}</span></td>
          <td>${esc(r.category)}</td>
          <td><span class="an-chip ${r.severity}">${pretty(r.severity)}</span></td>
          <td class="an-count">${fmt(r.count)}</td>
        </tr>`).join("")
      : `<tr><td colspan="4"><p class="an-empty-line">No repeated violations in this period.</p></td></tr>`;

    const apiRecs = d.recommendations;
    const recs = apiRecs.length ? apiRecs : deriveRecs(d);
    $("recs-sub").textContent = apiRecs.length ? "AI-generated suggestions for your guidelines and workflow." : "Suggested from your data.";
    $("recs-list").innerHTML = recs.length
      ? recs.map(r => `<li class="an-rec"><strong>${esc(r.title)}</strong>${r.text ? `<span>${esc(r.text)}</span>` : ""}</li>`).join("")
      : `<li><p class="an-empty-line">No recommendations yet. Keep reviewing content and patterns will appear.</p></li>`;
  }

  function renderAll() {
    const d = state.data;
    renderKpis(d); renderTrend(d); renderCategories(d); renderSeverity(d); renderRecurring(d);
  }

  // ---------- load ----------
  async function load() {
    setView("loading");
    const range = state.range;
    try {
      const raw = await ApiClient.endpoints.getAnalytics(range);
      const d = normalize(raw);
      if (!ApiClient.isMock) await fillFromSubEndpoints(d, range);
      if (range !== state.range) return; // user changed the filter mid-request

      d.trends = normTrends(d.trends);
      d.categories = normCategories(d.categories);
      d.severityCounts = normSeverity(d.severity);
      d.recurring = normRecurring(d.recurring);
      d.recommendations = normRecs(d.recommendations);
      if (!d.total_violations) d.total_violations = d.categories.reduce((s, c) => s + c.count, 0);

      state.data = d;
      if (!d.total_reviews && !d.trends.length) { setView("empty"); return; }
      setView("ready");
      renderAll();
    } catch (err) {
      console.error("[analytics]", err);
      $("an-error-msg").textContent = (err && err.message) || "Something went wrong while loading analytics.";
      setView("error");
      Utils.toast("Couldn't load analytics", "error");
    }
  }

  // ---------- init ----------
  document.addEventListener("DOMContentLoaded", () => {
    if (window.Chart) {
      Chart.defaults.font.family = css("--font") || "system-ui, sans-serif";
      Chart.defaults.color = css("--muted");
    }
    $("an-range").addEventListener("change", e => { state.range = e.target.value; load(); });
    $("an-retry").addEventListener("click", load);

    // Redraw charts when the theme toggles so canvas colours follow the CSS variables
    new MutationObserver(() => { if (state.data && !$("an-content").hidden) { renderTrend(state.data); renderCategories(state.data); } })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    load();
  });
})();