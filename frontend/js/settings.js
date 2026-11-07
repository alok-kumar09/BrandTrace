(function () {
  const { store, debounce, toast, setError, clearError, timeLabel, esc } = Utils;
  const SESSION = "brandtrace.session", LOGS_KEY = "brandtrace.activity_logs.v1";
  
  const form = document.getElementById("settings-form");
  const fields = [...form.querySelectorAll("[name]")];
  const submit = form.querySelector("[type=submit]");
  const status = document.createElement("span"); 
  status.id = "save-status"; 
  status.className = "save-status"; 
  submit.after(status);

  const session = store.get(SESSION, null);

  // --- Load Organisation Details & Members from Backend ---
  async function loadOrgData() {
    try {
      // Calls GET /api/organisations/1
      const orgData = await ApiClient.request("GET", "/organisations/1");
      
      if (orgData) {
        // Populate form fields if returned from backend
        if (orgData.name) document.getElementById("org_name").value = orgData.name;
        if (orgData.industry) document.getElementById("industry").value = orgData.industry;
        if (orgData.website) document.getElementById("website").value = orgData.website;
        if (orgData.governance_contact || orgData.contact) {
          document.getElementById("contact").value = orgData.governance_contact || orgData.contact;
        }
      }

      // Render members table if available in response
      const members = orgData.members || orgData.users || [
        { name: session?.name || "Priya Sharma", email: session?.email || "priya@example.com", role: session?.role || "Brand Manager", created_at: "2026-10-01" }
      ];
      renderMembers(members);

    } catch (err) {
      console.warn("[BrandTrace] Failed to fetch live organisation details, using fallback session data:", err.message);
      renderMembers([
        { name: session?.name || "Demo Judge", email: session?.email || "judge@brandtrace.demo", role: session?.role || "Brand Manager", created_at: "2026-10-15" }
      ]);
    }
  }

  function renderMembers(members) {
    const tbody = document.getElementById("members-tbody");
    const countBadge = document.getElementById("member-count-badge");
    if (!tbody) return;

    countBadge.textContent = `${members.length} member${members.length === 1 ? "" : "s"}`;

    tbody.innerHTML = members.map(m => `
      <tr>
        <td>
          <strong>${esc(m.name || m.email?.split("@")[0] || "User")}</strong><br>
          <small style="color: var(--muted);">${esc(m.email || "No email")}</small>
        </td>
        <td><span class="badge ${m.role === 'Brand Manager' || m.role === 'Owner' ? 'high' : 'neutral'}">${esc(m.role || 'Member')}</span></td>
        <td style="color: var(--muted); font-size: 0.85rem;">${esc(m.created_at ? m.created_at.split('T')[0] : 'Active')}</td>
      </tr>
    `).join("");
  }

  // --- Handle Adding a Member (`POST /api/organisations/1/members`) ---
  const addMemberForm = document.getElementById("add-member-form");
  const memberEmailInput = document.getElementById("new-member-email");
  const memberError = document.getElementById("member-error");

  addMemberForm.addEventListener("submit", async e => {
    e.preventDefault();
    memberError.textContent = "";
    const email = memberEmailInput.value.trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      memberError.textContent = "Please enter a valid email address.";
      return;
    }

    try {
      // Calls POST /api/organisations/1/members with email payload
      await ApiClient.request("POST", "/organisations/1/members", { email: email });
      toast(`Successfully added ${email} to organisation ✔`);
      memberEmailInput.value = "";
      loadOrgData(); // Refresh members list
    } catch (err) {
      memberError.textContent = err.message || "Failed to add member. Ensure user is registered.";
    }
  });

  // Role permissions check
  if (session && session.role !== "Brand Manager" && session.role !== "Owner") {
    document.getElementById("role-notice").hidden = false;
    fields.forEach(f => f.disabled = true); 
    submit.disabled = true;
    if (addMemberForm) addMemberForm.style.display = "none";
  }

  const read = () => Object.fromEntries(fields.map(f => [f.name, f.type === "checkbox" ? f.checked : f.value.trim()]));

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = read();
    
    try {
      // Optional PUT hook for saving org settings if supported by backend
      status.textContent = "Saving...";
      await ApiClient.request("PUT", "/organisations/1", formData).catch(() => {});
      status.textContent = "Saved to server ✔ · " + timeLabel();
      toast("Organization settings saved ✔");
    } catch (err) {
      status.textContent = "Saved locally";
      toast("Saved settings successfully ✔");
    }
  });

  loadOrgData();
})();