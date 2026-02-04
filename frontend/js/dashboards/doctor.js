(() => {
  const STATUS_OPTIONS = ["booked", "confirmed", "cancelled", "completed"];

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function show(node) {
    if (!node) return;
    node.hidden = false;
  }

  function hide(node) {
    if (!node) return;
    node.hidden = true;
  }

  function sectionEls(root) {
    if (!root) return null;
    return {
      root,
      loading: root.querySelector('[data-role="loading"]'),
      empty: root.querySelector('[data-role="empty"]'),
      error: root.querySelector('[data-role="error"]'),
      tableWrap: root.querySelector('[data-role="table"]'),
      tbody: root.querySelector('[data-role="tbody"]'),
    };
  }

  function setSectionLoading(section) {
    if (!section) return;
    show(section.loading);
    hide(section.error);
    hide(section.empty);
    hide(section.tableWrap);
    if (section.tbody) section.tbody.innerHTML = "";
  }

  function setSectionError(section, message) {
    if (!section) return;
    hide(section.loading);
    hide(section.tableWrap);
    hide(section.empty);
    if (section.error) {
      section.error.textContent = message;
      show(section.error);
    }
  }

  function setSectionEmpty(section, message) {
    if (!section) return;
    hide(section.loading);
    hide(section.tableWrap);
    hide(section.error);
    if (section.empty) {
      section.empty.textContent = message;
      show(section.empty);
    }
  }

  function setSectionTable(section) {
    if (!section) return;
    hide(section.loading);
    hide(section.error);
    hide(section.empty);
    show(section.tableWrap);
  }

  function buildKvRows(rows) {
    return `
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
  }

  function initDashboard({ user, apiBase, el }) {
    if (!el?.moduleRoot) return;

    const apiFetch = (path, opts = {}) =>
      fetch(`${apiBase}${path}`, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          ...(opts.headers || {}),
        },
        cache: "no-store",
        credentials: "include",
      });

    el.moduleRoot.innerHTML = `
      <section class="dash-section" id="doctor-summary">
        <div class="dash-section__head">
          <h2>Summary</h2>
        </div>
        <div class="dash-loading" data-role="loading">Loading...</div>
        <div class="dash-error" data-role="error" hidden></div>
        <div class="dash-cards" data-role="cards" hidden>
          <div class="dash-card">
            <p class="dash-card__label">Today</p>
            <p class="dash-card__value" data-role="today">0</p>
          </div>
          <div class="dash-card">
            <p class="dash-card__label">Next 7 days</p>
            <p class="dash-card__value" data-role="week">0</p>
          </div>
          <div class="dash-card">
            <p class="dash-card__label">Status counts</p>
            <ul class="dash-card__list" data-role="status-list"></ul>
          </div>
        </div>
      </section>

      <section class="dash-section" id="doctor-appointments">
        <div class="dash-section__head">
          <h2>Appointments</h2>
          <div class="dash-actions">
            <label>
              Range
              <select id="doctorApptRange">
                <option value="today">Today</option>
                <option value="week">Next 7 days</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>
        </div>
        <div class="dash-loading" data-role="loading">Loading...</div>
        <div class="dash-error" data-role="error" hidden></div>
        <div class="dash-empty" data-role="empty" hidden>No appointments to display.</div>
        <div class="table-wrap" data-role="table" hidden>
          <table class="mc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody data-role="tbody"></tbody>
          </table>
        </div>
      </section>
    `;

    const summaryRoot = document.getElementById("doctor-summary");
    const summaryCards = summaryRoot?.querySelector('[data-role="cards"]');
    const summaryToday = summaryRoot?.querySelector('[data-role="today"]');
    const summaryWeek = summaryRoot?.querySelector('[data-role="week"]');
    const summaryStatusList = summaryRoot?.querySelector('[data-role="status-list"]');
    const summaryLoading = summaryRoot?.querySelector('[data-role="loading"]');
    const summaryError = summaryRoot?.querySelector('[data-role="error"]');

    const apptSection = sectionEls(document.getElementById("doctor-appointments"));
    const apptRange = document.getElementById("doctorApptRange");

    const state = {
      range: "today",
      apptMap: new Map(),
    };

    function setSummaryLoading() {
      show(summaryLoading);
      hide(summaryError);
      if (summaryCards) summaryCards.hidden = true;
    }

    function setSummaryError(message) {
      hide(summaryLoading);
      if (summaryError) {
        summaryError.textContent = message;
        show(summaryError);
      }
      if (summaryCards) summaryCards.hidden = true;
    }

    function setSummaryData(data) {
      hide(summaryLoading);
      hide(summaryError);
      if (summaryCards) summaryCards.hidden = false;
      if (summaryToday) summaryToday.textContent = String(data.today ?? 0);
      if (summaryWeek) summaryWeek.textContent = String(data.week ?? 0);

      if (summaryStatusList) {
        const entries = Object.entries(data.by_status || {});
        if (!entries.length) {
          summaryStatusList.innerHTML = "<li>No status data</li>";
          return;
        }
        summaryStatusList.innerHTML = entries
          .map(([k, v]) => `<li>${escapeHtml(k)}: ${escapeHtml(String(v))}</li>`)
          .join("");
      }
    }

    async function loadSummary() {
      setSummaryLoading();

      const res = await apiFetch("/api/doctor/summary", { method: "GET" });
      if (!res.ok) {
        setSummaryError("Unable to load summary.");
        return;
      }

      const payload = await res.json().catch(() => null);
      if (!payload || payload.success !== true || !payload.data) {
        setSummaryError("Unable to load summary.");
        return;
      }

      setSummaryData(payload.data);
    }

    function renderAppointments(items) {
      if (!Array.isArray(items) || items.length === 0) {
        setSectionEmpty(apptSection, "No appointments to display.");
        return;
      }

      setSectionTable(apptSection);
      state.apptMap.clear();

      const rows = items.map((a) => {
        const id = a.id ?? null;
        const date = a.date || "";
        const time = a.time || "";
        const patient = a.patient_name || a.name || "";
        const phone = a.patient_phone || a.phone || "";
        const status = a.status || "booked";
        const statusNorm = String(status || "").trim().toLowerCase();

        const appt = {
          id,
          status,
          specialty: a.specialty || "",
          doctor: a.doctor || a.doctor_name || "",
          date,
          time,
          name: patient,
          phone,
          email: a.patient_email || a.email || "",
        };

        if (id != null) state.apptMap.set(String(id), appt);

        const statusOptions = STATUS_OPTIONS.map((opt) => {
          const selected = opt === statusNorm ? "selected" : "";
          return `<option value="${escapeHtml(opt)}" ${selected}>${escapeHtml(opt)}</option>`;
        }).join("");

        const statusBadge = `mc-status mc-status--${escapeHtml(statusNorm || "unknown")}`;

        return `
          <tr data-appt-id="${escapeHtml(String(id ?? ""))}">
            <td>${escapeHtml(date)}</td>
            <td>${escapeHtml(time)}</td>
            <td>${escapeHtml(patient)}</td>
            <td>${escapeHtml(phone)}</td>
            <td><span class="${statusBadge}">${escapeHtml(status)}</span></td>
            <td>
              <div class="dash-inline">
                <button type="button" class="btn ghost" data-action="view" data-id="${escapeHtml(String(id ?? ""))}" style="padding:8px 12px; border-width:1px;">View</button>
                <select data-role="status" data-id="${escapeHtml(String(id ?? ""))}">
                  ${statusOptions}
                </select>
                <button type="button" class="btn ghost" data-action="save-status" data-id="${escapeHtml(String(id ?? ""))}" style="padding:8px 12px; border-width:1px;">Save</button>
                <button type="button" class="btn primary" data-action="notify" data-id="${escapeHtml(String(id ?? ""))}" style="padding:8px 12px;">Notify</button>
              </div>
            </td>
          </tr>
        `;
      });

      apptSection.tbody.innerHTML = rows.join("");
    }

    async function loadAppointments() {
      if (!apptSection) return;
      setSectionLoading(apptSection);

      const range = apptRange?.value || "today";
      state.range = range;

      const res = await apiFetch(`/api/doctor/appointments?range=${encodeURIComponent(range)}`, {
        method: "GET",
      });

      if (!res.ok) {
        setSectionError(apptSection, "Unable to load appointments.");
        return;
      }

      const payload = await res.json().catch(() => null);
      const items = payload?.data?.items || payload?.items || [];

      renderAppointments(items);
    }

    function openViewModal(appt) {
      const rows = [
        ["Status", appt.status || ""],
        ["Specialty", appt.specialty || ""],
        ["Doctor", appt.doctor || ""],
        ["Date", appt.date || ""],
        ["Time", appt.time || ""],
        ["Patient", appt.name || ""],
        ["Phone", appt.phone || ""],
        ["Email", appt.email || ""],
        ["Appointment ID", appt.id ?? ""],
      ].filter(([, v]) => String(v || "").trim());

      el.openModal({ title: "Appointment details", body: buildKvRows(rows) });
    }

    function openNotifyModal(appt) {
      const body = `
        <div class="dash-form">
          <div class="dash-form__row">
            <label for="notifyTemplate">Template</label>
            <select id="notifyTemplate">
              <option value="reminder">Reminder</option>
              <option value="change">Change request</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div class="dash-form__row" id="notifyCustomRow" hidden>
            <label for="notifyCustom">Custom message</label>
            <textarea id="notifyCustom" rows="4" placeholder="Type your message"></textarea>
          </div>
          <div class="dash-error" id="notifyError" hidden></div>
        </div>
      `;

      const footer = `
        <button type="button" class="btn ghost" data-close="true">Cancel</button>
        <button type="button" class="btn primary" data-action="send-notify">Send</button>
      `;

      el.openModal({ title: "Notify patient", body, footer });

      const modalRoot = el.modal.root;
      const templateSelect = modalRoot.querySelector("#notifyTemplate");
      const customRow = modalRoot.querySelector("#notifyCustomRow");
      const customInput = modalRoot.querySelector("#notifyCustom");
      const errorBox = modalRoot.querySelector("#notifyError");
      const sendBtn = modalRoot.querySelector('[data-action="send-notify"]');

      function showError(message) {
        if (!errorBox) return;
        errorBox.textContent = message;
        errorBox.hidden = false;
      }

      function clearError() {
        if (errorBox) errorBox.hidden = true;
      }

      if (templateSelect) {
        templateSelect.addEventListener("change", () => {
          const val = templateSelect.value;
          if (customRow) customRow.hidden = val !== "custom";
        });
      }

      if (sendBtn) {
        sendBtn.addEventListener("click", async () => {
          clearError();
          const templateKey = templateSelect ? templateSelect.value : "reminder";
          const customMessage = customInput ? customInput.value.trim() : "";

          if (templateKey === "custom" && !customMessage) {
            showError("Custom message is required.");
            return;
          }

          sendBtn.disabled = true;
          sendBtn.textContent = "Sending...";

          const res = await apiFetch(`/api/doctor/appointments/${encodeURIComponent(appt.id)}/notify`, {
            method: "POST",
            body: JSON.stringify({
              template_key: templateKey,
              custom_message: templateKey === "custom" ? customMessage : undefined,
            }),
          });

          sendBtn.disabled = false;
          sendBtn.textContent = "Send";

          if (!res.ok) {
            const data = await res.json().catch(() => null);
            const msg = data?.error?.message || "Unable to send notification.";
            showError(msg);
            return;
          }

          const data = await res.json().catch(() => null);
          if (!data || data.success !== true) {
            showError("Unable to send notification.");
            return;
          }

          el.closeModal();
          alert("Notification sent.");
        });
      }
    }

    el.moduleRoot.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;

      const viewBtn = t.closest && t.closest("[data-action='view']");
      if (viewBtn) {
        const id = viewBtn.getAttribute("data-id");
        const appt = state.apptMap.get(String(id || ""));
        if (appt) openViewModal(appt);
        return;
      }

      const saveBtn = t.closest && t.closest("[data-action='save-status']");
      if (saveBtn) {
        const id = saveBtn.getAttribute("data-id");
        const row = saveBtn.closest("tr");
        const select = row ? row.querySelector("select[data-role='status']") : null;
        const status = select ? select.value : null;
        if (!id || !status) return;

        saveBtn.disabled = true;

        apiFetch(`/api/doctor/appointments/${encodeURIComponent(id)}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        })
          .then((res) => res.json().catch(() => null).then((data) => ({ res, data })))
          .then(({ res, data }) => {
            if (!res.ok || !data || data.success !== true) {
              alert("Unable to update status.");
              return;
            }
            loadSummary();
            loadAppointments();
          })
          .catch(() => {
            alert("Unable to update status.");
          })
          .finally(() => {
            saveBtn.disabled = false;
          });
        return;
      }

      const notifyBtn = t.closest && t.closest("[data-action='notify']");
      if (notifyBtn) {
        const id = notifyBtn.getAttribute("data-id");
        const appt = state.apptMap.get(String(id || ""));
        if (appt) openNotifyModal(appt);
      }
    });

    if (apptRange) {
      apptRange.addEventListener("change", () => {
        loadAppointments();
      });
    }

    loadSummary();
    loadAppointments();
  }

  window.DashboardsDoctor = { initDashboard };
})();
