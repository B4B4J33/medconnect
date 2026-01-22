(function () {
  const API = (window.API_BASE_URL || "").replace(/\/$/, "");

  function $(id) {
    return document.getElementById(id);
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("redirect");
    // Safety: allow only local pages
    if (target && !target.includes("://") && !target.startsWith("//")) return target;
    return "dashboard.html";
  }

  async function postJSON(path, payload) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  function showError(msg) {
    // Keep it simple for now. If you already have a toast system, we’ll plug into it later.
    alert(msg);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const loginForm = $("loginForm");
    const registerForm = $("registerForm");

    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = ($("loginEmail")?.value || "").trim();
        const password = ($("loginPassword")?.value || "").trim();

        const { ok, data } = await postJSON("/api/auth/login", { email, password });

        if (!ok || !data.success) {
          showError(data.error || "Login failed");
          return;
        }

        window.location.href = getRedirectTarget();
      });
    }

    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = ($("regName")?.value || "").trim();
        const email = ($("regEmail")?.value || "").trim();
        const phone = ($("regPhone")?.value || "").trim();
        const password = ($("regPassword")?.value || "").trim();

        const { ok, data } = await postJSON("/api/auth/register", {
          name, email, phone, password
        });

        if (!ok || !data.success) {
          showError(data.error || "Registration failed");
          return;
        }

        window.location.href = getRedirectTarget();
      });
    }
  });
})();
