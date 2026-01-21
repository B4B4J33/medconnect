document.addEventListener("DOMContentLoaded", () => {
  console.log("MedConnect frontend loaded");

  fetch(`${window.API_BASE_URL}/api/health`)
    .then((r) => r.json())
    .then((d) => console.log("Backend OK:", d))
    .catch((e) => console.error("Backend not reachable:", e));
});
