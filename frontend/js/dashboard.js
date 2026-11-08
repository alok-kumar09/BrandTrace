(function () {
  const { esc } = Utils;
  const $ = id => document.getElementById(id);

  // Group any backend status string into one of four buckets.
  // The backend can send "Needs Review", "Passed Initial Checks", "Approved", "Rejected" or "Pending".
  function bucket(status) {
    const s = String(status || "").toLowerCase();
    if (s.includes("reject")) return "rejected";
    if (s.includes("approve")) return "approved";
    if (s.includes("pass")) return "passed";
    return "attention";
  }

  const badgeClass = b =>
    b === "approved" || b === "passed" ? "resolved" : b === "rejected" ? "neutral" : "high";

  function fmtDate(value) {
    const d = value ? new Date(value) : null;
    return d && !isNaN(d) ? d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
  }

  function excerpt(text) {
    const t = String(text || "").trim();
    if (!t) return "Draft copy";
    return t.length > 60 ? t.slice(0, 60) + "…" : t;
  }

  function setNotice(html) {
    $("dash-notice").innerHTML = html
      ? `<section class="card" style="margin-bottom: 16px;">${html}</section>`
      : "";
  }

  function renderStats(list) {
    const counts = { approved: 0, rejected: 0, passed: 0, attention: 0 };
    list.forEach(r => counts[bucket(r.overall_status)]++);
    $("dash-total").textContent = list.length;
    $("dash-attention").textContent = counts.attention;
    $("dash-approved").textContent = counts.approved;
    $("dash-rejected").textContent = counts.rejected;
  }

  function renderRecent(list) {
    const tbody = $("dash-recent");

    if (!list.length) {
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--muted);">
          No audits yet. <a href="content_analysis.html">Analyse your first piece of copy</a> and it will appear here.
        </td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 5).map(item => {
      const id = item.id || item.review_id || "—";
      const status = item.overall_status || "Needs Review";
      const count = Array.isArray(item.issues) ? item.issues.length : 0;
      return `
        <tr>
          <td><strong>#${esc(id)}</strong></td>
          <td style="color: var(--muted); white-space: nowrap;">${esc(fmtDate(item.created_at))}</td>
          <td>${esc(excerpt(item.submitted_content))}</td>
          <td class="nowrap-cell"><span class="badge neutral">${count} ${count === 1 ? "issue" : "issues"}</span></td>
          <td class="nowrap-cell"><span class="badge ${badgeClass(bucket(status))}">${esc(status)}</span></td>
        </tr>`;
    }).join("");
  }

  async function load() {
    const session = ApiClient.getSession();
    const first = String(session.name || "").trim().split(/\s+/)[0];
    if (first) $("dash-title").textContent = `Welcome back, ${first}`;

    ApiClient.checkHealth();

    const orgId = ApiClient.getOrgId();
    const [dash, hist] = await Promise.allSettled([
      ApiClient.endpoints.fetchDashboard(orgId),
      ApiClient.endpoints.fetchHistory(orgId),
    ]);

    // History drives the numbers: the backend dashboard counts only the literal
    // status "Pending", which the analyser never produces.
    if (hist.status === "fulfilled") {
      const data = hist.value;
      const list = Array.isArray(data) ? data : data.reviews || data.history || [];
      renderStats(list);
      renderRecent(list);
    } else {
      const offline = ApiClient.isOffline(hist.reason);
      $("dash-recent").innerHTML = `
        <tr><td colspan="5" style="text-align: center; padding: 32px; color: var(--muted);">
          ${offline ? "The server is not reachable, so audits can't be shown." : "Could not load audits."}
        </td></tr>`;
      setNotice(`<strong>${offline ? "Server offline" : "Something went wrong"}</strong>
        <p style="margin-top: 4px; color: var(--muted);">${esc(hist.reason?.message || "")} Start the backend and refresh the page.</p>`);
      return;
    }

    if (dash.status === "fulfilled" && dash.value.guidelines_configured === false) {
      setNotice(`<strong>Brand guidelines aren't set up yet</strong>
        <p style="margin: 4px 0 12px; color: var(--muted);">Audits need guidelines to check against.</p>
        <a class="btn btn-primary btn-sm" href="guidelines.html">Set up guidelines</a>`);
    }
  }

  document.addEventListener("DOMContentLoaded", load);
})();