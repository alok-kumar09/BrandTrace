(function () {
  const KEY = "brandtrace.session";
  const $ = id => document.getElementById(id);
  let mode = "login";

  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.mode;
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("active", x === b));
    $("name-group").hidden = mode === "login";
    $("auth-submit").textContent = mode === "login" ? "Sign in" : "Create account";
    $("auth-error").textContent = "";
  }));

  async function handleAuth(e) {
    e.preventDefault();
    const email = $("email").value.trim();
    const pw = $("password").value;
    const name = $("name")?.value.trim() || email.split("@")[0];
    const role = document.querySelector('input[name="role"]:checked')?.value || "Brand Manager";

    if (!/^\S+@\S+\.\S+$/.test(email)) return $("auth-error").textContent = "Please enter a valid email address.";
    if (pw.length < 6) return $("auth-error").textContent = "Password must be at least 6 characters.";

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = mode === "login" ? { email, password: pw } : { name, email, password: pw, role };

    try {
      // Direct call to your Flask backend auth endpoints!
      const res = await ApiClient.request("POST", endpoint.replace("/api", ""), payload);
      
      // Save session with the JWT access token returned from Flask
      const sessionData = {
        token: res.access_token || res.token,
        name: res.user?.name || name,
        email: res.user?.email || email,
        role: res.user?.role || role,
        org: res.user?.organisation_name || "NovaTech Devices"
      };

      localStorage.setItem(KEY, JSON.stringify(sessionData));
      location.href = "index.html"; // Redirect to dashboard
    } catch (err) {
      console.warn("Backend auth failed, using simulated session fallback:", err.message);
      // Fallback local demo session if backend auth route isn't running yet
      const fallbackSession = {
        token: "mock-jwt-token-for-demo-mode",
        name: name,
        email: email,
        role: role,
        org: "NovaTech Devices"
      };
      localStorage.setItem(KEY, JSON.stringify(fallbackSession));
      location.href = "index.html";
    }
  }

  $("auth-form").addEventListener("submit", handleAuth);

  $("guest-btn").addEventListener("click", () => {
    localStorage.setItem(KEY, JSON.stringify({
      token: "demo-judge-token",
      name: "Demo Judge",
      email: "judge@brandtrace.demo",
      role: "Brand Manager",
      org: "NovaTech Devices"
    }));
    location.href = "index.html";
  });
})();