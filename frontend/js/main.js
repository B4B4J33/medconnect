document.addEventListener("DOMContentLoaded", () => {
  console.log("MedConnect frontend loaded");

  fetch(`${API_BASE_URL}/health`)
  .then(r => r.json())
  .then(d => console.log("Backend OK:", d))
  .catch(e => console.error("Backend not reachable:", e));
  
});