// frontend/js/controllers/rewriter.js
// Feature 2: AI content rewriting.
// Depends on: Utils, ApiClient (api.js), RewriterEditor, RewriterView, and the
// window.BrandTraceWorkbench bridge exposed by workbench.js.
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const { toast } = Utils;

  // Approve only marks the card; it never edits the draft. Set to true to splice the rewrite into the draft.
  const APPROVE_APPLIES_TO_DRAFT = false;

  const state = {
    reviewId: null,
    suggestions: [],
    selected: new Set(),   // ids of workbench issues the user ticked
    deciding: new Set(),   // suggestion ids with an approve/reject request in flight
    busy: false,
    lastFocus: null,
    sample: false,         // true when the suggestions are SampleData, so the server must not be asked to decide on them
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
  // The backend's field names are not guaranteed to match SampleData's, so every field is
  // looked up under several likely names, then by a loose pattern, then from the linked issue.
  const ORIGINAL_KEYS = ["original_text", "original", "original_content", "source_text", "flagged_text", "violating_text", "violation_text", "matched_text", "before", "text"];
  const REPLACEMENT_KEYS = ["replacement_text", "rewritten_text", "rewrite", "rewritten", "replacement", "suggested_text", "suggested_rewrite", "suggested_replacement", "revised_text", "improved_text", "corrected_text", "compliant_text", "proposed_text", "new_text", "after", "suggestion", "suggested_edit", "fix"];
  const EXPLANATION_KEYS = ["explanation", "reason", "rationale", "why", "justification", "notes"];
  const ID_KEYS = ["suggestion_id", "id", "rewrite_id", "rewrite_suggestion_id", "suggestionId", "uuid"];
  const NOT_A_SUGGESTION_ID = new Set(["violation_id", "issue_id", "review_id", "organisation_id", "organization_id", "guideline_id", "user_id"]);

  function pickStr(o, keys) {
    for (const k of keys) {
      const v = o?.[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return "";
  }

  function guessStr(o, pattern, skip) {
    for (const [k, v] of Object.entries(o || {})) {
      if (typeof v === "string" && v.trim() && pattern.test(k) && !skip.includes(k) && !/(^|_)id$/i.test(k)) return v;
    }
    return "";
  }

  // Every plausible id, in priority order. decide() tries them one by one.
  function idCandidates(s) {
    const out = [];
    const add = v => { if (v != null && v !== "" && typeof v !== "object" && !out.includes(String(v))) out.push(String(v)); };
    ID_KEYS.forEach(k => add(s?.[k]));
    Object.entries(s || {}).forEach(([k, v]) => { if (/(^|_)id$/i.test(k) && !NOT_A_SUGGESTION_ID.has(k)) add(v); });
    return out;
  }

  function findIssue(issues, raw, start, end, original) {
    const viaId = raw.violation_id ?? raw.issue_id;
    return (
      (viaId != null && issues.find(i => String(i.id) === String(viaId))) ||
      (start != null && issues.find(i => !i.status && i.start_offset === start && i.end_offset === end)) ||
      (original && issues.find(i => !i.status && i.original_text === original)) ||
      null
    );
  }

  function normalize(response) {
    const raw = Array.isArray(response)
      ? response
      : response?.suggestions || response?.rewrites || response?.data?.suggestions || response?.data?.rewrites || [];
    const issues = wb() ? wb().getIssues() : [];
    if (raw.length) console.log("[Rewriter] raw suggestion fields:", Object.keys(raw[0]), raw[0]);

    return raw.map((s, n) => {
      let start = Number.isInteger(s.start_offset) ? s.start_offset : null;
      let end = Number.isInteger(s.end_offset) ? s.end_offset : null;

      let original = pickStr(s, ORIGINAL_KEYS) || guessStr(s, /orig|source|flagged|violat/i, []);
      const linked = findIssue(issues, s, start, end, original);
      if (!original && linked) original = linked.original_text || "";
      if (start == null && linked && Number.isInteger(linked.start_offset)) { start = linked.start_offset; end = linked.end_offset; }

      const replacement = pickStr(s, REPLACEMENT_KEYS) || guessStr(s, /rewrit|replac|revis|improv|propos|suggest/i, ["explanation"]);
      const ids = idCandidates(s);
      const status = ["approved", "rejected"].includes(s.status) ? s.status : "pending";

      return {
        id: ids[0] || `sg-${n}`,
        idCandidates: ids,                       // empty => the server never gave us an id to decide with
        issueId: linked?.id ?? null,
        original_text: original,
        replacement_text: replacement,
        explanation: pickStr(s, EXPLANATION_KEYS),
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

    state.sample = forceDebug || isMock();
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
  // The card always reflects the click. The server call is best effort: if it fails we say so,
  // but the decision still sticks on the page.
  async function syncDecision(s, decision) {
    if (state.sample || !s.idCandidates.length) return false;
    for (const id of s.idCandidates) {
      try {
        await api().decideSuggestion(state.reviewId, id, decision);
        return true;
      } catch (err) {
        console.warn("[Rewriter] server did not accept the decision", { reviewId: state.reviewId, suggestionId: id, decision, status: err?.status, message: err?.message });
        if (err?.status && err.status !== 404) return false;   // only a 404 (wrong id) is worth retrying with another id
      }
    }
    return false;
  }

  async function decide(suggestionId, decision) {
    const s = state.suggestions.find(x => x.id === suggestionId);
    const bench = wb();
    if (!s || s.status !== "pending" || state.deciding.has(s.id)) return;

    const spot = decision === "approved" && APPROVE_APPLIES_TO_DRAFT && bench ? RewriterEditor.locate(bench.getText(), s) : null;
    if (decision === "approved" && APPROVE_APPLIES_TO_DRAFT && !spot) {
      s.status = "stale";                         // the draft no longer contains this text: mark it, change nothing
      render();
      notify("This rewrite is out of date, so it was marked and the draft was left alone.", "info");
      return;
    }

    state.deciding.add(s.id);
    render();
    try {
      const synced = await syncDecision(s, decision);
      s.status = decision;

      if (spot) {
        const again = RewriterEditor.locate(bench.getText(), s);   // the draft may have changed while we waited
        if (again && bench.replaceRange(again.start, again.end, s.replacement_text, s.issueId)) {
          RewriterEditor.shiftPending(state.suggestions, s.id, again, s.replacement_text.length);
          s.start_offset = again.start;
          s.end_offset = again.start + s.replacement_text.length;
        }
      }

      const verb = decision === "approved" ? "Rewrite approved." : "Rewrite rejected.";
      if (synced || state.sample) notify(verb, decision === "approved" ? "success" : "info");
      else notify(`${verb} Saved on this page only (the server could not record it).`, "info");
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