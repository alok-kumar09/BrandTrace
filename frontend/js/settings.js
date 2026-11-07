(function () {
  const { store, debounce, toast, setError, clearError, timeLabel, esc } = Utils;
  const SESSION = "brandtrace.session";
  
  const form = document.getElementById("settings-form");
  if (!form) return;

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
      const orgId = ApiClient.getOrgId();
      const orgData = await ApiClient.endpoints.fetchOrganisation(orgId);
      
      if (orgData) {
        if (orgData.name) document.getElementById("org_name").value = orgData.name;
        if (orgData.industry) document.getElementById("industry").value = orgData.industry;
        if (orgData.website) document.getElementById("website").value = orgData.website;
        if (orgData.governance_contact || orgData.contact) {
          document.getElementById("contact").value = orgData.governance_contact || orgData.contact;
        }
      }

      renderMembers(orgData.members || []);

    } catch (err) {
      console.warn("[BrandTrace] Failed to fetch organisation details:", err.message);
      // Only show the signed-in user as a placeholder when the server is unreachable.
      renderMembers(ApiClient.isOffline(err) && session ? [
        { name: session.name, email: session.email, role: session.role, created_at: null }
      ] : []);
      toast("Could not load organisation: " + err.message, "error");
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

  // --- Handle Adding a Member (`POST /api/organisations/<id>/members`) ---
  const addMemberForm = document.getElementById("add-member-form");
  const memberEmailInput = document.getElementById("new-member-email");
  const memberError = document.getElementById("member-error");

  if (addMemberForm && memberEmailInput) {
    addMemberForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (memberError) memberError.textContent = "";
      const email = memberEmailInput.value.trim();

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        if (memberError) memberError.textContent = "Please enter a valid email address.";
        return;
      }

      try {
        const orgId = ApiClient.getOrgId();
        await ApiClient.endpoints.addMember(email, orgId);
        toast(`Successfully added ${email} to organisation ✔`);
        memberEmailInput.value = "";
        loadOrgData();
      } catch (err) {
        if (memberError) memberError.textContent = err.message || "Failed to add member. Ensure user is registered.";
      }
    });
  }

  // Role permissions check
  if (session && !["Owner", "Admin", "Brand Manager"].includes(session.role)) {
    const roleNotice = document.getElementById("role-notice");
    if (roleNotice) roleNotice.hidden = false;
    fields.forEach(f => f.disabled = true); 
    submit.disabled = true;
    if (addMemberForm) addMemberForm.style.display = "none";
  }

  form.addEventListener("submit", async e => {
    e.preventDefault();
    
    // Map input fields explicitly to match backend/routes/organisations.py keys:
    // backend looks for: org_name, industry, website, contact
    const payload = {
      org_name: document.getElementById("org_name")?.value.trim() || "",
      industry: document.getElementById("industry")?.value.trim() || "",
      website: document.getElementById("website")?.value.trim() || "",
      contact: document.getElementById("contact")?.value.trim() || ""
    };
    
    try {
      status.textContent = "Saving to server...";
      const orgId = ApiClient.getOrgId();
      await ApiClient.endpoints.updateOrganisation(payload, orgId);
      status.textContent = "Saved to server ✔ · " + timeLabel();
      toast("Organization settings saved successfully ✔");
      // keep the sidebar org name in sync
      if (payload.org_name && session) {
        ApiClient.saveSession({ ...session, org: payload.org_name });
      }
    } catch (err) {
      status.textContent = "Save failed";
      toast(err.status === 403 ? "Only Owners/Admins can edit organisation settings." : "Could not save: " + err.message, "error");
    }
  });

  loadOrgData();
})();
