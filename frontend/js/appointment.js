document.addEventListener("DOMContentLoaded", () => {
  const steps = document.querySelectorAll(".form-step");
  const stepIndicators = document.querySelectorAll(".appt-steps .step");
  const nextBtn = document.getElementById("nextBtn");
  const prevBtn = document.getElementById("prevBtn");
  const form = document.getElementById("appointmentForm");
  const reviewList = document.getElementById("reviewList");

  let currentStep = 0;

  // --- Read doctor & specialty from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const doctorParam = urlParams.get("doctor");
  const specialtyParam = urlParams.get("specialty");

  if (specialtyParam) {
    document.getElementById("specialty").value = specialtyParam;
  }
  if (doctorParam) {
    document.getElementById("doctor").value = doctorParam;
  }

  // If doctor + specialty are preselected → skip step 1
  if (doctorParam && specialtyParam) {
    currentStep = 1; // start at Step 2 (Date/Time)
  }

  // --- Step logic ---
  function showStep(index) {
    steps.forEach((s, i) => {
      s.classList.toggle("active", i === index);
      stepIndicators[i].classList.toggle("active", i === index);
    });

    prevBtn.style.display = index === 0 ? "none" : "inline-block";
    nextBtn.textContent = index === steps.length - 1 ? "Confirm" : "Next";

    validateStep();
  }

  function validateStep() {
    const activeStep = steps[currentStep];
    const inputs = activeStep.querySelectorAll("input[required], select[required]");
    let valid = true;

    inputs.forEach(input => {
      if (!input.value) {
        valid = false;
      }
    });

    nextBtn.disabled = !valid;
  }

  nextBtn.addEventListener("click", () => {
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
    } else {
      alert("Appointment confirmed! (later: send SMS + save to DB)");
      form.reset();
      currentStep = doctorParam && specialtyParam ? 1 : 0; // reset to first relevant step
      showStep(currentStep);
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
