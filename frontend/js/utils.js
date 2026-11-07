const Utils = (() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const debounce = (fn, ms = 400) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const timeLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  function toast(msg, type = "success") {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.className = `toast ${type} show`; t.textContent = msg;
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600);
  }

  // Inline validation: puts a message directly under the field (or chip box).
  function setError(el, msg) {
    el.classList.add("invalid"); el.setAttribute("aria-invalid", "true");
    let n = el.nextElementSibling;
    if (!n || !n.classList.contains("field-error")) {
      n = document.createElement("div"); n.className = "field-error"; n.setAttribute("role", "alert"); el.after(n);
    }
    n.textContent = msg;
  }
  function clearError(el) {
    el.classList.remove("invalid"); el.removeAttribute("aria-invalid");
    const n = el.nextElementSibling;
    if (n && n.classList.contains("field-error")) n.remove();
  }
  return { esc, debounce, timeLabel, store, toast, setError, clearError };
})();