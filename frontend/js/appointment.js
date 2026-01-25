(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const el = {
    specialty: document.getElementById("specialty"),
    doctor: document.getElementById("doctor"),
    date: document.getElementById("appointmentDate"),
    time: document.getElementById("appointmentTime"),
    name: document.getElementById("patientName"),
    phone: document.getElementById("patientPhone"),
    email: document.getElementById("patientEmail"),
    confirmBtn: document.getElementById("confirmBookingBtn"),
  };

  async function apiFetch(path, opts = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
      credentials: "include",
    });
  }

  function val(node) {
    return (node && node.value != null ? String(node.value) : "").trim();
  }

  async function ensureLoggedIn() {
    const res = await apiFetch("/api/me", { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json().catch(() => null);
    return !!(data && data.success === true && data.user);
  }

  function disableBtn(disabled) {
    if (!el.confirmBtn) return;
    el.confirmBtn.disabled = !!disabled;
    el.confirmBtn.textContent = disabled ? "Submitting..." : "Confirm";
  }

  async function submitAppointment() {
    disableBtn(true);

    const loggedIn = await ensureLoggedIn();
    if (!loggedIn) {
      disableBtn(false);
      alert("Please log in first.");
      window.location.href = "portal.html";
      return;
    }

    const payload = {
      specialty: val(el.specialty),
      doctor: val(el.doctor),
      date: val(el.date),
      time: val(el.time),
      name: val(el.name),
      phone: val(el.phone),
      email: val(el.email),
      doctor_id: null,
    };

    const doctorIdAttr =
      el.doctor && el.doctor.selectedOptions && el.doctor.selectedOptions[0]
        ? el.doctor.selectedOptions[0].getAttribute("data-doctor-id")
        : null;

    const doctorIdValue = doctorIdAttr || val(el.doctor);

    const parsed = parseInt(doctorIdValue, 10);
    if (!Number.isNaN(parsed)) payload.doctor_id = parsed;

    const missing = [];
    if (!payload.specialty) missing.push("specialty");
    if (!payload.doctor) missing.push("doctor");
    if (!payload.date) missing.push("date");
    if (!payload.time) missing.push("time");
    if (!payload.name) missing.push("name");
    if (!payload.phone) missing.push("phone");
    if (!payload.email) missing.push("email");
    if (!payload.doctor_id) missing.push("doctor_id");

    if (missing.length) {
      disableBtn(false);
      alert("Missing required fields: " + missing.join(", "));
      return;
    }

    const res = await apiFetch("/api/appointments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      disableBtn(false);
      alert("Please log in first.");
      window.location.href = "portal.html";
      return;
    }

    if (res.status === 403) {
      disableBtn(false);
      alert("Error booking appointment: Forbidden");
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      disableBtn(false);
      alert("Error booking appointment: " + (txt || "Unknown error"));
      return;
    }

    const data = await res.json().catch(() => null);
    disableBtn(false);

    if (data && data.success === true && data.appointment) {
      alert("Appointment booked successfully.");
      window.location.href = "dashboard.html";
      return;
    }

    alert("Appointment booked, but response was unexpected.");
  }

  function bind() {
    if (!el.confirmBtn) return;
    el.confirmBtn.addEventListener("click", (e) => {
      e.preventDefault();
      submitAppointment();
    });
  }

  document.addEventListener("DOMContentLoaded", bind);
})();
