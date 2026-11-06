(function () {
  const { store, debounce, toast, setError, clearError, timeLabel } = Utils;
  const KEY = "brandtrace.settings", DRAFT = "brandtrace.settings.draft", SESSION = "brandtrace.session", LOGS_KEY = "brandtrace.activity_logs.v1";
  
  const DEFAULTS = {
    org_name: "NovaTech Devices", industry: "Consumer Electronics", website: "https://novatech.example",
    contact: "brand@novatech.example", require_approval: true, show_explanations: true,
    default_role: "Content Creator", notify_high: true, notify_digest: false, min_severity: "medium",
  };
  
  const form = document.getElementById("settings-form");
  const fields = [...form.querySelectorAll("[name]")];
  const submit = form.querySelector("[type=submit]");
  const status = document.createElement("span"); status.id = "save-status"; status.className = "save-status"; submit.after(status);

  const data = { ...DEFAULTS, ...store.get(KEY, {}), ...store.get(DRAFT, {}) };
  fields.forEach(f => { if (f.type === "checkbox") f.checked = !!data[f.name]; else f.value = data[f.name] ?? ""; });
  if (store.get(DRAFT, null)) status.textContent = "Unsaved draft restored";

  const session = store.get(SESSION, null);
  if (session && session.role !== "Brand Manager") {
    document.getElementById("role-notice").hidden = false;
    fields.forEach(f => f.disabled = true); submit.disabled = true;
  }

  const read = () => Object.fromEntries(fields.map(f => [f.name, f.type === "checkbox" ? f.checked : f.value.trim()]));
  
  // Render chronological activity feed
  function renderActivityFeed() {
    const container = document.getElementById("activity-feed-container");
    if (!container) return;

    // Default mock logs if none exist in localStorage
    const defaultLogs = [
      { user: session?.name || "Priya Sharma", action: "Accepted high-severity correction on NovaBook draft", time: "10 mins ago" },
      { user: "Arjun Mehta", action: "Submitted draft copy for guidelines audit", time: "1 hour ago" },
      { user: session?.name || "Priya Sharma", action: "Updated organization restricted terms list", time: "Yesterday" }
    ];
    
    const logs = store.get(LOGS_KEY, defaultLogs);

    container.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom: 12px;">📊 Recent Governance Activity</h3>
        <div class="activity-list">
          ${logs.map(act => `
            <div class="activity-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: 0.9rem;">
              <span><strong>${Utils.esc(act.user)}</strong> ${Utils.esc(act.action)}</span>
              <small style="color: var(--muted); white-space: nowrap; margin-left: 12px;">${Utils.esc(act.time)}</small>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  const rules = {
    org_name: v => v.length >= 2 || "Organization name must be at least 2 characters.",
    contact: v => /^\S+@\S+\.\S+$/.test(v) || "Enter a valid email address.",
    website: v => !v || /^https?:\/\/\S+\.\S+/.test(v) || "Use a full URL starting with http:// or https://",
  };
  function validateField(f) {
    const r = rules[f.name]; if (!r) return true;
    const res = r(f.value.trim());
    if (res === true) { clearError(f); return true; }
    setError(f, res); return false;
  }

  const saveDraft = debounce(() => { store.set(DRAFT, read()); status.textContent = "Draft autosaved · " + timeLabel(); }, 500);
  form.addEventListener("input", e => { if (e.target.classList.contains("invalid")) validateField(e.target); saveDraft(); });
  form.addEventListener("change", saveDraft);

  form.addEventListener("submit", e => {
    e.preventDefault();
    const ok = fields.map(validateField).every(Boolean);
    if (!ok) { form.querySelector(".invalid")?.scrollIntoView({ behavior: "smooth", block: "center" }); return toast("Please fix the highlighted fields.", "error"); }
    
    const formData = read();
    
    // Enterprise Schema Payload wrapper for backend hooks
    const enterprisePayload = {
      organization: {
        name: formData.org_name,
        industry: formData.industry,
        website: formData.website,
        governance_contact: formData.contact
      },
      team_preferences: {
        require_manager_approval: formData.require_approval,
        show_explanations_default: formData.show_explanations,
        default_new_member_role: formData.default_role
      },
      notifications: {
        email_on_high_severity: formData.notify_high,
        weekly_digest_enabled: formData.notify_digest
      },
      updated_at: new Date().toISOString()
    };

    store.set(KEY, enterprisePayload);
    store.del(DRAFT);
    
    status.textContent = "Enterprise schema saved · " + timeLabel();
    toast("Organization settings saved ✔");
  });

  renderActivityFeed();
})();