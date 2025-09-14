document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("doctorSearch");
  const specialtyFilter = document.getElementById("specialtyFilter");
  const doctorCards = document.querySelectorAll(".doctor-card");

  function filterDoctors() {
    const searchText = searchInput.value.toLowerCase();
    const specialty = specialtyFilter.value;

    doctorCards.forEach(card => {
      const name = card.querySelector("h3").textContent.toLowerCase();
      const cardSpecialty = card.dataset.specialty;

      const matchesSearch = name.includes(searchText);
      const matchesSpecialty = !specialty || cardSpecialty === specialty;

      if (matchesSearch && matchesSpecialty) {
        card.style.display = "";
      } else {
        card.style.display = "none";
      }
    });
  }

  searchInput.addEventListener("input", filterDoctors);
  specialtyFilter.addEventListener("change", filterDoctors);
});
