(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const form = document.getElementById("contactForm");
  if (!form) return;

  const el = {
    success: document.getElementById("contactSuccess"),
    error: document.getElementById("contactError"),
    type: document.getElementById("contactType"),
    firstName: document.getElementById("firstName"),
    lastName: document.getElementById("lastName"),
    email: document.getElementById("email"),
    phone: document.getElementById("phone"),
    message: document.getElementById("message"),
    consent: document.getElementById("consent"),
    submit: form.querySelector("button[type='submit']"),
  };

  const ALLOWED_TYPES = new Set([
    "General enquiry",
    "Billing",
    "Appointment support",
    "Technical issue",
    "Feedback",
    "Other",
  ]);

  function show(node, message) {
    if (!node) return;
    if (message != null) node.textContent = message;
    node.hidden = false;
  }

  function hide(node) {
    if (!node) return;
    node.hidden = true;
    node.textContent = "";
  }

  function setError(field, message) {
    const target = document.querySelector(`[data-error-for="${field}"]`);
    if (!target) return;
    if (!message) {
      target.textContent = "";
      return;
    }
    target.textContent = message;
  }

  function clearErrors() {
    document.querySelectorAll(".contact-error").forEach((node) => {
      node.textContent = "";
    });
  }

  function normalizePhone(value) {
    return String(value || "").trim();
  }

  function phoneDigitCount(value) {
    return (value || "").replace(/\D/g, "").length;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
  }

  function validateForm() {
    let valid = true;

    const type = (el.type?.value || "").trim();
    const first = (el.firstName?.value || "").trim();
    const last = (el.lastName?.value || "").trim();
    const email = (el.email?.value || "").trim();
    const phone = normalizePhone(el.phone?.value || "");
    const message = (el.message?.value || "").trim();
    const consent = !!el.consent?.checked;

    if (!type) {
      setError("type", "Type is required.");
      valid = false;
    } else if (!ALLOWED_TYPES.has(type)) {
      setError("type", "Select a valid enquiry type.");
      valid = false;
    }

    if (!first) {
      setError("first_name", "First name is required.");
      valid = false;
    }

    if (!last) {
      setError("last_name", "Last name is required.");
      valid = false;
    }

    if (!email) {
      setError("email", "Email is required.");
      valid = false;
    } else if (!isValidEmail(email)) {
      setError("email", "Enter a valid email address.");
      valid = false;
    }

    if (!phone) {
      setError("phone", "Phone number is required.");
      valid = false;
    } else if (!/^[0-9+()\-\s]+$/.test(phone) || phoneDigitCount(phone) < 7) {
      setError("phone", "Enter a valid phone number.");
      valid = false;
    }

    if (!message) {
      setError("message", "Message is required.");
      valid = false;
    }

    if (!consent) {
      setError("consent", "Consent is required.");
      valid = false;
    }

    return valid;
  }

  function bindClearOnInput() {
    const fields = [
      "type",
      "first_name",
      "last_name",
      "email",
      "phone",
      "message",
      "consent",
    ];

    fields.forEach((field) => {
      const nodes = document.querySelectorAll(`[data-clear-for="${field}"]`);
      nodes.forEach((node) => {
        node.addEventListener("input", () => setError(field, ""));
        node.addEventListener("change", () => setError(field, ""));
      });
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    hide(el.success);
    hide(el.error);
    clearErrors();

    if (!validateForm()) return;

    const payload = {
      type: (el.type?.value || "").trim(),
      first_name: (el.firstName?.value || "").trim(),
      last_name: (el.lastName?.value || "").trim(),
      email: (el.email?.value || "").trim(),
      phone: normalizePhone(el.phone?.value || ""),
      message: (el.message?.value || "").trim(),
      consent: true,
    };

    if (el.submit) {
      el.submit.disabled = true;
      el.submit.textContent = "Sending...";
    }

    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data || data.success !== true) {
        const fieldErrors = data?.error?.field_errors || {};
        Object.entries(fieldErrors).forEach(([key, message]) => {
          setError(key, message);
        });
        show(el.error, data?.error?.message || "Unable to send message.");
        return;
      }

      show(el.success, "Message sent successfully.");
      form.reset();
    } catch (err) {
      show(el.error, "Unable to send message.");
    } finally {
      if (el.submit) {
        el.submit.disabled = false;
        el.submit.textContent = "Submit";
      }
    }
  }

  bindClearOnInput();
  form.addEventListener("submit", handleSubmit);
})();
