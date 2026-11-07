(function () {
  const { esc, toast } = Utils;
  let cachedReviews = [];

  async function loadHistory() {
    const tbody = document.getElementById("history-tbody");
    if (!tbody) return;

    try {
      const response = await ApiClient.request("GET", "/organisations/1/history");
      cachedReviews = response.reviews || response.history || response || [];

      if (!Array.isArray(cachedReviews) || cachedReviews.length === 0) {
        cachedReviews = getMockHistoryList();
      }

      updateMetrics(cachedReviews);

      tbody.innerHTML = cachedReviews.map(item => {
        const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : "2026-11-06";
        const excerpt = item.submitted_content ? esc(item.submitted_content.substring(0, 50)) + "..." : "Draft Copy";
        const issuesCount = Array.isArray(item.issues) ? item.issues.length : 2;
        const status = item.overall_status || "Needs Review";
        const badgeClass = status.toLowerCase().includes("pass") || status.toLowerCase().includes("approve") ? "resolved" : "high";

        return `
          <tr>
            <td><strong>#${esc(item.id || item.review_id || "101")}</strong></td>
            <td style="color: var(--muted); white-space: nowrap;">${esc(dateStr)}</td>
            <td><code>${excerpt}</code></td>
            <td><span class="badge neutral">${issuesCount} issues</span></td>
            <td><span class="badge ${badgeClass}">${esc(status)}</span></td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="openReviewDrawer('${item.id || item.review_id || 101}')">
                View Details
              </button>
            </td>
          </tr>
        `;
      }).join("");

    } catch (err) {
      cachedReviews = getMockHistoryList();
      updateMetrics(cachedReviews);
      renderMockTable(tbody, cachedReviews);
    }
  }

  function getMockHistoryList() {
    return [
      {
        id: 101,
        created_at: "2026-11-06 14:30",
        author_id: "usr_priya_01",
        overall_status: "Needs Manager Review",
        submitted_content: "Introducing NovaBook Pro, the cheapest laptop on the market with guaranteed battery life.",
        issues: [
          { category: "Restricted Word", severity: "high", original_text: "cheapest", suggestion: "most affordable", explanation: "Price superlatives create legal exposure." },
          { category: "Factual Mismatch", severity: "high", original_text: "guaranteed battery life", suggestion: "up to 12 hours battery life", explanation: "Exceeds approved spec limit." }
        ]
      },
      {
        id: 100,
        created_at: "2026-11-05 09:15",
        author_id: "usr_rohit_04",
        overall_status: "Passed Initial Checks",
        submitted_content: "NovaBook Pro features up to 12 hours battery life and a stunning OLED display.",
        issues: []
      }
    ];
  }

  window.openReviewDrawer = function(id) {
    const review = cachedReviews.find(r => String(r.id || r.review_id) === String(id)) || cachedReviews[0];
    const backdrop = document.getElementById("history-slide-over");
    const content = document.getElementById("drawer-content");
    const title = document.getElementById("drawer-title");
    if (!backdrop || !content) return;

    title.textContent = `Audit Review Inspection #${review.id || review.review_id || 101}`;
    
    const issuesHtml = (review.issues || []).map(iss => `
      <div class="diff-card-item">
        <div class="label">${esc(iss.category)} (${iss.severity})</div>
        <div class="diff-view">
          <span class="diff-del">Original: "${esc(iss.original_text)}"</span>
          <span class="diff-ins">Suggested: "${esc(iss.suggestion)}"</span>
        </div>
        <p style="font-size: 0.85rem; margin-top: 6px; color: var(--muted);">${esc(iss.explanation || "")}</p>
      </div>
    `).join("") || "<p>No issues flagged for this audit.</p>";

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="label">Metadata</span>
        <p style="font-size: 0.88rem;"><strong>Timestamp:</strong> ${esc(review.created_at || "N/A")} | <strong>Author ID:</strong> ${esc(review.author_id || "usr_default")}</p>
        <p style="font-size: 0.88rem;"><strong>Approval Status:</strong> <span class="badge high">${esc(review.overall_status || "Pending")}</span></p>
      </div>
      <div style="margin-bottom: 16px;">
        <span class="label">Full Submitted Content</span>
        <div style="background: var(--surface-alt); padding: 12px; border-radius: 6px; font-family: var(--mono); font-size: 0.88rem; word-break: break-word;">
          ${esc(review.submitted_content || "")}
        </div>
      </div>
      <div>
        <span class="label">Side-by-Side Issue Analysis</span>
        ${issuesHtml}
      </div>
    `;

    backdrop.hidden = false;
    setTimeout(() => backdrop.classList.add("open"), 10);
  };

  function closeDrawer() {
    const backdrop = document.getElementById("history-slide-over");
    if (!backdrop) return;
    backdrop.classList.remove("open");
    setTimeout(() => backdrop.hidden = true, 250);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "history") {
      loadHistory();
      document.getElementById("refresh-history-btn")?.addEventListener("click", () => {
        toast("Refreshing history log...");
        loadHistory();
      });
      document.getElementById("drawer-close-btn")?.addEventListener("click", closeDrawer);
      document.getElementById("history-slide-over")?.addEventListener("click", (e) => {
        if (e.target.id === "history-slide-over") closeDrawer();
      });
    }
  });

  function updateMetrics(list) {
    document.getElementById("hist-total").textContent = list.length;
    document.getElementById("hist-passed").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("pass")).length;
    document.getElementById("hist-attention").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("need")).length;
    document.getElementById("hist-approved").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("approve")).length;
  }

  function renderMockTable(tbody, list) {
    tbody.innerHTML = list.map(item => `
      <tr>
        <td><strong>#${item.id}</strong></td>
        <td>${item.created_at}</td>
        <td><code>${esc(item.submitted_content)}</code></td>
        <td><span class="badge neutral">${item.issues.length} issues</span></td>
        <td><span class="badge high">${esc(item.overall_status)}</span></td>
        <td><button class="btn btn-secondary btn-sm" onclick="openReviewDrawer(${item.id})">View Details</button></td>
      </tr>
    `).join("");
  }
})();