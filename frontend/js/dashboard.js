// dashboard.js (v1) — auth gate + welcome + logout + loading UX
(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const SELECTORS = {
    // Optional hooks (use if you already have them in dashboard.html)
    name: "#dashName",
    role: "#dashRole",
    logout: "#logoutBtn",
    main: "main.page-dashboard, main.dashboard, .page-dashboard, .dashboard",
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function safeText(el, value) {
    if (!el) return;
    el.textContent = value == null ? "" : String(value);
  }

  function normalizeRole(role) {
    if (!role) return "";
    return String(role).toLowerCase();
  }

  function portalUrl() {
    // Keep it simple: same folder as dashboard.html
    return "portal.html";
  }

  function ensureMainWrapper() {
    // If there's no wrapper, fall back to body
    return $(SELECTORS.main) || document.body;
  }

  function ensureTopMetaUI() {
    // If user already has the meta elements, use them.
    let nameEl = $(SELECTORS.name);
    let roleEl = $(SELECTORS.role);
    let logoutEl = $(SELECTORS.logout);

    if (nameEl && roleEl && logoutEl) {
      return { nameEl, roleEl, logoutEl };
    }

    // Otherwise inject a minimal header block that matches your CSS classes.
    const main = ensureMainWrapper();

    // If <h1> missing, don’t force it; just inject meta.
    const meta = document.createElement("div");
    meta.className = "dash-meta";
    meta.innerHTML = `
      <p class="dash-user">Welcome, <span id="dashName">...</span></p>
      <div class="dash-actions" style="display:flex; gap:10px; align-items:center;">
        <span class="dash-role" id="dashRole">...</span>
        <a href="#" class="btn ghost" id="logoutBtn">Logout</a>
      </div>
    `;

    // Insert at top of main content
    main.insertBefore(meta, main.firstChild);

    nameEl = meta.querySelector("#dashName");
    roleEl = meta.querySelector("#dashRole");
    logoutEl = meta.querySelector("#logoutBtn");

    return { nameEl, roleEl, logoutEl };
  }

  function ensureLoadingUI() {
    // Create a simple loading block at top of the page/dashboard wrapper.
    const main = ensureMainWrapper();

    let loading = main.querySelector(".dash-loading");
    if (!loading) {
      loading = document.createElement("div");
      loading.className = "dash-loading";
      loading.textContent = "Loading your dashboard…";
      main.insertBefore(loading, main.firstChild);
    }

    return {
      show(msg) {
        loading.textContent = msg || "Loading your dashboard…";
        loading.style.display = "block";
      },
      hide() {
        loading.style.display = "none";
      },
      el: loading,
    };
  }

  async function apiFetch(path, opts = {}) {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
      credentials: "include",
    });
    return res;
  }

  async function getMe() {
    const res = await apiFetch("/api/me", { method: "GET" });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauth: true, data: null };
    }

    // Any other non-2xx: treat as error
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, unauth: false, data: { error: txt || "Error" } };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, unauth: false, data };
  }

  async function logout() {
    // Even if backend returns non-200, we’ll still redirect to portal.
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    window.location.href = portalUrl();
  }

  function bindLogout(logoutEl) {
    if (!logoutEl) return;
    logoutEl.addEventListener("click", (e) => {
      e.preventDefault();
      logout();
    });
  }

  function extractName(meData) {
    // Support a few common shapes:
    // { name, email, user: { name }, ... }
    if (!meData) return "";
    if (meData.name) return meData.name;
    if (meData.user && meData.user.name) return meData.user.name;
    if (meData.email) return meData.email; // fallback
    return "";
  }

  function extractRole(meData) {
    if (!meData) return "";
    if (meData.role) return meData.role;
    if (meData.user && meData.user.role) return meData.user.role;
    return "";
  }

  async function init() {
    const loading = ensureLoadingUI();
    loading.show("Checking your session…");

    const { nameEl, roleEl, logoutEl } = ensureTopMetaUI();
    bindLogout(logoutEl);

    const me = await getMe();

    if (me.unauth) {
      window.location.href = portalUrl();
      return;
    }

    if (!me.ok) {
      // Show a friendly message (don’t dump raw errors into UI)
      loading.show("We couldn’t load your dashboard. Please refresh or log in again.");
      // Optional: after a short delay, send to portal
      setTimeout(() => {
        window.location.href = portalUrl();
      }, 1200);
      return;
    }

    const displayName = extractName(me.data) || "User";
    const role = normalizeRole(extractRole(me.data)) || "patient";

    safeText(nameEl, displayName);
    safeText(roleEl, role);

    loading.hide();
  }

  // Start
  document.addEventListener("DOMContentLoaded", init);
})();
