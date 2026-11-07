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

      renderTable(cachedReviews);
    } catch (err) {
      cachedReviews = getMockHistoryList();
      renderTable(cachedReviews);
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

  function renderTable(list, filterQuery = "") {
    const tbody = document.getElementById("history-tbody");
    if (!tbody) return;

    const filtered = list.filter(item => {
      if (!filterQuery) return true;
      const q = filterQuery.toLowerCase();
      const content = (item.submitted_content || "").toLowerCase();
      const idStr = String(item.id || item.review_id || "").toLowerCase();
      const status = (item.overall_status || "").toLowerCase();
      return content.includes(q) || idStr.includes(q) || status.includes(q);
    });

    updateMetrics(list);

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 32px; color: var(--muted);">No matching review records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const reviewId = item.id || item.review_id || "101";
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : "2026-11-06";
      const excerpt = item.submitted_content ? esc(item.submitted_content.substring(0, 45)) + "..." : "Draft Copy";
      const issuesCount = Array.isArray(item.issues) ? item.issues.length : 0;
      const status = item.overall_status || "Needs Review";
      const statusLower = status.toLowerCase();
      const badgeClass = statusLower.includes("pass") || statusLower.includes("approve") ? "resolved" : "high";

      return `
        <tr data-review-id="${esc(reviewId)}">
          <td><strong>#${esc(reviewId)}</strong></td>
          <td style="color: var(--muted); white-space: nowrap;">${esc(dateStr)}</td>
          <td><code style="word-break: break-word;">${excerpt}</code></td>
          <td class="nowrap-cell"><span class="badge neutral">${issuesCount} issues</span></td>
          <td class="nowrap-cell"><span class="badge ${badgeClass}">${esc(status)}</span></td>
          <td style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm view-details-btn" data-id="${esc(reviewId)}" type="button">
              View Details
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function updateMetrics(list) {
    document.getElementById("hist-total").textContent = list.length;
    document.getElementById("hist-passed").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("pass")).length;
    document.getElementById("hist-attention").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("need")).length;
    document.getElementById("hist-approved").textContent = list.filter(i => (i.overall_status || "").toLowerCase().includes("approve")).length;
  }

  window.openReviewDrawer = function(id) {
    const review = cachedReviews.find(r => String(r.id || r.review_id) === String(id)) || cachedReviews[0];
    const backdrop = document.getElementById("history-slide-over");
    const content = document.getElementById("drawer-content");
    const title = document.getElementById("drawer-title");
    if (!backdrop || !content || !review) return;

    title.textContent = `Audit Review Inspection #${review.id || review.review_id || 101}`;
    
    const issuesHtml = (review.issues || []).map(iss => `
      <div class="diff-card-item" style="margin-bottom: 16px;">
        <div class="label">${esc(iss.category || "Issue")} (${esc(iss.severity || "medium")})</div>
        <div class="diff-view">
          <span class="diff-del">Original: "${esc(iss.original_text || "")}"</span>
          <span class="diff-ins">Suggested: "${esc(iss.suggestion || "")}"</span>
        </div>
        <p style="font-size: 0.85rem; margin-top: 6px; color: var(--muted);">${esc(iss.explanation || "")}</p>
      </div>
    `).join("") || "<p>No issues flagged for this audit.</p>";

    content.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="label">Metadata</span>
        <p style="font-size: 0.88rem;"><strong>Timestamp:</strong> ${esc(review.created_at || "N/A")} | <strong>Author:</strong> ${esc(review.author_id || "User")}</p>
        <p style="font-size: 0.88rem; margin-top: 4px;"><strong>Status:</strong> <span class="badge high">${esc(review.overall_status || "Pending")}</span></p>
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

      // Robust event delegation for View Details buttons
      document.getElementById("history-tbody")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".view-details-btn");
        if (btn) {
          const id = btn.dataset.id;
          window.openReviewDrawer(id);
        }
      });

      // Search filter handler
      document.getElementById("history-search")?.addEventListener("input", (e) => {
        renderTable(cachedReviews, e.target.value.trim());
      });

      document.getElementById("drawer-close-btn")?.addEventListener("click", closeDrawer);
      document.getElementById("history-slide-over")?.addEventListener("click", (e) => {
        if (e.target.id === "history-slide-over") closeDrawer();
      });
    }
  });
})();