// frontend/js/controllers/workbench.js
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const { esc, toast, debounce, store, setError, clearError, timeLabel } = Utils;

  const K = { wb: "brandtrace.workbench.v1" };
  const MAX = 5000;

  function notify(message, type = "success") {
    if (typeof toast === "function") toast(message, type);
    else console[type === "error" ? "error" : "log"](message);
  }

  function ensureStats() {
    if ($("st-total")) return;

    const container = document.querySelector(".workbench") || document.querySelector("main") || document.body;
    if (!container) return;

    const row = document.createElement("div");
    row.className = "stats-row";
    row.innerHTML = `
      <div class="stat"><div class="value" id="st-total">0</div><div class="name">Issues found</div></div>
      <div class="stat danger"><div class="value" id="st-high">0</div><div class="name">High severity open</div></div>
      <div class="stat ok"><div class="value" id="st-score">100.0 / 100</div><div class="name">Compliance Score</div></div>
      <div class="stat brand"><div class="value" id="st-rules">0</div><div class="name">Active guideline rules</div></div>`;

    if (container.classList && container.classList.contains("workbench")) {
      container.before(row);
    } else {
      container.prepend(row);
    }
  }

  // ---- Client-Side Analysis Engine with Exact Offset Calculation ----
  function runLocalAnalysis(text, guidelines) {
    const issues = [];
    const restrictedWords = guidelines?.restricted_words || ["cheapest", "guaranteed", "best in class"];

    restrictedWords.forEach((word, idx) => {
      if (!word.trim()) return;
      const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        issues.push({
          id: `issue-local-${start}-${end}-${idx}`,
          category: "Restricted Terminology",
          severity: "high",
          original_text: text.substring(start, end),
          explanation: `"${word}" is flagged as a restricted term in your active guidelines.`,
          suggestion: "[Remove or rephrase]",
          start_offset: start,
          end_offset: end,
          rule_reference: {
            rule_type: "restricted_word",
            matched_value: word
          }
        });
      }
    });

    issues.sort((a, b) => a.start_offset - b.start_offset);
    return { issues, source: "client-side" };
  }

  // ---- Character Offset Highlighting Utility (Backdrop Renderer) ----
  function renderHighlightedText(rawText, issues) {
    if (!issues || issues.length === 0) return esc(rawText);
    
    // Sort issues in descending order of start_offset so slicing indices don't shift
    const sorted = [...issues].sort((a, b) => (b.start_offset || 0) - (a.start_offset || 0));
    let html = rawText;

    sorted.forEach(issue => {
      const { start_offset: start, end_offset: end, severity, id } = issue;
      if (typeof start === "number" && typeof end === "number" && start >= 0 && end <= rawText.length && start < end) {
        const targetText = rawText.substring(start, end);
        const sevClass = `violation-${severity || "low"}`;
        const marked = `<mark class="${sevClass}" data-issue-id="${esc(id)}">${esc(targetText)}</mark>`;
        html = html.substring(0, start) + marked + html.substring(end);
      }
    });
    // Append a trailing newline to prevent layout collapse on trailing carriage returns
    return html + "\n";
  }

  window.initWorkbench = function () {
    const editor = $("editor");
    const results = $("results");
    const button = $("analyse-btn");
    const counter = $("char-count");
    const status = $("save-status");
    const backdrop = $("editor-backdrop");

    if (!editor || !results || !button) return;
    
    ensureStats();

    const saved = store.get(K.wb, null);
    let issues = Array.isArray(saved?.issues) ? saved.issues : [];
    let source = saved?.source || null;

    editor.value = typeof saved?.content === "string" ? saved.content : (window.SampleData?.draft || "");

    const emptyHTML = `
      <div class="empty-state">
        <div class="icon">🛡️</div>
        <h3>No audit yet</h3>
        <p>Paste your draft and click “Analyse Content” (or press Ctrl/⌘ + Enter).</p>
      </div>`;

    const persist = () => {
      store.set(K.wb, { content: editor.value, issues, source });
      if (status) status.textContent = "Draft saved · " + timeLabel();
    };

    const persistSoon = debounce(persist, 500);

    function updateCounter() {
      if (!counter) return;
      counter.textContent = `${editor.value.length} / ${MAX}`;
      counter.classList.toggle("over", editor.value.length > MAX);
    }

    function updateStats() {
      const total = $("st-total");
      if (!total) return;
      const guidelines = (typeof Storage !== "undefined" && Storage.load ? Storage.load() : {});
      const openIssues = issues.filter(i => !i.status);

      total.textContent = issues.length;
      
      const stHigh = $("st-high");
      if (stHigh) stHigh.textContent = openIssues.filter(i => i.severity === "high").length;
      
      const penalty = openIssues.reduce((acc, i) => acc + (i.severity === "high" ? 15 : i.severity === "medium" ? 8 : 3), 0);
      const score = Math.max(0, 100 - penalty).toFixed(1);
      
      const stScore = $("st-score");
      const scoreBar = $("score-bar");

      if (stScore) {
        stScore.textContent = `${score} / 100`;
        stScore.classList.remove("score-high", "score-medium", "score-low");
        
        if (scoreBar) {
          scoreBar.style.width = `${score}%`;
          scoreBar.classList.remove("score-fill-high", "score-fill-medium", "score-fill-low");
          
          if (score >= 85) {
            stScore.classList.add("score-high");
            scoreBar.classList.add("score-fill-high");
          } else if (score >= 60) {
            stScore.classList.add("score-medium");
            scoreBar.classList.add("score-fill-medium");
          } else {
            stScore.classList.add("score-low");
            scoreBar.classList.add("score-fill-low");
          }
        }
      }

      const stRules = $("st-rules");
      if (stRules) {
        stRules.textContent = (guidelines.restricted_words || []).length + Object.keys(guidelines.approved_facts || {}).length;
      }
    }

    function updateSnapshot() {
      const element = $("rules-snapshot");
      if (!element) return;
      const guidelines = (typeof Storage !== "undefined" && Storage.load ? Storage.load() : {});
      const restrictedWords = guidelines.restricted_words || [];
      const approvedSpecs = Object.entries(guidelines.approved_facts || {}).map(([s, v]) => `${s}: ${v}`);

      element.innerHTML = `
        <div class="label">Tone</div><p>${esc(guidelines.tone || "")}</p>
        <div class="label">Restricted words</div>
        <div class="chip-row">${restrictedWords.map(w => `<span class="chip static">${esc(w)}</span>`).join("") || "<p>None set</p>"}</div>
        <div class="label">Approved facts</div>
        <ul class="plain-list">${approvedSpecs.map(spec => `<li>${esc(spec)}</li>`).join("") || "<li>None set</li>"}</ul>
        <a class="btn btn-secondary btn-sm" href="guidelines.html" style="margin-top:12px">Edit guidelines →</a>`;
    }

    function summary() {
      const open = issues.filter(i => !i.status);
      const count = sev => open.filter(i => i.severity === sev).length;
      return `
        <div class="summary-bar">
          <span class="badge neutral">${open.length} open</span>
          <span class="badge high">${count("high")} high</span>
          <span class="badge medium">${count("medium")} medium</span>
          <span class="badge low">${count("low")} low</span>
          <span class="badge resolved">${issues.length - open.length} reviewed</span>
          <span class="badge neutral">⚡ Client-side JS Engine</span>
        </div>`;
    }

    // ---- Synchronized Backdrop Scrolling & Resizing ----
    if (editor && backdrop) {
      const syncScroll = () => {
        backdrop.scrollTop = editor.scrollTop;
        backdrop.scrollLeft = editor.scrollLeft;
      };
      editor.addEventListener("scroll", syncScroll);
    }

    function render(animate = false) {
      updateStats();
      if (backdrop) {
        backdrop.innerHTML = renderHighlightedText(editor.value, issues);
      }

      if (!issues.length) {
        results.innerHTML = source ? `<div class="empty-state"><div class="icon">✅</div><h3>No issues found</h3><p>This content complies with your guidelines.</p></div>` : emptyHTML;
        return;
      }

      results.innerHTML = summary() + `<div class="violation-cards-container">` + issues.map((issue, index) => `
        <article class="issue-card sev-${esc(issue.severity)} ${issue.status ? "resolved" : ""} ${animate ? "enter" : ""}" style="--d:${index * 70}ms" data-id="${esc(issue.id)}">
          <div class="issue-head">
            <span class="category">${esc(issue.category)}</span>
            ${issue.status ? `<span class="badge resolved">${issue.status === "accepted" ? "Accepted" : "Rejected"}</span>` : `<span class="badge ${esc(issue.severity)}">${esc(issue.severity)}</span>`}
          </div>
          <div class="label">Original text (Offset: ${issue.start_offset ?? 'N/A'} - ${issue.end_offset ?? 'N/A'})</div>
          <div class="excerpt">${esc(issue.original_text)}</div>
          <div class="label">Why it matters</div>
          <div class="explanation">${esc(issue.explanation)}</div>
          <div class="label">Suggested edit</div>
          <div class="suggestion">${esc(issue.suggestion)}</div>
          ${issue.rule_reference ? `<div class="rule-ref-meta" style="margin-top:8px; font-size:0.8rem; color:var(--muted);">🛡️ Matched Rule: <code>${esc(issue.rule_reference.rule_type)}</code> (${esc(issue.rule_reference.matched_value)})</div>` : ""}
          ${issue.status ? "" : `<div class="issue-actions"><button class="btn btn-success btn-sm" data-act="accept" type="button">✔ Accept</button><button class="btn btn-ghost-danger btn-sm" data-act="reject" type="button">✖ Reject</button></div>`}
        </article>`).join("") + `</div>`;
    }

    function validate() {
      const value = editor.value.trim();
      if (!value) { setError(editor, "Add some content to analyse."); return false; }
      if (value.length > MAX) { setError(editor, `Content is too long. The limit is ${MAX} characters.`); return false; }
      clearError(editor);
      return true;
    }

    function analyse() {
      if (button.disabled || !validate()) { if (!validate()) editor.focus(); return; }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.innerHTML = `<span class="spinner" aria-hidden="true"></span> Analysing…`;
      results.innerHTML = `<div class="sk-label" role="status"><span class="spinner-sm"></span> Auditing locally against guidelines…</div>`;
      document.querySelectorAll(".stat .value").forEach(v => v.classList.add("is-pulsing"));

      setTimeout(() => {
        try {
          const guidelines = (typeof Storage !== "undefined" && Storage.load ? Storage.load() : {});
          const data = runLocalAnalysis(editor.value, guidelines);

          issues = data.issues.map((issue, idx) => ({ ...issue, id: issue.id ?? `issue-${Date.now()}-${idx}`, status: null }));
          source = data.source;

          render(true);
          persist();
          notify(issues.length ? `Analysis complete. ${issues.length} issue${issues.length === 1 ? "" : "s"} found.` : "Analysis complete. No issues found.", "success");
        } catch (error) {
          const msg = error?.message || "An unexpected error occurred during local analysis.";
          results.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Analysis failed</h3><p>${esc(msg)}</p></div>`;
          notify(msg, "error");
        } finally {
          document.querySelectorAll(".stat .value").forEach(v => v.classList.remove("is-pulsing"));
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.innerHTML = "🔍 Analyse Content";
        }
      }, 300);
    }

    button.addEventListener("click", analyse);
    editor.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") analyse(); });
    
    editor.addEventListener("input", () => {
      updateCounter();
      if (backdrop) backdrop.innerHTML = renderHighlightedText(editor.value, issues);
      if (editor.classList.contains("invalid")) validate();
      persistSoon();
    });

    // ---- Card Click Interactivity: Jump to Text & Pulse Highlight ----
    results.addEventListener("click", e => {
      const card = e.target.closest(".issue-card");
      if (card && !e.target.closest("[data-act]")) {
        const issueId = card.dataset.id;
        const issue = issues.find(i => String(i.id) === String(issueId));
        
        if (issue && typeof issue.start_offset === "number" && typeof issue.end_offset === "number") {
          // 1. Focus textarea without forcing native selection highlight
          editor.focus();

          // 2. Locate the specific <mark> tag inside the backdrop and apply pulse animation
          if (backdrop) {
            backdrop.querySelectorAll("mark").forEach(m => m.classList.remove("pulse-highlight"));
            
            const mark = backdrop.querySelector(`mark[data-issue-id="${issueId}"]`);
            if (mark) {
              mark.classList.add("pulse-highlight");
              
              // Smoothly scroll textarea to center the target violation
              const topPos = mark.offsetTop - editor.clientHeight / 2;
              editor.scrollTo({
                top: Math.max(0, topPos),
                behavior: "smooth"
              });
              backdrop.scrollTop = editor.scrollTop;

              setTimeout(() => {
                mark.classList.remove("pulse-highlight");
              }, 2000);
            }
          }
        }
      }

      const actionBtn = e.target.closest("[data-act]");
      if (!actionBtn) return;
      const targetCard = actionBtn.closest(".issue-card");
      const issue = issues.find(i => String(i.id) === targetCard?.dataset.id);
      if (!issue) return;

      if (actionBtn.dataset.act === "accept") {
        const escapedText = String(issue.original_text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (escapedText) {
          const expr = new RegExp(escapedText, "i");
          if (expr.test(editor.value)) editor.value = editor.value.replace(expr, issue.suggestion || "");
        }
        issue.status = "accepted";
        notify("Suggestion applied to your draft.", "success");
      } else if (actionBtn.dataset.act === "reject") {
        issue.status = "rejected";
        notify("Warning dismissed.", "info");
      }

      updateCounter();
      render();
      persist();
    });

    $("clear-btn")?.addEventListener("click", () => {
      editor.value = ""; issues = []; source = null;
      store.del(K.wb);
      clearError(editor);
      updateCounter();
      render();
      if (status) status.textContent = "";
    });

    $("sample-btn")?.addEventListener("click", () => {
      editor.value = window.SampleData?.draft || "";
      clearError(editor);
      updateCounter();
      persist();
    });

    updateCounter();
    updateSnapshot();
    render();
    if (saved && status) status.textContent = "Draft restored";
  };
})();