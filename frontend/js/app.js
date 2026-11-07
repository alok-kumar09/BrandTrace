
(function () {
  "use strict";

  const $ = id => document.getElementById(id);

  const {
    esc,
    toast,
    debounce,
    store,
    setError,
    clearError,
    timeLabel
  } = Utils;

  const K = {
    wb: "brandtrace.workbench.v1",
    gd: "brandtrace.guidelines.draft.v1"
  };

  const MAX = 5000;

  // ---- Loading Skeletons ----

  const skeletonCard = () => `
    <div class="issue-card skeleton-card" aria-hidden="true">
      <div class="skeleton sk-line w40"></div>
      <div class="skeleton sk-line w90"></div>
      <div class="skeleton sk-line w70"></div>
      <div class="skeleton sk-block"></div>
    </div>`;

  const skeletons = () => `
    <div class="sk-label" role="status" aria-live="polite">
      Auditing against brand guidelines…
    </div>
    ${skeletonCard().repeat(3)}`;

  // ---- Notifications ----

  function notify(message, type = "success") {
    if (typeof toast === "function") {
      toast(message, type);
    } else if (typeof Utils.toast === "function") {
      Utils.toast(message, type);
    } else {
      console[type === "error" ? "error" : "log"](message);
    }
  }

  // ---- Statistics ----

  function ensureStats() {
    if ($("st-total")) return;

    const workbench = document.querySelector(".workbench");
    if (!workbench) return;

    const row = document.createElement("div");
    row.className = "stats-row";

    row.innerHTML = `
      <div class="stat">
        <div class="value" id="st-total">0</div>
        <div class="name">Issues found</div>
      </div>

      <div class="stat danger">
        <div class="value" id="st-high">0</div>
        <div class="name">High severity open</div>
      </div>

      <div class="stat ok">
        <div class="value" id="st-reviewed">0</div>
        <div class="name">Reviewed by you</div>
      </div>

      <div class="stat brand">
        <div class="value" id="st-rules">0</div>
        <div class="name">Active guideline rules</div>
      </div>`;

    workbench.before(row);
  }

  // ================= WORKBENCH =================

  function initWorkbench() {
    const editor = $("editor");
    const results = $("results");
    const button = $("analyse-btn");
    const counter = $("char-count");
    const status = $("save-status");

    if (!editor || !results || !button) return;

    ensureStats();

    const saved = store.get(K.wb, null);

    let issues = Array.isArray(saved?.issues)
      ? saved.issues
      : [];

    let source = saved?.source || null;

    editor.value =
      typeof saved?.content === "string"
        ? saved.content
        : SampleData.draft;

    const emptyHTML = `
      <div class="empty-state">
        <div class="icon">🛡️</div>
        <h3>No audit yet</h3>
        <p>
          Paste your draft and click “Analyse Content”
          (or press Ctrl/⌘ + Enter).
        </p>
      </div>`;

    // ---- Persistence ----

    const persist = () => {
      store.set(K.wb, {
        content: editor.value,
        issues,
        source
      });

      if (status) {
        status.textContent = "Draft saved · " + timeLabel();
      }
    };

    const persistSoon = debounce(persist, 500);

    // ---- Character Counter ----

    function updateCounter() {
      if (!counter) return;

      counter.textContent =
        `${editor.value.length} / ${MAX}`;

      counter.classList.toggle(
        "over",
        editor.value.length > MAX
      );
    }

    // ---- Statistics Update ----

    function updateStats() {
      const total = $("st-total");
      if (!total) return;

      const guidelines = Storage.load();

      const openIssues = issues.filter(
        issue => !issue.status
      );

      total.textContent = issues.length;

      $("st-high").textContent =
        openIssues.filter(
          issue => issue.severity === "high"
        ).length;

      $("st-reviewed").textContent =
        issues.filter(issue => issue.status).length;

      $("st-rules").textContent =
        (guidelines.restricted_words || []).length +
        (guidelines.approved_specs || []).length;
    }

    // ---- Guidelines Snapshot ----

    function updateSnapshot() {
      const element = $("rules-snapshot");
      if (!element) return;

      const guidelines = Storage.load();

      const restrictedWords =
        guidelines.restricted_words || [];

      const approvedSpecs =
        guidelines.approved_specs || [];

      element.innerHTML = `
        <div class="label">Tone</div>
        <p>${esc(guidelines.tone || "")}</p>

        <div class="label">Restricted words</div>

        <div class="chip-row">
          ${
            restrictedWords.map(word =>
              `<span class="chip static">${esc(word)}</span>`
            ).join("") || "<p>None set</p>"
          }
        </div>

        <div class="label">Approved facts</div>

        <ul class="plain-list">
          ${
            approvedSpecs.map(spec =>
              `<li>${esc(spec)}</li>`
            ).join("") || "<li>None set</li>"
          }
        </ul>

        <a class="btn btn-secondary btn-sm"
           href="guidelines.html"
           style="margin-top:12px">
          Edit guidelines →
        </a>`;
    }

    // ---- Results Summary ----

    function summary() {
      const openIssues = issues.filter(
        issue => !issue.status
      );

      const count = severity =>
        openIssues.filter(
          issue => issue.severity === severity
        ).length;

      return `
        <div class="summary-bar">
          <span class="badge neutral">
            ${openIssues.length} open
          </span>

          <span class="badge high">
            ${count("high")} high
          </span>

          <span class="badge medium">
            ${count("medium")} medium
          </span>

          <span class="badge low">
            ${count("low")} low
          </span>

          <span class="badge resolved">
            ${issues.length - openIssues.length} reviewed
          </span>

          ${
            source
              ? `<span class="badge neutral">
                  ${source === "live"
                    ? "🟢 Live API"
                    : "🟡 Mock engine"}
                </span>`
              : ""
          }
        </div>`;
    }

    // ---- Render Results ----

    function render(animate = false) {
      updateStats();

      if (!issues.length) {
        results.innerHTML = source
          ? `
            <div class="empty-state">
              <div class="icon">✅</div>
              <h3>No issues found</h3>
              <p>This content complies with your guidelines.</p>
            </div>`
          : emptyHTML;

        return;
      }

      results.innerHTML =
        summary() +
        issues.map((issue, index) => `
          <article
            class="issue-card sev-${esc(issue.severity)}
              ${issue.status ? "resolved" : ""}
              ${animate ? "enter" : ""}"
            style="--d:${index * 70}ms"
            data-id="${esc(issue.id)}">

            <div class="issue-head">
              <span class="category">
                ${esc(issue.category)}
              </span>

              ${
                issue.status
                  ? `
                    <span class="badge resolved">
                      ${issue.status === "accepted"
                        ? "Accepted"
                        : "Rejected"}
                    </span>`
                  : `
                    <span class="badge ${esc(issue.severity)}">
                      ${esc(issue.severity)}
                    </span>`
              }
            </div>

            <div class="label">Original text</div>
            <div class="excerpt">
              ${esc(issue.original_text)}
            </div>

            <div class="label">Why it matters</div>
            <div class="explanation">
              ${esc(issue.explanation)}
            </div>

            <div class="label">Suggested edit</div>
            <div class="suggestion">
              ${esc(issue.suggestion)}
            </div>

            ${
              issue.status
                ? ""
                : `
                  <div class="issue-actions">
                    <button
                      class="btn btn-success btn-sm"
                      data-act="accept"
                      type="button">
                      ✔ Accept
                    </button>

                    <button
                      class="btn btn-ghost-danger btn-sm"
                      data-act="reject"
                      type="button">
                      ✖ Reject
                    </button>
                  </div>`
            }
          </article>
        `).join("");
    }

    // ---- Validation ----

    function validate() {
      const value = editor.value.trim();

      if (!value) {
        setError(
          editor,
          "Add some content to analyse."
        );
        return false;
      }

      if (value.length > MAX) {
        setError(
          editor,
          `Content is too long. The limit is ${MAX} characters.`
        );
        return false;
      }

      clearError(editor);
      return true;
    }

    // ================= ANALYSIS =================

    async function analyse() {
      if (button.disabled) return;

      if (!validate()) {
        editor.focus();
        return;
      }

      button.disabled = true;
      button.setAttribute("aria-busy", "true");

      button.innerHTML = `
        <span class="spinner" aria-hidden="true"></span>
        Analysing…
      `;

      results.innerHTML = skeletons();

      document.querySelectorAll(
        ".stat .value"
      ).forEach(value => {
        value.classList.add("is-pulsing");
      });

      try {
        const data = await ApiClient.analyzeContent(
          editor.value.trim(),
          Storage.load()
        );

        if (!data || !Array.isArray(data.issues)) {
          throw new Error(
            "The analysis service returned an invalid response."
          );
        }

        issues = data.issues.map((issue, index) => ({
          ...issue,
          id: issue.id ?? `issue-${Date.now()}-${index}`,
          status: null
        }));

        source = data.source || "mock";

        render(true);
        persist();

        notify(
          issues.length
            ? `Analysis complete. ${issues.length} issue${issues.length === 1 ? "" : "s"} found.`
            : "Analysis complete. No issues found.",
          "success"
        );

      } catch (error) {
        let message =
          error?.message ||
          "An unexpected error occurred while analysing the content.";

        if (error?.status === 401) {
          message =
            "Session expired or unauthorized. Please sign in again.";
        } else if (error?.status === 403) {
          message =
            "You do not have permission to run content audits for this organisation.";
        } else if (error?.status === 404) {
          message =
            "Analysis endpoint not found. Check backend routes.";
        }

        results.innerHTML = `
          <div class="empty-state">
            <div class="icon">⚠️</div>
            <h3>Analysis failed</h3>
            <p>${esc(message)}</p>
          </div>`;

        notify(message, "error");

      } finally {
        document.querySelectorAll(
          ".stat .value"
        ).forEach(value => {
          value.classList.remove("is-pulsing");
        });

        button.disabled = false;
        button.removeAttribute("aria-busy");
        button.innerHTML = "🔍 Analyse Content";
      }
    }

    // ---- Event Listeners ----

    button.addEventListener("click", analyse);

    editor.addEventListener("keydown", event => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter"
      ) {
        analyse();
      }
    });

    editor.addEventListener("input", () => {
      updateCounter();

      if (editor.classList.contains("invalid")) {
        validate();
      }

      persistSoon();
    });

    // ---- Accept / Reject Suggestions ----

    results.addEventListener("click", event => {
      const actionButton =
        event.target.closest("[data-act]");

      if (!actionButton) return;

      const card =
        actionButton.closest(".issue-card");

      const issue = issues.find(
        item => String(item.id) === card?.dataset.id
      );

      if (!issue) return;

      if (actionButton.dataset.act === "accept") {
        const escapedText = String(
          issue.original_text || ""
        ).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        if (escapedText) {
          const expression = new RegExp(
            escapedText,
            "i"
          );

          if (expression.test(editor.value)) {
            editor.value = editor.value.replace(
              expression,
              issue.suggestion || ""
            );
          }
        }

        issue.status = "accepted";

        notify(
          "Suggestion applied to your draft.",
          "success"
        );

      } else if (actionButton.dataset.act === "reject") {
        issue.status = "rejected";

        notify(
          "Warning dismissed.",
          "info"
        );
      }

      updateCounter();
      render();
      persist();
    });

    // ---- Clear Draft ----

    $("clear-btn")?.addEventListener("click", () => {
      editor.value = "";
      issues = [];
      source = null;

      store.del(K.wb);

      clearError(editor);

      updateCounter();
      render();

      if (status) {
        status.textContent = "";
      }
    });

    // ---- Load Sample ----

    $("sample-btn")?.addEventListener("click", () => {
      editor.value = SampleData.draft;

      clearError(editor);

      updateCounter();
      persist();
    });

    // ---- Initial State ----

    updateCounter();
    updateSnapshot();
    render();

    if (saved && status) {
      status.textContent = "Draft restored";
    }
  }

  // ================= GUIDELINES =================

  async function initGuidelines() {
    const box = $("chip-box");
    const input = $("chip-input");
    const severitySelect = $("rule-severity");
    const status = $("save-status");
    const form = $("guidelines-form");
    const sandboxInput = $("sandbox-input");
    const sandboxFeedback = $("sandbox-feedback");
    const toneInput = $("tone");
    const specsInput = $("specs");

    if (!box || !input || !severitySelect || !form || !toneInput || !specsInput) return;

    const localSaved = Storage.load();
    let restrictedRules = [];

    const specLines = () =>
      specsInput.value
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

    const factsToLines = facts => {
      if (Array.isArray(facts)) {
        return facts.map(item =>
          typeof item === "string"
            ? item
            : `${item.subject || "General"}: ${item.value || ""}`.trim()
        );
      }

      if (facts && typeof facts === "object") {
        return Object.entries(facts).map(
          ([subject, value]) => `${subject}: ${value}`
        );
      }

      return [];
    };

    const loadRules = rules =>
      (Array.isArray(rules) ? rules : [])
        .map(rule =>
          typeof rule === "string"
            ? { term: rule, severity: "medium" }
            : {
                term: rule.term || "",
                severity: rule.severity || "medium"
              }
        )
        .filter(rule => rule.term);

    // Load the organisation's saved guidelines from the backend.
    try {
      const data = await ApiClient.getGuidelines();

      restrictedRules = loadRules(data.restricted_words);
      toneInput.value = data.tone || "";
      specsInput.value = factsToLines(
        data.approved_facts
      ).join("\n");

      Storage.save({
        tone: toneInput.value,
        restricted_terms: restrictedRules,
        restricted_words: restrictedRules.map(
          rule => rule.term
        ),
        approved_specs: specLines()
      });

      if (status) {
        status.textContent = "Guidelines loaded from server";
      }

    } catch (error) {
      restrictedRules = loadRules(
        localSaved.restricted_terms ||
        localSaved.restricted_words
      );

      toneInput.value = localSaved.tone || "";
      specsInput.value = (
        localSaved.approved_specs || []
      ).join("\n");

      if (status) {
        status.textContent = error.status === 404
          ? "No saved server guidelines yet. Add or edit rules, then save."
          : "Could not load server guidelines. Showing this browser's saved copy.";
      }

      console.warn(
        "Could not load guidelines from backend:",
        error
      );
    }

    // ---- Sandbox Validation ----

    function updateSandbox() {
      if (!sandboxInput || !sandboxFeedback) return;

      const sample = sandboxInput.value.toLowerCase();

      if (!sample) {
        sandboxFeedback.textContent = "";
        sandboxFeedback.className = "";
        return;
      }

      const matched = restrictedRules.find(
        rule => sample.includes(rule.term.toLowerCase())
      );

      if (matched) {
        sandboxFeedback.className = "sandbox-fail";
        sandboxFeedback.textContent =
          `❌ Blocked: Contains restricted term "${matched.term}" (${matched.severity.toUpperCase()} severity).`;
      } else {
        sandboxFeedback.className = "sandbox-pass";
        sandboxFeedback.textContent =
          "✔ Passed: No restricted terms detected in test text.";
      }
    }

    // ---- Render Rule Chips ----

    function renderChips() {
      box.querySelectorAll(".chip").forEach(
        chip => chip.remove()
      );

      restrictedRules.forEach((rule, index) => {
        const chip = document.createElement("span");

        chip.className = `chip sev-${rule.severity}`;

        chip.innerHTML = `
          ${esc(rule.term)}
          <small>(${esc(rule.severity)})</small>

          <button
            type="button"
            data-i="${index}"
            aria-label="Remove ${esc(rule.term)}">
            ×
          </button>
        `;

        box.appendChild(chip);
      });

      const count = $("rule-count");

      if (count) {
        count.textContent =
          `${restrictedRules.length} words · ${specLines().length} facts`;
      }

      updateSandbox();
    }

    // ---- Add Restricted Rule ----

    function addRule(term, severity) {
      const value = term.trim().replace(/,$/, "");

      input.value = "";

      if (!value) return;

      if (
        restrictedRules.some(
          rule => rule.term.toLowerCase() === value.toLowerCase()
        )
      ) {
        return;
      }

      restrictedRules.push({
        term: value,
        severity: severity || "medium"
      });

      renderChips();
    }

    // ---- Input Events ----

    input.addEventListener("keydown", event => {
      if (
        event.key === "Enter" ||
        event.key === ","
      ) {
        event.preventDefault();

        addRule(
          input.value,
          severitySelect.value
        );
      }
    });

    // ---- Remove Rules ----

    box.addEventListener("click", event => {
      const removeButton =
        event.target.closest("button[data-i]");

      if (!removeButton) return;

      restrictedRules.splice(
        Number(removeButton.dataset.i),
        1
      );

      renderChips();
    });

    // ---- Sandbox Events ----

    sandboxInput?.addEventListener(
      "input",
      updateSandbox
    );

    // ---- Approved Facts Counter ----

    specsInput.addEventListener("input", () => {
      const count = $("rule-count");

      if (count) {
        count.textContent =
          `${restrictedRules.length} words · ${specLines().length} facts`;
      }
    });

    // ---- Save Guidelines ----

    form.addEventListener("submit", async event => {
      event.preventDefault();

      if (input.value.trim()) {
        addRule(
          input.value,
          severitySelect.value
        );
      }

      const approvedFacts = {};

      specLines().forEach(line => {
        const separator = line.indexOf(":");

        const subject = separator >= 0
          ? line.slice(0, separator).trim()
          : "General";

        const value = separator >= 0
          ? line.slice(separator + 1).trim()
          : line;

        if (subject && value) {
          approvedFacts[subject] = value;
        }
      });

      const payload = {
        tone: toneInput.value.trim(),
        restricted_words: restrictedRules.map(
          rule => rule.term
        ),
        approved_terms: [],
        approved_facts: approvedFacts
      };

      const saveButton =
        form.querySelector('[type="submit"]');

      if (saveButton) {
        saveButton.disabled = true;
      }

      if (status) {
        status.textContent = "Saving guidelines to server…";
      }

      try {
        await ApiClient.saveGuidelines(payload);

        Storage.save({
          tone: payload.tone,
          restricted_terms: restrictedRules,
          restricted_words: payload.restricted_words,
          approved_specs: specLines()
        });

        if (status) {
          status.textContent = "Saved to server ✔";
        }

        notify(
          "Guidelines saved successfully.",
          "success"
        );

      } catch (error) {
        if (status) {
          status.textContent =
            `Save failed: ${error.message || "Backend error"}`;
        }

        notify(
          `Guidelines were not saved: ${error.message || "Backend error"}`,
          "error"
        );

      } finally {
        if (saveButton) {
          saveButton.disabled = false;
        }
      }
    });

    renderChips();
  }

  // ================= INITIALIZATION =================

  document.addEventListener("DOMContentLoaded", () => {
    if (window.ApiClient?.checkHealth) {
      ApiClient.checkHealth();
    }

    const page = document.body.dataset.page;

    if (page === "workbench") {
      initWorkbench();
    }

    if (page === "guidelines") {
      initGuidelines();
    }
  });

})();