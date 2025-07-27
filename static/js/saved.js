let selectedSlot = null;

document.querySelectorAll('.number').forEach(span => {
  span.addEventListener('click', () => {
    // Remove selection from all
    document.querySelectorAll('.number').forEach(s => s.classList.remove('selected'));
    // Mark this as selected
    span.classList.add('selected');
    selectedSlot = span.dataset.index;
    document.getElementById('save-outfit-btn').disabled = false;
    document.getElementById('load-outfit-btn').disabled = false;
  });
});

document.getElementById('load-outfit-btn').addEventListener('click', () => {
  if (!selectedSlot) return;
  fetch(`/load_outfit/${selectedSlot}`)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('imageTags', data.state);
        alert('Outfit loaded! Reload the home page to see it.');
      } else {
        alert('Load failed: ' + data.error);
      }
    });
});