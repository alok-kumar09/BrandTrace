// frontend/js/controllers/rewriter.js
// Feature 2: AI content rewriting.
// Depends on: Utils, ApiClient (api.js), RewriterEditor, RewriterView, and the
// window.BrandTraceWorkbench bridge exposed by workbench.js.
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const { toast } = Utils;

  const state = {
    reviewId: null,
    suggestions: [],
    selected: new Set(),   // ids of workbench issues the user ticked
    deciding: new Set(),   // suggestion ids with an approve/reject request in flight
    busy: false,
    lastFocus: null,
  };

  // ---- small helpers ----
  function notify(message, type = "success") {
    if (typeof toast === "function") toast(message, type);
    else console[type === "error" ? "error" : "log"](message);
  }

  function api() {
    const a = window.API || (typeof ApiClient !== "undefined" ? ApiClient.endpoints : null);
    if (!a) throw new Error("The API client failed to load. Refresh the page and try again.");
    return a;
  }

  const wb = () => window.BrandTraceWorkbench || null;
  const isMock = () => typeof ApiClient !== "undefined" && ApiClient.isMock;
  const errMsg = (err, fallback) => (err && err.message) || fallback;
  const openIssues = () => (wb() ? wb().getIssues().filter(i => !i.status) : []);

  // ---- normalising the backend response ----
  function findIssue(issues, raw, start, end) {
    const viaId = raw.violation_id ?? raw.issue_id;
    return (
      (viaId != null && issues.find(i => String(i.id) === String(viaId))) ||
      (start != null && issues.find(i => !i.status && i.start_offset === start && i.end_offset === end)) ||
      issues.find(i => !i.status && i.original_text === raw.original_text) ||
      null
    );
  }

  function normalize(response) {
    const raw = Array.isArray(response)
      ? response
      : response?.suggestions || response?.data?.suggestions || [];
    const issues = wb() ? wb().getIssues() : [];

    return raw.map((s, n) => {
      const start = Number.isInteger(s.start_offset) ? s.start_offset : null;
      const end = Number.isInteger(s.end_offset) ? s.end_offset : null;
      const status = ["approved", "rejected"].includes(s.status) ? s.status : "pending";
      return {
        id: String(s.suggestion_id ?? s.id ?? `sg-${n}`),
        issueId: findIssue(issues, s, start, end)?.id ?? null,
        original_text: s.original_text ?? "",
        replacement_text: s.replacement_text ?? "",
        explanation: s.explanation ?? s.reason ?? "",
        start_offset: start,
        end_offset: end,
        status,
      };
    });
  }

  // ---- drawer ----
  function drawerOpen() { return $("rewrite-drawer")?.classList.contains("is-open"); }

  function openDrawer() {
    const drawer = $("rewrite-drawer");
    if (!drawer || drawerOpen()) return;
    state.lastFocus = document.activeElement;
    $("rewrite-scrim").hidden = false;
    drawer.classList.add("is-open");
    $("rewrite-close")?.focus();
    syncButtons();
  }

  function closeDrawer() {
    const drawer = $("rewrite-drawer");
    if (!drawer || !drawerOpen()) return;
    drawer.classList.remove("is-open");
    $("rewrite-scrim").hidden = true;
    if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
    syncButtons();
  }

  // ---- rendering ----
  function render() {
    RewriterView.renderSummary($("rewrite-summary"), state.suggestions);
    RewriterView.renderList($("rewrite-list"), state.suggestions, state.deciding);
    syncButtons();
  }

  function targetCount() {
    const open = openIssues();
    const chosen = open.filter(i => state.selected.has(String(i.id))).length;
    return chosen || open.length;
  }

  function syncButtons() {
    const btn = $("rewrite-btn");
    if (btn) {
      const count = targetCount();
      btn.disabled = state.busy || count === 0;
      btn.textContent = count ? `✨ Generate AI Rewrites (${count})` : "✨ Generate AI Rewrites";
    }
    const reopen = $("rewrite-reopen");
    if (reopen) reopen.hidden = drawerOpen() || state.suggestions.length === 0;
  }

  // Adds a "Include in rewrite" checkbox to each open issue card. The workbench
  // rebuilds #results on every render, so this runs after each workbench:changed.
  function decorateCards() {
    document.querySelectorAll("#results .issue-card").forEach(card => {
      const actions = card.querySelector(".issue-actions");
      if (!actions || card.querySelector(".rw-pick")) return;
      const id = String(card.dataset.id);

      const label = document.createElement("label");
      label.className = "rw-pick";
      label.innerHTML = `<input type="checkbox" ${state.selected.has(id) ? "checked" : ""}><span>Include in rewrite</span>`;
      // Stop the click reaching the workbench's "jump to text" handler on #results.
      label.addEventListener("click", e => e.stopPropagation());
      label.querySelector("input").addEventListener("change", e => {
        if (e.target.checked) state.selected.add(id); else state.selected.delete(id);
        syncButtons();
      });
      actions.appendChild(label);
    });
  }

  function onWorkbenchChanged() {
    const openIds = new Set(openIssues().map(i => String(i.id)));
    state.selected.forEach(id => { if (!openIds.has(id)) state.selected.delete(id); });
    decorateCards();
    syncButtons();
  }

  // ---- review + selection resolution ----
  // The workbench audit runs locally and has no review_id. The backend needs one,
  // so on first use we run the live analysis to create it, then map the selected
  // local issues onto the backend's violation ids (by offsets, then by text).
  async function ensureReview() {
    const bench = wb();
    const existing = bench.getReviewId();
    if (existing) return { reviewId: existing, serverIssues: null };

    if (isMock()) {
      const id = "mock-review";
      bench.setReviewId(id);
      return { reviewId: id, serverIssues: null };
    }

    const res = await api().analyzeContentLive(bench.getText());
    const reviewId = res?.review_id ?? res?.data?.review_id;
    if (!reviewId) throw new Error("The server did not return a review to rewrite.");
    bench.setReviewId(reviewId);
    return { reviewId, serverIssues: res.issues || res.data?.issues || [] };
  }

  function serverIdsFor(localIssues, serverIssues) {
    const ids = new Set();
    localIssues.forEach(li => {
      const match = serverIssues.find(si =>
        (si.start_offset === li.start_offset && si.end_offset === li.end_offset) ||
        si.original_text === li.original_text);
      const id = match && (match.id ?? match.violation_id);
      if (id != null) ids.add(id);
    });
    return [...ids];
  }

  // ---- 1. trigger rewrites (POST /api/rewrite) ----
  async function triggerRewriteWorkflow(reviewId, selectedIssueIds = []) {
    if (state.busy) return;
    state.busy = true;
    state.suggestions = [];
    openDrawer();
    RewriterView.renderSummary($("rewrite-summary"), []);
    RewriterView.renderLoading($("rewrite-list"));
    syncButtons();

    const forceDebug = localStorage.getItem("brandtrace.debug_rewrites") === "1";
    console.log("[Rewriter API] Triggering workflow with reviewId:", reviewId, "selectedIssueIds:", selectedIssueIds, "forceDebug:", forceDebug);

    try {
      let response;
      if (forceDebug || isMock()) {
        console.log("[Rewriter API] Using mock sample response data");
        await new Promise(r => setTimeout(r, 400));
        response = SampleData.rewriteSuggestionsResponse;
      } else {
        console.log("[Rewriter API] Sending POST /api/rewrite request...");
        response = await api().getRewriteSuggestions(reviewId, selectedIssueIds);
      }
      
      console.log("[Rewriter API] Received response successfully:", response);
      state.reviewId = reviewId;
      state.suggestions = normalize(response);
      render();
      notify(
        state.suggestions.length
          ? `${state.suggestions.length} rewrite${state.suggestions.length === 1 ? "" : "s"} ready to review.`
          : "No rewrites were suggested for these issues.",
        state.suggestions.length ? "success" : "info"
      );
    } catch (err) {
      console.error("[Rewriter API] Error encountered during rewrite generation:", err);
      const message = errMsg(err, "Something went wrong while generating rewrites.");
      RewriterView.renderError($("rewrite-list"), `${message} (Tip: Type localStorage.setItem('brandtrace.debug_rewrites', '1') in console if backend is unreachable)`);
      notify(message, "error");
    } finally {
      state.busy = false;
      syncButtons();
    }
  }

  async function startFromWorkbench() {
    if (state.busy || !wb()) return;
    const open = openIssues();
    if (!open.length) { notify("No open issues to rewrite. Run an analysis first.", "info"); return; }

    const chosen = open.filter(i => state.selected.has(String(i.id)));
    const targets = chosen.length ? chosen : open;

    let review;
    state.busy = true;
    openDrawer();
    RewriterView.renderLoading($("rewrite-list"), "Preparing review…");
    syncButtons();
    try {
      review = await ensureReview();
    } catch (err) {
      const message = errMsg(err, "Couldn't prepare the review for rewriting.");
      state.busy = false;
      RewriterView.renderError($("rewrite-list"), message);
      syncButtons();
      notify(message, "error");
      return;
    }
    state.busy = false;

    const ids = review.serverIssues
      ? serverIdsFor(targets, review.serverIssues)
      : targets.map(i => i.id);
    return triggerRewriteWorkflow(review.reviewId, ids);
  }

  // ---- 2 + 3. approve / reject one suggestion (PUT /api/approvals/{review_id}/suggestions/{id}) ----
  async function decide(suggestionId, decision) {
    const s = state.suggestions.find(x => x.id === suggestionId);
    const bench = wb();
    if (!s || !bench || s.status !== "pending" || state.deciding.has(s.id)) return;

    // Check the text can be replaced before telling the server it was approved.
    if (decision === "approved" && !RewriterEditor.locate(bench.getText(), s)) {
      s.status = "stale";
      render();
      notify("The text for this rewrite has changed, so it can't be applied.", "error");
      return;
    }

    state.deciding.add(s.id);
    render();

    try {
      await api().decideSuggestion(state.reviewId, s.id, decision);
      s.status = decision;

      if (decision === "approved") {
        // Locate again: the draft may have changed while the request was in flight.
        const spot = RewriterEditor.locate(bench.getText(), s);
        if (spot && bench.replaceRange(spot.start, spot.end, s.replacement_text, s.issueId)) {
          RewriterEditor.shiftPending(state.suggestions, s.id, spot, s.replacement_text.length);
          s.start_offset = spot.start;
          s.end_offset = spot.start + s.replacement_text.length;
          notify("Rewrite applied to your draft.", "success");
        } else {
          notify("Approved, but the text moved and couldn't be replaced. Edit the draft by hand.", "error");
        }
      } else {
        notify("Rewrite dismissed.", "info");
      }
    } catch (err) {
      notify(errMsg(err, "Couldn't save your decision. Try again."), "error");
    } finally {
      state.deciding.delete(s.id);
      render();
    }
  }

  // ---- wiring ----
  function init() {
    const btn = $("rewrite-btn");
    if (!btn) return;

    btn.addEventListener("click", startFromWorkbench);
    $("rewrite-reopen")?.addEventListener("click", openDrawer);
    $("rewrite-close")?.addEventListener("click", closeDrawer);
    $("rewrite-scrim")?.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", e => { if (e.key === "Escape" && drawerOpen()) closeDrawer(); });

    $("rewrite-list")?.addEventListener("click", e => {
      const action = e.target.closest("[data-rw]");
      if (!action) return;
      const kind = action.dataset.rw;
      if (kind === "retry") { startFromWorkbench(); return; }
      const sid = action.closest(".rw-card")?.dataset.sid;
      if (sid && kind === "approve") decide(sid, "approved");
      if (sid && kind === "reject") decide(sid, "rejected");
    });

    document.addEventListener("workbench:changed", onWorkbenchChanged);
    document.addEventListener("workbench:cleared", () => {
      state.reviewId = null;
      state.suggestions = [];
      state.selected.clear();
      closeDrawer();
      render();
    });

    onWorkbenchChanged();
  }

  window.triggerRewriteWorkflow = triggerRewriteWorkflow;
  window.BrandTraceRewriter = { open: openDrawer, close: closeDrawer };

  init();
  document.addEventListener("DOMContentLoaded", onWorkbenchChanged);
})();