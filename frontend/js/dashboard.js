(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const el = {
    dashName: document.getElementById("dashName"),
    dashRole: document.getElementById("dashRole"),
    logoutBtn: document.getElementById("logoutBtn"),
    dashIntro: document.getElementById("dashIntro"),

    apptTitle: document.getElementById("dashApptTitle"),
    apptLoading: document.getElementById("dashApptLoading"),
    apptEmpty: document.getElementById("dashApptEmpty"),
    apptTableWrap: document.getElementById("dashApptTableWrap"),
    apptTbody: document.getElementById("dashApptTbody"),

    repLoading: document.getElementById("dashRepLoading"),
    repEmpty: document.getElementById("dashRepEmpty"),
    repTableWrap: document.getElementById("dashRepTableWrap"),
    repTbody: document.getElementById("dashRepTbody"),

    modal: document.getElementById("apptModal"),
    modalBody: document.getElementById("apptModalBody"),
  };

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
    return "portal.html?returnTo=" + encodeURIComponent("dashboard.html");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
    } catch (e) {}
    window.location.href = "portal.html";
  }

  function bindLogout() {
    if (!el.logoutBtn) return;
    el.logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      doLogout();
    });
  }

  function applyDashboardNavRules(user) {
    const isAuth = !!user;
    const role = normRole(user?.role);

    function setLiVisibleByHref(href, visible) {
      const a = document.querySelector(`.side-menu a[href="${href}"]`);
      const li = a ? a.closest("li") : null;
      if (li) li.hidden = !visible;
    }

    setLiVisibleByHref("dashboard.html", isAuth);
    setLiVisibleByHref("portal.html", !isAuth);
    setLiVisibleByHref("login.html", !isAuth);

    document.querySelectorAll(".side-menu li[data-roles]").forEach((li) => {
      if (!isAuth) {
        li.hidden = true;
        return;
      }
      const roles = (li.getAttribute("data-roles") || "")
        .split(",")
        .map((r) => r.trim().toLowerCase())
        .filter(Boolean);

      if (!roles.length) {
        li.hidden = false;
        return;
      }
      li.hidden = !roles.includes(role);
    });
  }

  function introForRole(role) {
    if (role === "doctor") return "Your upcoming appointments and quick actions will appear here.";
    if (role === "admin") return "System overview and recent activity will appear here.";
    return "Your upcoming appointments and quick actions will appear here.";
  }

  function resetAppointmentsUI() {
    show(el.apptLoading);
    hide(el.apptEmpty);
    hide(el.apptTableWrap);
    if (el.apptTbody) el.apptTbody.innerHTML = "";
  }

  function openModal(appt) {
    if (!el.modal || !el.modalBody) return;

    const rows = [
      ["Status", appt.status || appt.state || "scheduled"],
      ["Specialty", appt.specialty || ""],
      ["Doctor", appt.doctor || appt.doctor_name || ""],
      ["Date", appt.date || ""],
      ["Time", appt.time || ""],
      ["Name", appt.name || ""],
      ["Phone", appt.phone || ""],
      ["Email", appt.email || ""],
      ["Appointment ID", appt.id ?? ""],
    ].filter(([, v]) => String(v || "").trim());

    el.modalBody.innerHTML = `
      <div class="mc-kv">
        ${rows
          .map(
            ([k, v]) => `
              <div class="mc-kv__k">${escapeHtml(k)}</div>
              <div class="mc-kv__v">${escapeHtml(v)}</div>
            `
          )
          .join("")}
      </div>
    `;

    el.modal.hidden = false;
    el.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!el.modal) return;
    el.modal.hidden = true;
    el.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function bindModal() {
    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;

      if (t.matches('[data-close="true"]')) {
        closeModal();
        return;
      }

      const btn = t.closest && t.closest(".js-appt-view");
      if (!btn) return;

      const row = btn.closest("tr");
      const raw = row ? row.getAttribute("data-appt") : null;
      if (!raw) return;

      try {
        const appt = JSON.parse(raw);
        openModal(appt);
      } catch (err) {}
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
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

      const safeAppt = {
        id: a.id ?? null,
        status,
        specialty: a.specialty || "",
        doctor: a.doctor || a.doctor_name || "",
        date,
        time,
        name,
        phone,
        email: a.email || "",
      };

      const action = `
        <button type="button"
          class="btn ghost js-appt-view"
          style="padding:8px 12px; border-width:1px;">
          View
        </button>
      `;

      return `
        <tr data-appt="${escapeHtml(JSON.stringify(safeAppt))}">
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

  async function tryFetchAppointments(url) {
    const res = await apiFetch(url, { method: "GET" });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  }

  async function loadAppointments(user) {
    resetAppointmentsUI();

    const role = normRole(user.role);
    const doctorId = user.doctor_id;
    const patientId = user.patient_id;
    const email = user.email;

    if (el.apptTitle) {
      el.apptTitle.textContent =
        role === "doctor" ? "Appointments (Doctor)" :
        role === "admin"  ? "Appointments (All)" :
                            "My Appointments";
    }

    const candidates = [];

    if (role === "doctor" && doctorId != null) {
      candidates.push(`/api/appointments?doctor_id=${encodeURIComponent(doctorId)}`);
    }
    if (role === "patient" && patientId != null) {
      candidates.push(`/api/appointments?patient_id=${encodeURIComponent(patientId)}`);
    }
    if (email) {
      candidates.push(`/api/appointments?email=${encodeURIComponent(email)}`);
    }
    candidates.push(`/api/appointments`);

    let payload = null;
    for (const url of candidates) {
      payload = await tryFetchAppointments(url);
      if (payload) break;
    }

    const items = payload?.items || payload?.data || payload || [];
    renderAppointments(items);
  }

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
      const fileUrl = r.url || r.file_url || "";

      const link =
        fileUrl
          ? `<a href="${escapeHtml(fileUrl)}" class="btn ghost" style="padding:8px 12px; border-width:1px;" target="_blank" rel="noopener">Open</a>`
          : `<span>—</span>`;

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

    const role = normRole(user.role);
    const patientId = user.patient_id;
    const doctorId = user.doctor_id;

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
  }

  async function init() {
    bindLogout();
    bindModal();

    if (el.dashIntro) el.dashIntro.textContent = "Loading your dashboard…";
    resetAppointmentsUI();
    resetReportsUI();

    const me = await getMe();

    if (me.unauth) {
      window.location.href = portalUrl();
      return;
    }

    if (!me.ok || !me.data || me.data.success !== true || !me.data.user) {
      if (el.dashIntro) {
        el.dashIntro.textContent = "We couldn’t load your dashboard. Please log in again.";
      }
      setTimeout(() => {
        window.location.href = portalUrl();
      }, 900);
      return;
    }

    const user = me.data.user;
    const name = user.name || user.email || "User";
    const role = normRole(user.role) || "patient";

    setText(el.dashName, name);
    setText(el.dashRole, role);

    applyDashboardNavRules(user);

    if (el.dashIntro) el.dashIntro.textContent = introForRole(role);

    await loadAppointments(user);
    await loadReports(user);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
