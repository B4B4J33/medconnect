(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const el = {
    form: document.getElementById("appointmentForm"),
    steps: Array.from(document.querySelectorAll(".form-step")),
    stepIndicators: Array.from(document.querySelectorAll(".appt-steps .step")),
    prevBtn: document.getElementById("prevBtn"),
    nextBtn: document.getElementById("nextBtn"),
    reviewList: document.getElementById("reviewList"),

    specialty: document.getElementById("specialty"),
    doctor: document.getElementById("doctor"),
    date: document.getElementById("date"),
    time: document.getElementById("time"),
    name: document.getElementById("name"),
    phone: document.getElementById("phone"),
    email: document.getElementById("email"),
  };

  let currentStep = 1;
  let loggedUser = null;
  let skipPatientStep = false;

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

  function setVal(node, value) {
    if (!node) return;
    node.value = value == null ? "" : String(value);
  }

  function normRole(role) {
    return String(role || "").trim().toLowerCase();
  }

  function showStep(step) {
    currentStep = step;

    el.steps.forEach((s) => {
      const n = parseInt(s.getAttribute("data-step"), 10);
      s.classList.toggle("active", n === step);
    });

    el.stepIndicators.forEach((s) => {
      const n = parseInt(s.getAttribute("data-step"), 10);
      s.classList.toggle("active", n === step);
    });

    if (el.prevBtn) el.prevBtn.hidden = step === 1;
    if (el.nextBtn) el.nextBtn.textContent = step === 4 ? "Confirm" : "Next";
  }

  function nextStepNumber(fromStep) {
    if (skipPatientStep && fromStep === 2) return 4;
    return fromStep + 1;
  }

  function prevStepNumber(fromStep) {
    if (skipPatientStep && fromStep === 4) return 2;
    return fromStep - 1;
  }

  function buildReview() {
    if (!el.reviewList) return;
    const items = [
      ["Specialty", val(el.specialty)],
      ["Doctor", getDoctorLabel()],
      ["Date", val(el.date)],
      ["Time", val(el.time)],
      ["Name", val(el.name)],
      ["Phone", val(el.phone)],
      ["Email", val(el.email)],
    ];

    el.reviewList.innerHTML = items
      .filter(([, v]) => String(v || "").trim())
      .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
      .join("");
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getDoctorId() {
    if (!el.doctor) return null;
    const opt = el.doctor.selectedOptions && el.doctor.selectedOptions[0];
    const attr = opt ? opt.getAttribute("data-doctor-id") : null;
    const raw = attr || val(el.doctor);
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  function getDoctorLabel() {
    if (!el.doctor) return "";
    const opt = el.doctor.selectedOptions && el.doctor.selectedOptions[0];
    if (opt && opt.textContent) return opt.textContent.trim();
    return val(el.doctor);
  }

  function validateStep(step) {
    if (step === 1) {
      if (!val(el.specialty)) return false;
      if (!val(el.doctor)) return false;
      if (!getDoctorId()) return false;
      return true;
    }

    if (step === 2) {
      if (!val(el.date)) return false;
      if (!val(el.time)) return false;
      return true;
    }

    if (step === 3) {
      if (!val(el.name)) return false;
      if (!val(el.phone)) return false;
      if (!val(el.email)) return false;
      return true;
    }

    return true;
  }

  async function getMe() {
    const res = await apiFetch("/api/me", { method: "GET" });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || data.success !== true || !data.user) return null;
    return data.user;
  }

  function applyPatientAutofill(user) {
    if (!user) return;

    if (!val(el.name)) setVal(el.name, user.name || "");
    if (!val(el.email)) setVal(el.email, user.email || "");
    if (!val(el.phone)) setVal(el.phone, user.phone || "");
  }

  async function confirmBooking() {
    const payload = {
      specialty: val(el.specialty),
      doctor: getDoctorLabel(),
      doctor_id: getDoctorId(),
      date: val(el.date),
      time: val(el.time),
      name: val(el.name),
      phone: val(el.phone),
      email: val(el.email),
    };

    const missing = [];
    if (!payload.specialty) missing.push("specialty");
    if (!payload.doctor) missing.push("doctor");
    if (!payload.doctor_id) missing.push("doctor_id");
    if (!payload.date) missing.push("date");
    if (!payload.time) missing.push("time");
    if (!payload.name) missing.push("name");
    if (!payload.phone) missing.push("phone");
    if (!payload.email) missing.push("email");

    if (missing.length) {
      alert("Missing required fields: " + missing.join(", "));
      return;
    }

    const res = await apiFetch("/api/appointments", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.status === 401) {
      alert("Please log in first.");
      window.location.href = "portal.html";
      return;
    }

    if (res.status === 403) {
      alert("You are not allowed to create an appointment with this account.");
      return;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      alert("Error booking appointment: " + (txt || "Unknown error"));
      return;
    }

    const data = await res.json().catch(() => null);
    if (data && data.success === true && data.appointment) {
      alert("Appointment booked successfully.");
      window.location.href = "dashboard.html";
      return;
    }

    alert("Appointment booked, but response was unexpected.");
  }

  function bindNav() {
    if (el.prevBtn) {
      el.prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        const prev = prevStepNumber(currentStep);
        if (prev >= 1) showStep(prev);
      });
    }

    if (el.nextBtn) {
      el.nextBtn.addEventListener("click", async (e) => {
        e.preventDefault();

        if (!validateStep(currentStep)) {
          alert("Please complete the required fields.");
          return;
        }

        const next = nextStepNumber(currentStep);

        if (next === 4) buildReview();

        if (currentStep === 4) {
          await confirmBooking();
          return;
        }

        showStep(next);
      });
    }
  }

  async function init() {
    loggedUser = await getMe();

    if (!loggedUser) {
      window.location.href = "portal.html?redirect=appointment.html";
      return;
    }

    const role = normRole(loggedUser.role);
    skipPatientStep = role === "patient";

    if (skipPatientStep) applyPatientAutofill(loggedUser);

    showStep(1);
    bindNav();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
