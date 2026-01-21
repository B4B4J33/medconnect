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

  // --- Read doctor & specialty from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const doctorParam = urlParams.get("doctor");
  const specialtyParam = urlParams.get("specialty");

  if (specialtyParam && document.getElementById("specialty")) {
    document.getElementById("specialty").value = specialtyParam;
  }
  if (doctorParam && document.getElementById("doctor")) {
    document.getElementById("doctor").value = doctorParam;
  }

  // If doctor + specialty are preselected → skip step 1
  if (doctorParam && specialtyParam) currentStep = 1;

  function buildPayload() {
    return {
      specialty: form.specialty?.value || "",
      doctor: form.doctor?.value || "",
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

      // Extra guard: prevent past date even if typed manually
      if (input === dateInput && input.value && dateInput.min && input.value < dateInput.min) {
        valid = false;
      }
    });

    nextBtn.disabled = !valid;
  }

  nextBtn.addEventListener("click", async () => {
    if (currentStep < steps.length - 1) {
      currentStep++;

      if (currentStep === steps.length - 1) {
        // Build review summary
        reviewList.innerHTML = `
          <li><strong>Specialty:</strong> ${form.specialty.value}</li>
          <li><strong>Doctor:</strong> ${form.doctor.value}</li>
          <li><strong>Date:</strong> ${form.date.value}</li>
          <li><strong>Time:</strong> ${form.time.value}</li>
          <li><strong>Name:</strong> ${form.name.value}</li>
          <li><strong>Phone:</strong> ${form.phone.value}</li>
          <li><strong>Email:</strong> ${form.email.value}</li>
        `;
      }

      showStep(currentStep);
      return;
    }

    // Confirm step: send to backend
    const payload = buildPayload();

    nextBtn.disabled = true;
    const originalLabel = nextBtn.textContent;
    nextBtn.textContent = "Submitting...";

    try {
      await submitAppointment(payload);
      alert("Appointment booked successfully");

      form.reset();
      currentStep = doctorParam && specialtyParam ? 1 : 0;
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

  showStep(currentStep);
});
