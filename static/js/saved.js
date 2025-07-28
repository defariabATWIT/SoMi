let selectedSlot = null;

document.querySelectorAll(".number").forEach((span) => {
  span.addEventListener("click", () => {
    // Remove selection from all
    document
      .querySelectorAll(".number")
      .forEach((s) => s.classList.remove("selected"));
    // Mark this as selected
    span.classList.add("selected");
    selectedSlot = span.dataset.index;
    document.getElementById("load-outfit-btn").disabled = false;
  });
});

document.getElementById("load-outfit-btn").addEventListener("click", () => {
  if (!selectedSlot) return;
  fetch(`/load_outfit/${selectedSlot}`)
    .then((res) => res.json())
    .then((data) => {
      // Always switch slot, even if not found
      localStorage.setItem("currentSlot", selectedSlot);
      if (data.success) {
        // Parse, clean markedForDeletion, then save
        const state = JSON.parse(data.state);
        for (const id in state) {
          if (state[id].markedForDeletion) {
            delete state[id].markedForDeletion;
          }
        }
        localStorage.setItem("imageTags", JSON.stringify(state));
        window.location.href = `/home?slot=${selectedSlot}`;
      } else {
        localStorage.setItem("imageTags", "{}");
        window.location.href = `/home?slot=${selectedSlot}`;
      }
    });
});
