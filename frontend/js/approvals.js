(function () {
  const { esc, toast } = Utils;

  const norm = s => String(s || "").toLowerCase();
  const isPending = i => /pending|need|review/.test(norm(i.overall_status));
  const isApproved = i => norm(i.overall_status).includes("approve");
  const isRejected = i => norm(i.overall_status).includes("reject");

  function setCounts(all) {
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = n; };
    set("appr-pending", all.filter(isPending).length);
    set("appr-signed", all.filter(isApproved).length);
    set("appr-rejected", all.filter(isRejected).length);
  }

  function emptyState(container, msg) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">✅</div>
        <h3>${esc(msg)}</h3>
        <p>New audits that need sign-off will appear here.</p>
      </div>`;
  }

  async function loadApprovals() {
    const container = document.getElementById("approvals-container");
    if (!container) return;

    try {
      const res = await ApiClient.endpoints.fetchHistory();
      const all = res.reviews || res.history || (Array.isArray(res) ? res : []);
      setCounts(all);
      const items = all.filter(isPending);
      if (!items.length) return emptyState(container, "No reviews waiting for approval");
      renderQueue(container, items);
    } catch (err) {
      if (ApiClient.isMock || ApiClient.isOffline(err)) {
        console.warn("[BrandTrace] Offline — showing demo approvals:", err.message);
        renderMockApprovals(container);
      } else {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div>
          <h3>Could not load approvals</h3><p>${esc(err.message)}</p></div>`;
        toast("Could not load approvals: " + err.message, "error");
      }
    }
  }

  function issuesList(issues) {
    if (!Array.isArray(issues) || !issues.length) return "";
    return `
      <div class="label">Flagged Issues (${issues.length})</div>
      <ul style="margin-left:20px;font-size:.9rem;margin-bottom:16px;color:var(--text);">
        ${issues.map(i => `<li><strong>${esc(i.category || "Issue")}</strong> (${esc(i.severity || "low")}):
          ${i.original_text ? `<span style="color:var(--danger)">"${esc(i.original_text)}"</span>` : ""}
          ${i.suggestion ? ` → <span style="color:var(--success)">"${esc(i.suggestion)}"</span>` : ""}</li>`).join("")}
      </ul>`;
  }

  function card(item) {
    const id = item.id || item.review_id;
    return `
      <article class="issue-card sev-high" data-id="${esc(id)}" style="margin-bottom:20px;">
        <div class="issue-head">
          <span class="category">Review #${esc(id)}</span>
          <span class="badge high">${esc(item.overall_status || "Pending")}</span>
        </div>
        <div class="label">Submitted Content</div>
        <div style="background:var(--surface-alt);padding:10px;border-radius:6px;font-family:var(--mono);font-size:.9rem;margin-bottom:12px;">
          ${esc(item.submitted_content || "")}
        </div>
        ${issuesList(item.issues)}
        <div class="issue-actions">
          <button class="btn btn-success btn-sm" data-decision="approved" data-review="${esc(id)}" type="button">✔ Approve &amp; Release</button>
          <button class="btn btn-ghost-danger btn-sm" data-decision="rejected" data-review="${esc(id)}" type="button">✖ Reject Draft</button>
        </div>
      </article>`;
  }

  function renderQueue(container, items) { container.innerHTML = items.map(card).join(""); }

  function renderMockApprovals(container) {
    const mock = [{
      id: 12,
      submitted_content: "Introducing NovaBook Pro, the cheapest laptop on the market with guaranteed battery life.",
      issues: [
        { category: "Restricted Word", severity: "high", original_text: "cheapest", suggestion: "most affordable" },
        { category: "Factual Mismatch", severity: "high", original_text: "guaranteed battery life", suggestion: "up to 12 hours battery life" },
      ],
      overall_status: "Needs Review",
    }];
    setCounts(mock);
    renderQueue(container, mock);
  }

  async function decide(reviewId, status) {
    try {
      await ApiClient.endpoints.decideReview(reviewId, status);
      toast(`Review #${reviewId} marked as ${status} ✔`);
      loadApprovals();
    } catch (err) {
      if (ApiClient.isMock) {
        toast(`Review #${reviewId} marked as ${status} (offline demo)`);
        document.querySelector(`[data-id="${reviewId}"]`)?.remove();
        return;
      }
      toast(err.status === 403
        ? "Only organisation Owners/Admins can approve or reject reviews."
        : "Could not save decision: " + err.message, "error");
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page !== "approvals") return;
    loadApprovals();
    document.getElementById("refresh-approvals-btn")?.addEventListener("click", () => {
      toast("Refreshing approvals queue...");
      loadApprovals();
    });
    document.getElementById("approvals-container")?.addEventListener("click", e => {
      const b = e.target.closest("[data-decision]");
      if (b) decide(b.dataset.review, b.dataset.decision);
    });
  });
})();
