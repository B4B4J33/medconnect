document.addEventListener("DOMContentLoaded", () => {
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("sideMenuOverlay");
  const openBtn = document.querySelector(".hamburger");
  const closeBtn = document.getElementById("closeMenu");
  const firstLink = sideMenu.querySelector("ul li a");

  function trapFocus(e) {
    const focusable = sideMenu.querySelectorAll('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstEl = focusable[0];
    const lastEl = focusable[focusable.length - 1];

    if (e.key === "Tab") {
      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        // Tab forward
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  }

  function openMenu() {
    sideMenu.classList.add("active");
    overlay.classList.add("active");
    sideMenu.setAttribute("aria-hidden", "false");
    overlay.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Focus on first link
    if (firstLink) firstLink.focus();

    // Enable focus trap
    document.addEventListener("keydown", trapFocus);
  }

  function closeMenu() {
    sideMenu.classList.remove("active");
    overlay.classList.remove("active");
    sideMenu.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    // Return focus to hamburger
    if (openBtn) openBtn.focus();

    // Disable focus trap
    document.removeEventListener("keydown", trapFocus);
  }

  if (openBtn && sideMenu && closeBtn && overlay) {
    openBtn.addEventListener("click", openMenu);
    closeBtn.addEventListener("click", closeMenu);
    overlay.addEventListener("click", closeMenu);

    // ESC key closes menu
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && sideMenu.classList.contains("active")) {
        closeMenu();
      }
    });
  }
});
