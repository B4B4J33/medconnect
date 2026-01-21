document.addEventListener("DOMContentLoaded", () => {
  const steps = document.querySelectorAll(".form-step");
  const stepIndicators = document.querySelectorAll(".appt-steps .step");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const form = document.getElementById("appointmentForm");
  const reviewList = document.getElementById("reviewList");

  // Only run on the appointment page
  if (!steps.length || !nextBtn || !prevBtn || !form || !reviewList || !stepIndicators.length) return;

  // Prevent double binding if script is evaluated again
  if (form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  // Disable past dates (min = today)
  const dateInput = document.getElementById("date");
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateInput.min = `${yyyy}-${mm}-${dd}`;
  }

  let currentStep = 0;

  const specialtySelect = document.getElementById("specialty");
  const doctorSelect = document.getElementById("doctor");

  // --- Read doctor & specialty from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const doctorParam = urlParams.get("doctor");     // can be id OR name (we'll handle id)
  const specialtyParam = urlParams.get("specialty");

  // Doctors cache from API
  let doctorsIndex = [];

  function normalizeSpecialtyLabel(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function toSlug(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function clearSelect(selectEl, placeholderText) {
    selectEl.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholderText;
    selectEl.appendChild(opt);
  }

  function getUniqueSpecialties(doctors) {
    const map = new Map(); // key: normalized label, value: original label
    doctors.forEach((d) => {
      const label = d?.specialty || "";
      const key = normalizeSpecialtyLabel(label);
      if (key && !map.has(key)) map.set(key, label);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }

  function populateSpecialties(doctors) {
    const specialties = getUniqueSpecialties(doctors);
    clearSelect(specialtySelect, "-- Select Specialty --");

    specialties.forEach((label) => {
      const opt = document.createElement("option");
      // keep value stable for backend + i18n-friendly: use actual label (e.g. "Cardiology")
      opt.value = label;
      opt.textContent = label;
      specialtySelect.appendChild(opt);
    });
  }

  function populateDoctorsForSpecialty(doctors, selectedSpecialty) {
    clearSelect(doctorSelect, "-- Select Doctor --");

    const specKey = normalizeSpecialtyLabel(selectedSpecialty);
    const filtered = doctors.filter((d) => {
      const dSpecKey = normalizeSpecialtyLabel(d?.specialty);
      return specKey ? dSpecKey === specKey : true;
    });

    filtered.forEach((d) => {
      const opt = document.createElement("option");
      // IMPORTANT: value is doctor_id (source of truth)
      opt.value = String(d.id);
      opt.textContent = d.full_name;
      doctorSelect.appendChild(opt);
    });

    doctorSelect.disabled = filtered.length === 0;
  }

  function resolveDoctorNameById(id) {
    const did = Number(id);
    if (!did) return "";
    const match = doctorsIndex.find((d) => Number(d.id) === did);
    return match ? match.full_name : "";
  }

  async function loadDoctors() {
    const res = await fetch(`${window.API_BASE_URL}/api/doctors`);
    const data = await res.json().catch(() => []);
    doctorsIndex = Array.isArray(data) ? data : [];
  }

  async function initDoctorStep() {
    await loadDoctors();

    populateSpecialties(doctorsIndex);

    // If specialtyParam is provided, try to preselect it
    if (specialtyParam && specialtySelect) {
      // Try match by value (label)
      const wanted = specialtyParam.trim();
      const options = Array.from(specialtySelect.options);
      const match = options.find((o) => normalizeSpecialtyLabel(o.value) === normalizeSpecialtyLabel(wanted));
      if (match) specialtySelect.value = match.value;
    }

    // Populate doctors based on selected specialty
    populateDoctorsForSpecialty(doctorsIndex, specialtySelect.value);

    // If doctorParam is provided:
    // - if it's numeric: treat as doctor_id
    // - else: try match full_name
    if (doctorParam && doctorSelect) {
      const isNumeric = /^\d+$/.test(doctorParam.trim());
      if (isNumeric) {
        const did = doctorParam.trim();
        const opt = Array.from(doctorSelect.options).find((o) => o.value === did);
        if (opt) doctorSelect.value = did;
      } else {
        const wantedName = doctorParam.trim().toLowerCase();
        const opt = Array.from(doctorSelect.options).find((o) => o.textContent.trim().toLowerCase() === wantedName);
        if (opt) doctorSelect.value = opt.value;
      }
    }

    // If doctor + specialty are preselected → skip step 1
    if (doctorSelect?.value && specialtySelect?.value) currentStep = 1;
  }

  function buildPayload() {
    const doctor_id_raw = doctorSelect?.value || "";
    const doctor_id = doctor_id_raw ? Number(doctor_id_raw) : null;

    return {
      specialty: specialtySelect?.value || "",
      doctor: doctor_id ? resolveDoctorNameById(doctor_id) : "",
      doctor_id,
      date: form.date?.value || "",
      time: form.time?.value || "",
      name: form.name?.value || "",
      phone: form.phone?.value || "",
      email: form.email?.value || "",
    };
  }

  async function submitAppointment(payload) {
    const res = await fetch(`${window.API_BASE_URL}/api/appointments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error
        ? `${data.error}${data.missing ? `: ${data.missing.join(", ")}` : ""}`
        : "Booking failed";
      throw new Error(msg);
    }
    return data;
  }

  // --- Step logic ---
  function showStep(index) {
    steps.forEach((s, i) => {
      s.classList.toggle("active", i === index);
      stepIndicators[i]?.classList.toggle("active", i === index);
    });

    prevBtn.style.display = index === 0 ? "none" : "inline-block";
    nextBtn.textContent = index === steps.length - 1 ? "Confirm" : "Next";

    validateStep();
  }

  function validateStep() {
    const activeStep = steps[currentStep];
    const inputs = activeStep.querySelectorAll("input[required], select[required]");
    let valid = true;

    inputs.forEach((input) => {
      if (!input.value) valid = false;

      if (input === dateInput && input.value && dateInput.min && input.value < dateInput.min) {
        valid = false;
      }
    });

    // Extra: on step 1, ensure doctor select enabled and selected
    if (currentStep === 0) {
      if (doctorSelect?.disabled) valid = false;
      if (!doctorSelect?.value) valid = false;
    }

    nextBtn.disabled = !valid;
  }

  // When specialty changes, refresh doctor list
  specialtySelect?.addEventListener("change", () => {
    populateDoctorsForSpecialty(doctorsIndex, specialtySelect.value);
    doctorSelect.value = "";
    validateStep();
  });

  doctorSelect?.addEventListener("change", validateStep);

  nextBtn.addEventListener("click", async () => {
    if (currentStep < steps.length - 1) {
      currentStep++;

      if (currentStep === steps.length - 1) {
        const payload = buildPayload();
        reviewList.innerHTML = `
          <li><strong>Specialty:</strong> ${payload.specialty}</li>
          <li><strong>Doctor:</strong> ${payload.doctor}</li>
          <li><strong>Date:</strong> ${payload.date}</li>
          <li><strong>Time:</strong> ${payload.time}</li>
          <li><strong>Name:</strong> ${payload.name}</li>
          <li><strong>Phone:</strong> ${payload.phone}</li>
          <li><strong>Email:</strong> ${payload.email}</li>
        `;
      }

      showStep(currentStep);
      return;
    }

    // Confirm step: send to backend
    const payload = buildPayload();

    if (!payload.doctor_id) {
      alert("Please select a doctor");
      currentStep = 0;
      showStep(currentStep);
      return;
    }

    nextBtn.disabled = true;
    const originalLabel = nextBtn.textContent;
    nextBtn.textContent = "Submitting...";

    try {
      await submitAppointment(payload);
      alert("Appointment booked successfully");

      form.reset();

      // Re-init doctor selects after reset
      populateSpecialties(doctorsIndex);
      populateDoctorsForSpecialty(doctorsIndex, "");
      doctorSelect.disabled = true;

      currentStep = 0;
      showStep(currentStep);
    } catch (err) {
      console.error(err);
      alert(`Error booking appointment${err?.message ? `: ${err.message}` : ""}`);
      showStep(currentStep);
    } finally {
      nextBtn.textContent = originalLabel;
      validateStep();
    }
  });

  prevBtn.addEventListener("click", () => {
    if (currentStep > 0) {
      currentStep--;
      showStep(currentStep);
    }
  });

  form.addEventListener("input", validateStep);

  // Init
  (async () => {
    await initDoctorStep();
    showStep(currentStep);
  })();
});
