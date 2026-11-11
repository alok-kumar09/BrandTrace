// frontend/js/controllers/guidelines.js
(function () {
  "use strict";

  const $ = id => document.getElementById(id);
  const { esc, toast, setError, clearError, timeLabel } = Utils;

  function notify(message, type = "success") {
    if (typeof toast === "function") {
      toast(message, type);
    } else {
      console[type === "error" ? "error" : "log"](message);
    }
  }

  // ================= GUIDELINES CONTROLLER =================

  window.initGuidelines = async function () {
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
    let approvedTerms = []; // round-tripped so saving never wipes them

    const specLines = () =>
      specsInput.value.split("\n").map(l => l.trim()).filter(Boolean);

    const factsToLines = facts => {
      if (Array.isArray(facts)) {
        return facts.map(item =>
          typeof item === "string" ? item : `${item.subject || "General"}: ${item.value || ""}`.trim()
        );
      }
      if (facts && typeof facts === "object") {
        return Object.entries(facts).map(([k, v]) => `${k}: ${v}`);
      }
      return [];
    };

    const linesToFacts = () => {
      const facts = {};
      specLines().forEach(line => {
        const i = line.indexOf(":");
        const subject = i >= 0 ? line.slice(0, i).trim() : "General";
        const value = i >= 0 ? line.slice(i + 1).trim() : line;
        if (subject && value) facts[subject] = value;
      });
      return facts;
    };

    const localSeverity = {};
    (localSaved.restricted_terms || []).forEach(r => {
      if (r && r.term) localSeverity[r.term.toLowerCase()] = r.severity || "medium";
    });

    const loadRules = rules =>
      (Array.isArray(rules) ? rules : [])
        .map(rule =>
          typeof rule === "string"
            ? { term: rule, severity: localSeverity[rule.toLowerCase()] || "medium" }
            : { term: rule.term || "", severity: rule.severity || "medium" }
        )
        .filter(rule => rule.term);

    const persistLocal = () =>
      Storage.save({
        tone: toneInput.value.trim(),
        restricted_terms: restrictedRules,
        restricted_words: restrictedRules.map(r => r.term),
        approved_terms: approvedTerms,
        approved_facts: linesToFacts()
      });

    // ---- Load from backend (fallback: local storage) ----
    try {
      const data = await ApiClient.endpoints.getGuidelines();
      restrictedRules = loadRules(data.restricted_words);
      approvedTerms = Array.isArray(data.approved_terms) ? data.approved_terms : [];
      toneInput.value = data.tone || "";
      specsInput.value = factsToLines(data.approved_facts).join("\n");
      persistLocal();
      if (status) status.textContent = "Guidelines loaded from server";
    } catch (error) {
      restrictedRules = loadRules(localSaved.restricted_terms || localSaved.restricted_words);
      approvedTerms = localSaved.approved_terms || [];
      toneInput.value = localSaved.tone || "";
      specsInput.value = factsToLines(localSaved.approved_facts).join("\n");
      if (status) {
        status.textContent =
          error.status === 404
            ? "No saved server guidelines yet. Edit and save to create them."
            : error.status === 0
            ? "Server offline. Showing this browser's saved copy."
            : `Could not load server guidelines (${error.message}). Showing this browser's saved copy.`;
      }
      console.warn("Could not load guidelines from backend:", error);
    }

    // ---- Sandbox ----
    function updateSandbox() {
      if (!sandboxInput || !sandboxFeedback) return;
      const sample = sandboxInput.value.toLowerCase();
      if (!sample) {
        sandboxFeedback.textContent = "";
        sandboxFeedback.className = "";
        return;
      }
      const matched = restrictedRules.find(r => sample.includes(r.term.toLowerCase()));
      if (matched) {
        sandboxFeedback.className = "sandbox-fail";
        sandboxFeedback.textContent = `❌ Blocked: Contains restricted term "${matched.term}" (${matched.severity.toUpperCase()} severity).`;
      } else {
        sandboxFeedback.className = "sandbox-pass";
        sandboxFeedback.textContent = "✔ Passed: No restricted terms detected in test text.";
      }
    }

    function updateCount() {
      const count = $("rule-count");
      if (count) count.textContent = `${restrictedRules.length} words · ${specLines().length} facts`;
    }

    function renderChips() {
      box.querySelectorAll(".chip").forEach(chip => chip.remove());
      restrictedRules.forEach((rule, index) => {
        const chip = document.createElement("span");
        chip.className = `chip sev-${rule.severity}`;
        chip.innerHTML = `
          ${esc(rule.term)}
          <small>(${esc(rule.severity)})</small>
          <button type="button" data-i="${index}" aria-label="Remove ${esc(rule.term)}">×</button>`;
        box.appendChild(chip);
      });
      updateCount();
      updateSandbox();
    }

    function addRule(term, severity) {
      const value = term.trim().replace(/,$/, "");
      input.value = "";
      if (!value) return;
      if (restrictedRules.some(r => r.term.toLowerCase() === value.toLowerCase())) return;
      restrictedRules.push({ term: value, severity: severity || "medium" });
      renderChips();
    }

    input.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        addRule(input.value, severitySelect.value);
      }
    });

    box.addEventListener("click", event => {
      const removeButton = event.target.closest("button[data-i]");
      if (!removeButton) return;
      restrictedRules.splice(Number(removeButton.dataset.i), 1);
      renderChips();
    });

    sandboxInput?.addEventListener("input", updateSandbox);
    specsInput.addEventListener("input", updateCount);

    // ---- Save ----
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (input.value.trim()) addRule(input.value, severitySelect.value);

      const payload = {
        tone: toneInput.value.trim(),
        restricted_words: restrictedRules.map(r => r.term),
        approved_terms: approvedTerms,
        approved_facts: linesToFacts()
      };

      if (!payload.tone) {
        setError(toneInput, "Tone is required.");
        toneInput.focus();
        return;
      }
      clearError(toneInput);

      const saveButton = form.querySelector('[type="submit"]');
      if (saveButton) saveButton.disabled = true;
      if (status) status.textContent = "Saving guidelines to server…";

      try {
        await ApiClient.endpoints.saveGuidelines(payload);
        persistLocal();
        if (status) status.textContent = "Saved to server ✔ · " + timeLabel();
        notify("Guidelines saved successfully.", "success");
      } catch (error) {
        const msg =
          error.status === 403
            ? "Only organisation Owners/Admins can edit guidelines."
            : error.message || "Backend error";
        if (status) status.textContent = `Save failed: ${msg}`;
        notify(`Guidelines were not saved: ${msg}`, "error");
      } finally {
        if (saveButton) saveButton.disabled = false;
      }
    });

    renderChips();
  };
})();