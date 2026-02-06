document.addEventListener("DOMContentLoaded", () => {
  const listEl = document.getElementById("doctorList");
  const searchInput = document.getElementById("doctorSearch");
  const specialtyFilter = document.getElementById("specialtyFilter");

  if (!listEl || !searchInput || !specialtyFilter) return;

  let doctors = [];
  const DEFAULT_AVATAR = "assets/avatars/doctor-default.png";
  const API_BASE = (window.API_BASE_URL || "").replace(/\/+$/, "");

  function normalize(str) {
    return String(str || "").trim().toLowerCase();
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function resolveAvatarUrl(url) {
    if (!url) return DEFAULT_AVATAR;
    if (/^https?:\/\//i.test(url)) return url;
    if (!API_BASE) return url.startsWith("/") ? url : `/${url}`;
    return url.startsWith("/") ? `${API_BASE}${url}` : `${API_BASE}/${url}`;
  }

  function buildSpecialtyFilter(items) {
    const unique = [...new Set(items.map(d => normalize(d.specialty)))].filter(Boolean);

    const currentPlaceholder =
      specialtyFilter.querySelector('option[value=""]')?.textContent || "All Specialties";

    specialtyFilter.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = currentPlaceholder;
    placeholder.setAttribute("data-i18n", "filter_all");
    specialtyFilter.appendChild(placeholder);

    unique.forEach(spec => {
      const opt = document.createElement("option");
      opt.value = spec;
      const label = items.find(d => normalize(d.specialty) === spec)?.specialty || spec;
      opt.textContent = label;
      specialtyFilter.appendChild(opt);
    });
  }

  function getFilteredDoctors() {
    const q = normalize(searchInput.value);
    const spec = normalize(specialtyFilter.value);

    return doctors.filter(d => {
      const name = normalize(d.full_name);
      const specialty = normalize(d.specialty);

      const matchesSearch = !q || name.includes(q);
      const matchesSpecialty = !spec || specialty === spec;

      return matchesSearch && matchesSpecialty;
    });
  }

  function render(items) {
    if (!items.length) {
      listEl.innerHTML = "<p>No doctors found.</p>";
      return;
    }

    listEl.innerHTML = items.map(d => {
      const id = Number(d.id);
      const name = escapeHtml(d.full_name);
      const specialty = escapeHtml(d.specialty);

      const bookUrl =
        `appointment.html?specialty=${encodeURIComponent(d.specialty)}&doctor=${id}`;

      const avatarUrl = resolveAvatarUrl(d.avatar_url);

      return `
        <article class="doctor-card" data-specialty="${normalize(d.specialty)}">
          <img src="${avatarUrl}" alt="${name}" class="doctor-photo" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';">
          <h3>${name}</h3>
          <p>${specialty}</p>
          <a href="${bookUrl}" class="btn primary">Book</a>
        </article>
      `;
    }).join("");
  }

  function refresh() {
    render(getFilteredDoctors());
  }

  async function init() {
    try {
      const res = await fetch(`${window.API_BASE_URL}/api/doctors`);
      if (!res.ok) throw new Error("Doctors API failed");

      const payload = await res.json().catch(() => null);
      doctors = Array.isArray(payload?.data?.items)
        ? payload.data.items
        : Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
        ? payload.items
        : [];
      buildSpecialtyFilter(doctors);
      refresh();
    } catch (err) {
      console.error(err);
      listEl.innerHTML = "<p>Unable to load doctors.</p>";
    }
  }

  searchInput.addEventListener("input", refresh);
  specialtyFilter.addEventListener("change", refresh);

  init();
});
