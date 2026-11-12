// frontend/js/controllers/rewriter-view.js
// Rendering only: turns suggestion objects into HTML. No API calls, no editor access.
const RewriterView = (() => {
  "use strict";

  const { esc } = Utils;

  const LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected", stale: "Out of date" };

  function range(s) {
    return Number.isInteger(s.start_offset) && Number.isInteger(s.end_offset)
      ? `Characters ${s.start_offset}–${s.end_offset}`
      : "Position unknown";
  }

  function actions(s, busy) {
    if (s.status === "stale") {
      return `<p class="rw-note">The draft changed here. Regenerate rewrites to get a fresh suggestion.</p>`;
    }
    if (s.status !== "pending") return "";
    const disabled = busy ? "disabled" : "";
    const spinner = busy ? `<span class="spinner-sm" aria-hidden="true"></span> ` : "";
    return `
      <div class="issue-actions">
        <button class="btn btn-success btn-sm" type="button" data-rw="approve" ${disabled}>${spinner}✔ Approve</button>
        <button class="btn btn-ghost-danger btn-sm" type="button" data-rw="reject" ${disabled}>✖ Reject</button>
      </div>`;
  }

  function card(s, busy) {
    return `
      <article class="rw-card is-${esc(s.status)}" data-sid="${esc(s.id)}">
        <div class="issue-head">
          <span class="rw-range">${esc(range(s))}</span>
          <span class="badge rw-state rw-state-${esc(s.status)}">${esc(LABEL[s.status] || s.status)}</span>
        </div>
        <div class="rw-diff">
          <div class="label">Original</div>
          <del class="rw-del">${esc(s.original_text)}</del>
          <div class="label">Rewrite</div>
          <ins class="rw-ins">${esc(s.replacement_text)}</ins>
        </div>
        ${s.explanation ? `<div class="label">Why this change</div><div class="explanation">${esc(s.explanation)}</div>` : ""}
        ${actions(s, busy)}
      </article>`;
  }

  function renderList(el, suggestions, busyIds) {
    if (!el) return;
    el.innerHTML = suggestions.length
      ? `<div class="violation-cards-container">${suggestions.map(s => card(s, busyIds.has(s.id))).join("")}</div>`
      : `<div class="empty-state"><div class="icon">✨</div><h3>No rewrites yet</h3><p>Select issues in the audit results, or leave them all unselected to rewrite every open issue.</p></div>`;
  }

  function renderSummary(el, suggestions) {
    if (!el) return;
    if (!suggestions.length) { el.innerHTML = ""; return; }
    const n = status => suggestions.filter(s => s.status === status).length;
    el.innerHTML = `
      <div class="summary-bar">
        <span class="badge neutral">${n("pending")} pending</span>
        <span class="badge resolved">${n("approved")} approved</span>
        <span class="badge rw-state-rejected">${n("rejected")} rejected</span>
        ${n("stale") ? `<span class="badge rw-state-stale">${n("stale")} out of date</span>` : ""}
      </div>`;
  }

  function renderLoading(el, message = "Writing rewrites…") {
    if (el) el.innerHTML = `<div class="sk-label" role="status"><span class="spinner-sm" aria-hidden="true"></span> ${esc(message)}</div>`;
  }

  function renderError(el, message) {
    if (!el) return;
    el.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>Couldn't generate rewrites</h3>
        <p>${esc(message)}</p>
        <div class="editor-actions" style="justify-content:center">
          <button class="btn btn-secondary btn-sm" type="button" data-rw="retry">Try again</button>
        </div>
      </div>`;
  }

  return { renderList, renderSummary, renderLoading, renderError };
})();