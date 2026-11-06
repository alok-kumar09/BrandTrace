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

  function startSession(s) { localStorage.setItem(KEY, JSON.stringify(s)); location.href = "index.html"; }

  $("auth-form").addEventListener("submit", e => {
    e.preventDefault();
    const email = $("email").value.trim(), pw = $("password").value, name = $("name").value.trim();
    const role = document.querySelector('input[name="role"]:checked').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return $("auth-error").textContent = "Please enter a valid email address.";
    if (pw.length < 6) return $("auth-error").textContent = "Password must be at least 6 characters.";
    if (mode === "register" && !name) return $("auth-error").textContent = "Please enter your name.";
    startSession({ name: name || email.split("@")[0], email, role });
  });

  $("guest-btn").addEventListener("click", () =>
    startSession({ name: "Demo Judge", email: "judge@brandtrace.demo", role: "Brand Manager" }));
})();