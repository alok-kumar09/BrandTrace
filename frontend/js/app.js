(function () {
  const $ = id => document.getElementById(id);
  const { esc, toast, debounce, store, setError, clearError, timeLabel } = Utils;
  const K = { wb: "brandtrace.workbench.v1", gd: "brandtrace.guidelines.draft.v1" };
  const MAX = 5000;

  const skeletonCard = () => `<div class="issue-card skeleton-card" aria-hidden="true">
    <div class="skeleton sk-line w40"></div><div class="skeleton sk-line w90"></div>
    <div class="skeleton sk-line w70"></div><div class="skeleton sk-block"></div></div>`;
  const skeletons = () => `<div class="sk-label">Auditing against brand guidelines…</div>` + skeletonCard().repeat(3);

  function ensureStats() {
    if ($("st-total")) return;
    const row = document.createElement("div");
    row.className = "stats-row";
    row.innerHTML = `
      <div class="stat"><div class="value" id="st-total">0</div><div class="name">Issues found</div></div>
      <div class="stat danger"><div class="value" id="st-high">0</div><div class="name">High severity open</div></div>
      <div class="stat ok"><div class="value" id="st-reviewed">0</div><div class="name">Reviewed by you</div></div>
      <div class="stat brand"><div class="value" id="st-rules">0</div><div class="name">Active guideline rules</div></div>`;
    document.querySelector(".workbench")?.before(row);
  }

  /* ================= Workbench ================= */
  function initWorkbench() {
    ensureStats();
    const editor = $("editor"), results = $("results"), btn = $("analyse-btn"), counter = $("char-count"), status = $("save-status");
    const saved = store.get(K.wb, null);
    let issues = (saved && saved.issues) || [], source = (saved && saved.source) || null;
    editor.value = saved && typeof saved.content === "string" ? saved.content : SampleData.draft;

    const emptyHTML = `<div class="empty-state"><div class="icon">🛡️</div><h3>No audit yet</h3><p>Paste your draft and click “Analyse Content” (or press Ctrl/⌘ + Enter).</p></div>`;

    const persist = () => { store.set(K.wb, { content: editor.value, issues, source }); if (status) status.textContent = "Draft saved · " + timeLabel(); };
    const persistSoon = debounce(persist, 500);

    function updateCounter() { counter.textContent = `${editor.value.length} / ${MAX}`; counter.classList.toggle("over", editor.value.length > MAX); }

    function updateStats() {
      const g = Storage.load(), open = issues.filter(i => !i.status);
      $("st-total").textContent = issues.length;
      $("st-high").textContent = open.filter(i => i.severity === "high").length;
      $("st-reviewed").textContent = issues.filter(i => i.status).length;
      $("st-rules").textContent = g.restricted_words.length + g.approved_specs.length;
    }

    function updateSnapshot() {
      const el = $("rules-snapshot"); if (!el) return;
      const g = Storage.load();
      el.innerHTML = `<div class="label">Tone</div><p>${esc(g.tone)}</p>
        <div class="label">Restricted words</div><div class="chip-row">${g.restricted_words.map(w => `<span class="chip static">${esc(w)}</span>`).join("") || "<p>None set</p>"}</div>
        <div class="label">Approved facts</div><ul class="plain-list">${g.approved_specs.map(s => `<li>${esc(s)}</li>`).join("") || "<li>None set</li>"}</ul>
        <a class="btn btn-secondary btn-sm" href="guidelines.html" style="margin-top:12px">Edit guidelines →</a>`;
    }

    function summary() {
      const open = issues.filter(i => !i.status), c = s => open.filter(i => i.severity === s).length;
      return `<div class="summary-bar">
        <span class="badge neutral">${open.length} open</span><span class="badge high">${c("high")} high</span>
        <span class="badge medium">${c("medium")} medium</span><span class="badge low">${c("low")} low</span>
        <span class="badge resolved">${issues.length - open.length} reviewed</span>
        ${source ? `<span class="badge neutral">${source === "live" ? "🟢 Live API" : "🟡 Mock engine"}</span>` : ""}</div>`;
    }

    function render(animate = false) {
      updateStats();
      if (!issues.length) { results.innerHTML = source ? `<div class="empty-state"><div class="icon">✅</div><h3>No issues found</h3><p>This content complies with your guidelines.</p></div>` : emptyHTML; return; }
      results.innerHTML = summary() + issues.map((i, n) => `
        <article class="issue-card sev-${esc(i.severity)} ${i.status ? "resolved" : ""} ${animate ? "enter" : ""}" style="--d:${n * 70}ms" data-id="${esc(i.id)}">
          <div class="issue-head"><span class="category">${esc(i.category)}</span>
            ${i.status ? `<span class="badge resolved">${i.status === "accepted" ? "Accepted" : "Rejected"}</span>` : `<span class="badge ${esc(i.severity)}">${esc(i.severity)}</span>`}</div>
          <div class="label">Original text</div><div class="excerpt">${esc(i.original_text)}</div>
          <div class="label">Why it matters</div><div class="explanation">${esc(i.explanation)}</div>
          <div class="label">Suggested edit</div><div class="suggestion">${esc(i.suggestion)}</div>
          ${i.status ? "" : `<div class="issue-actions"><button class="btn btn-success btn-sm" data-act="accept">✔ Accept</button><button class="btn btn-ghost-danger btn-sm" data-act="reject">✖ Reject</button></div>`}
        </article>`).join("");
    }

    function validate() {
      const v = editor.value.trim();
      if (!v) { setError(editor, "Add some content to analyse."); return false; }
      if (v.length > MAX) { setError(editor, `Content is too long. The limit is ${MAX} characters.`); return false; }
      clearError(editor); return true;
    }

    async function analyse() {
      if (btn.disabled) return;
      if (!validate()) { editor.focus(); return; }
      btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> Analysing…`;
      results.innerHTML = skeletons();
      document.querySelectorAll(".stat .value").forEach(v => v.classList.add("is-pulsing"));
      try {
        const data = await ApiClient.analyzeContent(editor.value.trim(), Storage.load());
        issues = data.issues.map(i => ({ ...i, status: null })); source = data.source;
        render(true); persist();
      } catch (e) {
        results.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Analysis failed</h3><p>${esc(e.message)}</p></div>`;
      } finally {
        document.querySelectorAll(".stat .value").forEach(v => v.classList.remove("is-pulsing"));
        btn.disabled = false; btn.innerHTML = "🔍 Analyse Content";
      }
    }

    btn.addEventListener("click", analyse);
    editor.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyse(); });
    editor.addEventListener("input", () => { updateCounter(); if (editor.classList.contains("invalid")) validate(); persistSoon(); });

    results.addEventListener("click", e => {
      const b = e.target.closest("[data-act]"); if (!b) return;
      const issue = issues.find(i => i.id === b.closest(".issue-card").dataset.id); if (!issue) return;
      if (b.dataset.act === "accept") {
        const re = new RegExp(issue.original_text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        if (re.test(editor.value)) editor.value = editor.value.replace(re, issue.suggestion);
        issue.status = "accepted"; toast("Suggestion applied to your draft.");
      } else { issue.status = "rejected"; toast("Warning dismissed.", "info"); }
      updateCounter(); render(); persist();
    });

    $("clear-btn").addEventListener("click", () => {
      editor.value = ""; issues = []; source = null; store.del(K.wb); clearError(editor);
      updateCounter(); render(); if (status) status.textContent = "";
    });
    $("sample-btn").addEventListener("click", () => { editor.value = SampleData.draft; clearError(editor); updateCounter(); persist(); });

    updateCounter(); updateSnapshot(); render();
    if (saved && status) status.textContent = "Draft restored";
  }

/* ================= Guidelines Enhancements ================= */
function initGuidelines() {
  const saved = Storage.load();
  const box = $("chip-box"), input = $("chip-input"), severitySelect = $("rule-severity"), status = $("save-status"), form = $("guidelines-form");
  const sandboxInput = $("sandbox-input"), sandboxFeedback = $("sandbox-feedback");

  // Migrate or initialize rules with structured severity objects: { term: "...", severity: "..." }
  let restrictedRules = saved.restricted_terms || (saved.restricted_words || []).map(w => ({ term: w, severity: "medium" }));
  
  $("tone").value = saved.tone;
  $("specs").value = saved.approved_specs.join("\n");

  const specLines = () => $("specs").value.split("\n").map(s => s.trim()).filter(Boolean);

  function updateSandbox() {
    if (!sandboxInput || !sandboxFeedback) return;
    const text = sandboxInput.value.toLowerCase();
    if (!text) { sandboxFeedback.textContent = ""; return; }
    
    const matched = restrictedRules.find(r => text.includes(r.term.toLowerCase()));
    if (matched) {
      sandboxFeedback.className = "sandbox-fail";
      sandboxFeedback.textContent = `❌ Blocked: Contains restricted term "${matched.term}" (${matched.severity.toUpperCase()} severity).`;
    } else {
      sandboxFeedback.className = "sandbox-pass";
      sandboxFeedback.textContent = `✔ Passed: No restricted terms detected in test text.`;
    }
  }

  function renderChips() {
    box.querySelectorAll(".chip").forEach(c => c.remove());
    restrictedRules.forEach((r, i) => {
      const c = document.createElement("span");
      c.className = `chip sev-${r.severity}`;
      c.innerHTML = `${Utils.esc(r.term)} <small>(${r.severity})</small><button type="button" data-i="${i}" aria-label="Remove ${Utils.esc(r.term)}">×</button>`;
      box.appendChild(c);
    });
    const el = $("rule-count");
    if (el) el.textContent = `${restrictedRules.length} words · ${specLines().length} facts`;
    updateSandbox();
  }

  function addRule(term, severity) {
    const v = term.trim().replace(/,$/, "");
    input.value = "";
    if (!v) return;
    if (restrictedRules.some(r => r.term.toLowerCase() === v.toLowerCase())) return;
    restrictedRules.push({ term: v, severity: severity || "medium" });
    renderChips();
  }

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addRule(input.value, severitySelect.value);
    }
  });

  box.addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (b) {
      restrictedRules.splice(+b.dataset.i, 1);
      renderChips();
    }
  });

  if (sandboxInput) {
    sandboxInput.addEventListener("input", updateSandbox);
  }

  form.addEventListener("submit", e => {
    e.preventDefault();
    if (input.value.trim()) addRule(input.value, severitySelect.value);

    // Structured backend-ready schema payload serialization
    const payload = {
      ruleset_id: "org_default",
      tone_prompt: $("tone").value.trim(),
      restricted_terms: restrictedRules,
      approved_facts: specLines().map(s => {
        const parts = s.split(":");
        return { subject: parts[0]?.trim() || "General", value: parts.slice(1).join(":").trim() || s };
      })
    };

    Storage.save({
      tone: payload.tone_prompt,
      restricted_terms: payload.restricted_terms,
      restricted_words: payload.restricted_terms.map(r => r.term), // backward compatibility
      approved_specs: specLines()
    });

    status.textContent = "Saved to schema ✔";
    Utils.toast("Guidelines saved successfully ✔");
  });

  renderChips();
}

  document.addEventListener("DOMContentLoaded", () => {
    ApiClient.checkHealth();
    const page = document.body.dataset.page;
    if (page === "workbench") initWorkbench();
    if (page === "guidelines") initGuidelines();
  });
})();