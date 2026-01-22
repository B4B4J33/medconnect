// js/dashboard.js
(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  // ====== DOM ======
  const el = {
    dashName: document.getElementById("dashName"),
    dashRole: document.getElementById("dashRole"),
    logoutBtn: document.getElementById("logoutBtn"),
    dashIntro: document.getElementById("dashIntro"),

    // Appointments
    apptTitle: document.getElementById("dashApptTitle"),
    apptLoading: document.getElementById("dashApptLoading"),
    apptEmpty: document.getElementById("dashApptEmpty"),
    apptTableWrap: document.getElementById("dashApptTableWrap"),
    apptTbody: document.getElementById("dashApptTbody"),

    // Reports
    repLoading: document.getElementById("dashRepLoading"),
    repEmpty: document.getElementById("dashRepEmpty"),
    repTableWrap: document.getElementById("dashRepTableWrap"),
    repTbody: document.getElementById("dashRepTbody"),
  };

  // ====== Helpers ======
  function setText(node, value) {
    if (!node) return;
    node.textContent = value == null ? "" : String(value);
  }

  function show(node) {
    if (!node) return;
    node.hidden = false;
  }

  function hide(node) {
    if (!node) return;
    node.hidden = true;
  }

  function normRole(role) {
    return String(role || "").trim().toLowerCase();
  }

  function portalUrl() {
    return "portal.html";
  }

  async function apiFetch(path, opts = {}) {
    const url = `${API_BASE}${path}`;
    return fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
      credentials: "include",
    });
  }

  async function getMe() {
    const res = await apiFetch("/api/me", { method: "GET" });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauth: true, data: null };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, unauth: false, data: { error: txt || "Error" } };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, unauth: false, data };
  }

  async function doLogout() {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore network errors; still redirect
    }
    window.location.href = portalUrl();
  }

  function bindLogout() {
    if (!el.logoutBtn) return;
    el.logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout();
    });
  }

  function introForRole(role) {
    if (role === "doctor") return "Your upcoming appointments and quick actions will appear here.";
    if (role === "admin") return "System overview and recent activity will appear here.";
    return "Your upcoming appointments and quick actions will appear here.";
  }

  // ====== Appointments ======
  function resetAppointmentsUI() {
    show(el.apptLoading);
    hide(el.apptEmpty);
    hide(el.apptTableWrap);
    if (el.apptTbody) el.apptTbody.innerHTML = "";
  }

  function renderAppointments(items) {
    hide(el.apptLoading);

    if (!Array.isArray(items) || items.length === 0) {
      show(el.apptEmpty);
      hide(el.apptTableWrap);
      return;
    }

    hide(el.apptEmpty);
    show(el.apptTableWrap);

    const rows = items.map((a) => {
      const date = a.date || "";
      const time = a.time || "";
      const name = a.name || "";
      const phone = a.phone || "";
      const status = a.status || a.state || "scheduled";

      // Optional action (placeholder for next phase: cancel/reschedule/view)
      const action = `<a href="appointment.html" class="btn ghost" style="padding:8px 12px; border-width:1px;">View</a>`;

      return `
        <tr>
          <td>${escapeHtml(date)}</td>
          <td>${escapeHtml(time)}</td>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(phone)}</td>
          <td>${escapeHtml(status)}</td>
          <td>${action}</td>
        </tr>
      `;
    });

    el.apptTbody.innerHTML = rows.join("");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function tryFetchAppointments(url) {
    const res = await apiFetch(url, { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data;
  }

  async function loadAppointments(user) {
    resetAppointmentsUI();

    // We’ll try multiple query patterns so it works with your API whichever filter it supports.
    // Known from your /api/me: patient_id, doctor_id, email, role.
    const role = normRole(user.role);
    const doctorId = user.doctor_id;
    const patientId = user.patient_id;
    const email = user.email;

    // Title tweak by role
    if (el.apptTitle) {
      el.apptTitle.textContent =
        role === "doctor" ? "Appointments (Doctor)" :
        role === "admin"  ? "Appointments (All)" :
                            "My Appointments";
    }

    // Candidates (first successful wins)
    const candidates = [];

    // Doctor view: prefer doctor_id filter
    if (role === "doctor" && doctorId != null) {
      candidates.push(`/api/appointments?doctor_id=${encodeURIComponent(doctorId)}`);
    }

    // Patient view: try patient_id, then email
    if (role === "patient" && patientId != null) {
      candidates.push(`/api/appointments?patient_id=${encodeURIComponent(patientId)}`);
    }
    if (email) {
      candidates.push(`/api/appointments?email=${encodeURIComponent(email)}`);
    }

    // Fallback: unfiltered list (if allowed)
    candidates.push(`/api/appointments`);

    let payload = null;
    for (const url of candidates) {
      payload = await tryFetchAppointments(url);
      if (payload) break;
    }

    // Your appointments endpoint previously returned {count, items:[...]}.
    const items = payload?.items || payload?.data || payload || [];
    renderAppointments(items);
  }

  // ====== Reports ======
  function resetReportsUI() {
    show(el.repLoading);
    hide(el.repEmpty);
    hide(el.repTableWrap);
    if (el.repTbody) el.repTbody.innerHTML = "";
  }

  function renderReports(items) {
    hide(el.repLoading);

    if (!Array.isArray(items) || items.length === 0) {
      show(el.repEmpty);
      hide(el.repTableWrap);
      return;
    }

    hide(el.repEmpty);
    show(el.repTableWrap);

    const rows = items.map((r) => {
      const uploaded = r.uploaded || r.created_at || "";
      const type = r.type || r.category || "";
      const patient = r.patient || r.patient_name || "";
      const fileLabel = r.file_name || r.file || "Download";
      const fileUrl = r.url || r.file_url || "#";

      const link =
        fileUrl && fileUrl !== "#"
          ? `<a href="${escapeHtml(fileUrl)}" class="btn ghost" style="padding:8px 12px; border-width:1px;" target="_blank" rel="noopener">Open</a>`
          : escapeHtml(fileLabel);

      return `
        <tr>
          <td>${escapeHtml(uploaded)}</td>
          <td>${escapeHtml(type)}</td>
          <td>${escapeHtml(patient)}</td>
          <td>${link}</td>
        </tr>
      `;
    });

    el.repTbody.innerHTML = rows.join("");
  }

  async function loadReports(user) {
    resetReportsUI();

    // Try a likely endpoint. If it doesn’t exist yet, we’ll fail gracefully.
    // You can later implement it in Flask and this will start working without changing front-end.
    try {
      const role = normRole(user.role);
      const patientId = user.patient_id;
      const doctorId = user.doctor_id;

      // Candidate URLs (first that returns 200 wins)
      const candidates = [];

      if (role === "patient" && patientId != null) {
        candidates.push(`/api/reports?patient_id=${encodeURIComponent(patientId)}`);
      }
      if (role === "doctor" && doctorId != null) {
        candidates.push(`/api/reports?doctor_id=${encodeURIComponent(doctorId)}`);
      }
      candidates.push(`/api/reports`);

      let payload = null;
      for (const url of candidates) {
        const res = await apiFetch(url, { method: "GET" });
        if (!res.ok) continue;
        payload = await res.json().catch(() => null);
        if (payload) break;
      }

      const items = payload?.items || payload?.data || payload || [];
      renderReports(items);
    } catch (e) {
      // Endpoint likely not implemented yet
      hide(el.repLoading);
      show(el.repEmpty);
      hide(el.repTableWrap);
    }
  }

  // ====== Init ======
  async function init() {
    bindLogout();

    // Start with a clear loading message
    if (el.dashIntro) {
      el.dashIntro.textContent = "Loading your dashboard…";
    }

    // Also show section loaders early
    resetAppointmentsUI();
    resetReportsUI();

    const me = await getMe();

    if (me.unauth) {
      window.location.href = portalUrl();
      return;
    }

    if (!me.ok || !me.data || me.data.success !== true || !me.data.user) {
      if (el.dashIntro) {
        el.dashIntro.textContent =
          "We couldn’t load your dashboard. Please log in again.";
      }
      // Soft redirect
      setTimeout(() => {
        window.location.href = portalUrl();
      }, 1200);
      return;
    }

    const user = me.data.user;
    const name = user.name || user.email || "User";
    const role = normRole(user.role) || "patient";

    // Top meta bar
    setText(el.dashName, name);
    setText(el.dashRole, role);

    // Intro becomes real content now
    if (el.dashIntro) {
      el.dashIntro.textContent = introForRole(role);
    }

    // Load data
    await Promise.all([
      loadAppointments(user),
      loadReports(user),
    ]);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
