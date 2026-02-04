(function () {
  const API = (window.API_BASE_URL || "").replace(/\/$/, "");

  function $(id) {
    return document.getElementById(id);
  }

  function isSafeRelativePath(p) {
    if (!p) return false;
    if (p.includes("://") || p.startsWith("//")) return false;
    if (p.startsWith("javascript:")) return false;
    if (!/^[a-z0-9_\-./?=&%#]+$/i.test(p)) return false;
    return true;
  }

  function getRedirectTarget() {
    const params = new URLSearchParams(window.location.search);

    const returnTo = params.get("returnTo");
    if (isSafeRelativePath(returnTo)) return decodeURIComponent(returnTo);

    const redirect = params.get("redirect");
    if (isSafeRelativePath(redirect)) return redirect;

    return "dashboard.html";
  }

  async function getMe() {
    if (!API) return null;

    const res = await fetch(`${API}/api/me`, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (!res.ok) return null;

    const data = await res.json().catch(() => null);
    if (!data || data.success !== true || !data.user) return null;
    return data.user;
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
    alert(msg);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const existingUser = await getMe();
    if (existingUser) {
      window.location.href = getRedirectTarget();
      return;
    }

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
          name,
          email,
          phone,
          password,
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
