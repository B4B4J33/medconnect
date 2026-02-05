(() => {
  const API_BASE =
    (window.API_BASE_URL || "").replace(/\/+$/, "") || "http://localhost:5000";

  const anchorsEl = document.getElementById("labsAnchors");
  const listEl = document.getElementById("labsList");
  const statusEl = document.getElementById("labsStatus");
  const errorEl = document.getElementById("labsError");
  const errorMessageEl = document.getElementById("labsErrorMessage");
  const retryBtn = document.getElementById("labsRetry");
  const emptyEl = document.getElementById("labsEmpty");

  if (!anchorsEl || !listEl || !statusEl || !errorEl || !errorMessageEl || !retryBtn || !emptyEl) {
    return;
  }

  function formatPrice(value, currency) {
    const amount = Number(value || 0);
    const formatted = Number.isFinite(amount)
      ? amount.toLocaleString("en-MU")
      : "0";
    if (currency && currency !== "MUR") {
      return `${currency} ${formatted}`;
    }
    return `Rs ${formatted}`;
  }

  function pkgId(slug) {
    return `pkg-${slug}`;
  }

  function createAnchor(pkg) {
    const anchor = document.createElement("a");
    anchor.className = "labs-anchor";
    anchor.href = `#${pkgId(pkg.slug)}`;
    anchor.textContent = pkg.name;
    return anchor;
  }

  function createCard(pkg) {
    const card = document.createElement("article");
    card.className = "lab-card";
    card.id = pkgId(pkg.slug);

    const header = document.createElement("div");
    header.className = "lab-card__header";

    const title = document.createElement("h3");
    title.className = "lab-card__title";
    title.textContent = pkg.name;

    const price = document.createElement("div");
    price.className = "lab-card__price";
    price.textContent = formatPrice(pkg.price_mur, pkg.currency);

    header.appendChild(title);
    header.appendChild(price);

    const divider = document.createElement("div");
    divider.className = "lab-card__divider";

    const body = document.createElement("div");
    const label = document.createElement("div");
    label.className = "lab-card__label";
    label.textContent = "Includes";

    const list = document.createElement("ul");
    list.className = "lab-card__list";

    const contents = Array.isArray(pkg.contents) ? pkg.contents : [];
    const maxVisible = 8;
    const hasToggle = contents.length > maxVisible;

    contents.forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = item;
      if (hasToggle && index >= maxVisible) {
        li.classList.add("is-hidden");
      }
      list.appendChild(li);
    });

    body.appendChild(label);
    body.appendChild(list);

    if (hasToggle) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "lab-card__toggle";
      toggle.textContent = "Show all";
      toggle.addEventListener("click", () => {
        const hiddenItems = list.querySelectorAll("li.is-hidden");
        const isExpanded = toggle.getAttribute("data-expanded") === "true";
        hiddenItems.forEach((li) => {
          li.classList.toggle("is-hidden", isExpanded);
        });
        toggle.setAttribute("data-expanded", isExpanded ? "false" : "true");
        toggle.textContent = isExpanded ? "Show all" : "Show less";
      });
      body.appendChild(toggle);
    }

    const footer = document.createElement("div");
    footer.className = "lab-card__footer";

    const note = document.createElement("div");
    note.className = "lab-card__note";
    note.textContent = pkg.preparation_note || "Preparation: not specified";

    const cta = document.createElement("a");
    cta.className = "lab-card__cta";
    const params = new URLSearchParams();
    params.set("package", pkg.name);
    if (pkg.category) {
      params.set("category", pkg.category);
    }
    cta.href = `request-quote.html?${params.toString()}`;
    cta.textContent = "Request quote";

    footer.appendChild(note);
    footer.appendChild(cta);

    card.appendChild(header);
    card.appendChild(divider);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
  }

  function renderPackages(packages) {
    anchorsEl.innerHTML = "";
    listEl.innerHTML = "";

    packages.forEach((pkg) => {
      anchorsEl.appendChild(createAnchor(pkg));
      listEl.appendChild(createCard(pkg));
    });
  }

  function renderState({ loading = false, error = "", packages = [] }) {
    const hasPackages = Array.isArray(packages) && packages.length > 0;

    if (loading) {
      statusEl.textContent = "Loading packages...";
      statusEl.hidden = false;
    } else {
      statusEl.hidden = true;
    }

    if (error && !loading && !hasPackages) {
      errorEl.hidden = false;
      errorMessageEl.textContent = error;
    } else {
      errorEl.hidden = true;
      errorMessageEl.textContent = "";
    }

    if (!loading && !error && !hasPackages) {
      emptyEl.hidden = false;
    } else {
      emptyEl.hidden = true;
    }

    if (hasPackages) {
      renderPackages(packages);
    } else {
      anchorsEl.innerHTML = "";
      listEl.innerHTML = "";
    }
  }

  function highlightTarget(target) {
    if (!target) return;
    target.classList.add("is-highlight");
    setTimeout(() => target.classList.remove("is-highlight"), 1500);
  }

  anchorsEl.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || !link.hash) return;
    event.preventDefault();
    const id = link.hash.replace("#", "");
    const target = document.getElementById(id);
    if (!target) return;

    if ("scrollBehavior" in document.documentElement.style) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.location.hash = id;
    }
    highlightTarget(target);
  });

  async function loadPackages() {
    renderState({ loading: true });
    try {
      const res = await fetch(`${API_BASE}/api/lab-packages`, { method: "GET" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || data.success !== true) {
        throw new Error(data?.error?.message || "Unable to load packages.");
      }
      renderState({ packages: data.data || [] });
    } catch (err) {
      renderState({ error: err?.message || "Unable to load packages." });
    }
  }

  retryBtn.addEventListener("click", loadPackages);

  loadPackages();
})();
