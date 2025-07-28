document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const gallery = document.getElementById("gallery");
  const deleteBox = document.getElementById("delete-box");
  let idCounter = 0;

  // --- State Management ---
  let savedTags = JSON.parse(localStorage.getItem("imageTags")) || {};

  // Remove tags for images not present in this slot
  // Use only filename as the key, not slot-filename
  const presentIds = Array.from(
    document.querySelectorAll(".image-container")
  ).map((container) => container.dataset.id);
  let changed = false;
  for (const id in savedTags) {
    if (!presentIds.includes(id)) {
      delete savedTags[id];
      changed = true;
    }
  }
  if (changed) {
    localStorage.setItem("imageTags", JSON.stringify(savedTags));
  }

  // Initialize existing images
  document.querySelectorAll(".image-container").forEach((container) => {
    setupContainer(container);
  });

  // File handling
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => handleFiles(e.target.files));

  // Drag & drop handlers
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () =>
    dropZone.classList.remove("dragover")
  );

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  // Get slot from URL, fallback to 1
  function getSlotFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return parseInt(params.get("slot") || "1", 10);
  }

  let currentSlot = getSlotFromUrl();
  localStorage.setItem("currentSlot", currentSlot);

  // Function to switch slot and clear/load state
  function switchToSlot(slot) {
    currentSlot = slot;
    localStorage.setItem("currentSlot", slot);

    // Clear image state and gallery DOM
    localStorage.setItem("imageTags", "{}");
    const gallery = document.getElementById("gallery");
    if (gallery) {
      gallery.innerHTML = "";
    }

    // Try to load outfit state for this slot
    fetch(`/load_outfit/${slot}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          localStorage.setItem("imageTags", data.state);
        } else {
          localStorage.setItem("imageTags", "{}");
        }
        // Reload with slot in URL so backend loads correct images
        window.location.href = `/home?slot=${slot}`;
      });
  }

  // Optionally, expose switchToSlot globally for use from saved.js
  window.switchToSlot = switchToSlot;

  document.getElementById("save-outfit-btn").addEventListener("click", () => {
    // Before saving, filter out any keys in imageTags that do not correspond to files in the current slot
    const presentFiles = Array.from(
      document.querySelectorAll(".image-container")
    ).map((container) => container.dataset.id); // Use filename as id

    let imageTags = JSON.parse(localStorage.getItem("imageTags")) || {};
    for (const key in imageTags) {
      if (!presentFiles.includes(key)) {
        delete imageTags[key];
      }
    }
    localStorage.setItem("imageTags", JSON.stringify(imageTags));

    const state = localStorage.getItem("imageTags");
    html2canvas(document.body).then((canvas) => {
      const snapshot = canvas.toDataURL("image/png");
      fetch("/save_outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: currentSlot, state, snapshot }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            alert("Outfit saved!");
          } else {
            alert("Save failed: " + data.error);
          }
        });
    });
  });

  function handleFiles(files) {
    // Only upload one file per request for backend compatibility
    Array.from(files).forEach((file) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slot", currentSlot); // Add slot info

      fetch("/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => {
          if (response.ok) {
            location.reload();
          } else {
            response.json().then((data) => {
              alert(data.error || "Upload failed.");
            });
          }
        })
        .catch(console.error);
    });
  }

  // --- Container Management ---
  function createImageContainer(src) {
    const container = document.createElement("div");
    container.className = "image-container";

    const img = document.createElement("img");
    img.className = "draggable";
    img.src = src;
    img.style.objectFit = "contain";

    const resizeHandle = document.createElement("div");
    resizeHandle.className = "resize-handle";

    // Use only filename as data-id
    const url = new URL(src, window.location.origin);
    const filename = url.pathname.split("/").pop();
    container.dataset.id = filename;

    container.append(img, resizeHandle);
    gallery.appendChild(container);
    return container;
  }

  function setupContainer(container) {
    // --- Position & Size Initialization ---
    let savedData = savedTags[container.dataset.id];
    if (savedData?.markedForDeletion) {
      container.classList.add("marked-for-deletion");
      container.style.display = "none"; // Keep it hidden until restored
      return;
    }
    container.style.position = "absolute";

    // Set default size
    container.style.width = savedData?.size?.width || "150px";
    container.style.height = savedData?.size?.height || "150px";

    // Apply saved position or random position
    if (savedData?.position) {
      container.style.left = savedData.position.left;
      container.style.top = savedData.position.top;
    } else {
      container.style.left =
        Math.random() * (window.innerWidth - 200) + 20 + "px";
      container.style.top =
        Math.random() * (window.innerHeight - 200) + 20 + "px";
      saveContainerState(container);
      savedData = savedTags[container.dataset.id];
    }

    // --- Element References ---
    const resizeHandle = container.querySelector(".resize-handle");

    // --- Event Handlers ---
    let isDragging = false;
    let isResizing = false;
    let offsetX, offsetY, startX, startY, startWidth, startHeight;

    // Right-click handler for tags
    container.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      openTagForm(e, container);
    });

    // Mouse down handler
    container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return; // Only left click
      e.preventDefault();

      const rect = container.getBoundingClientRect();
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;

      if (e.target === resizeHandle) {
        // Resize handling
        isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = rect.width;
        startHeight = rect.height;
        document.addEventListener("mousemove", handleResize);
        document.addEventListener("mouseup", stopResize);
      } else {
        // Drag handling
        isDragging = true;
        container.style.cursor = "grabbing";
        container.style.zIndex = "1000";
        document.addEventListener("mousemove", handleDrag);
        document.addEventListener("mouseup", stopDrag);
      }
    });

    function handleDrag(e) {
      if (!isDragging) return;
      container.style.left = e.clientX - offsetX + "px";
      container.style.top = e.clientY - offsetY + "px";
    }

    function stopDrag() {
      isDragging = false;
      container.style.cursor = "grab";
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", stopDrag);
      saveContainerState(container);
      checkDeleteBox(container);
    }

    function handleResize(e) {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      container.style.width = Math.max(startWidth + dx, 50) + "px";
      container.style.height = Math.max(startHeight + dy, 50) + "px";
    }

    function stopResize() {
      isResizing = false;
      document.removeEventListener("mousemove", handleResize);
      document.removeEventListener("mouseup", stopResize);
      saveContainerState(container);
    }

    function saveContainerState(cont) {
      savedTags[cont.dataset.id] = {
        position: {
          left: cont.style.left,
          top: cont.style.top,
        },
        size: {
          width: cont.style.width,
          height: cont.style.height,
        },
        ...(savedTags[cont.dataset.id]?.tags
          ? { tags: savedTags[cont.dataset.id].tags }
          : {}),
        markedForDeletion: cont.classList.contains("marked-for-deletion"),
      };
      localStorage.setItem("imageTags", JSON.stringify(savedTags));
    }

    function checkDeleteBox(cont) {
      const contRect = cont.getBoundingClientRect();
      const delRect = deleteBox.getBoundingClientRect();

      if (
        contRect.left < delRect.right &&
        contRect.right > delRect.left &&
        contRect.top < delRect.bottom &&
        contRect.bottom > delRect.top
      ) {
        // Mark instead of delete
        cont.classList.add("marked-for-deletion");
        cont.style.display = "none"; // Hide from UI
        saveContainerState(cont);
      }
    }
  }

  // --- Tagging System ---
  const tagForm = document.createElement("div");
  tagForm.className = "image-form";
  tagForm.innerHTML = `
    <button class="close-button">×</button>
    <label>Price: <input type="text" class="price-input"></label>
    <label>Name: <input type="text" class="name-input"></label>
    <label>Link: <input type="text" class="link-input"></label>
    <button class="save-tags-btn">Save</button>
    <button class="remove-bg-btn">Remove Background</button>
  `;
  document.body.appendChild(tagForm);

  function openTagForm(e, container) {
    const containerId = container.dataset.id;
    const tags = savedTags[containerId]?.tags || {};
    currentTagContainer = container;

    // Position form at click location
    tagForm.style.display = "block";
    tagForm.style.left = `${e.clientX}px`;
    tagForm.style.top = `${e.clientY}px`;
    tagForm.style.position = "fixed";

    // Populate form fields
    tagForm.querySelector(".price-input").value = tags.price || "";
    tagForm.querySelector(".name-input").value = tags.name || "";
    tagForm.querySelector(".link-input").value = tags.link || "";

    // Close handler
    tagForm.querySelector(".close-button").onclick = () => {
      tagForm.style.display = "none";
    };

    // Save handler
    document.getElementById("save-outfit-btn").addEventListener("click", () => {
      const tagsToDelete = [];

      // Remove deleted containers before saving
      document
        .querySelectorAll(".image-container.marked-for-deletion")
        .forEach((cont) => {
          const id = cont.dataset.id;
          const img = cont.querySelector("img");
          if (!img) return;

          const url = new URL(img.src, window.location.origin);
          const parts = url.pathname.split("/");
          const user_id = parts[2];
          const filename = parts[3];

          tagsToDelete.push({ id, filename, user_id });

          // Remove from UI
          cont.remove();
          delete savedTags[id];
        });

      localStorage.setItem("imageTags", JSON.stringify(savedTags)); // Save updated state

      // Call server to delete images
      tagsToDelete.forEach(({ filename, user_id }) => {
        fetch("/delete_image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, user_id, slot: currentSlot }), // <-- add slot
        }).catch(console.error);
      });

      // Save full outfit
      // Before saving, filter out any keys in imageTags that do not correspond to files in the current slot
      const presentFiles = Array.from(
        document.querySelectorAll(".image-container")
      ).map((container) => container.dataset.id);

      let imageTags = JSON.parse(localStorage.getItem("imageTags")) || {};
      for (const key in imageTags) {
        if (!presentFiles.includes(key)) {
          delete imageTags[key];
        }
      }
      localStorage.setItem("imageTags", JSON.stringify(imageTags));

      const state = localStorage.getItem("imageTags");
      html2canvas(document.body).then((canvas) => {
        const snapshot = canvas.toDataURL("image/png");
        fetch("/save_outfit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: currentSlot, state, snapshot }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              alert("Outfit saved!");
            } else {
              alert("Save failed: " + data.error);
            }
          });
      });
    });

    // Remove background handler
    tagForm.querySelector(".remove-bg-btn").onclick = () => {
      const img = currentTagContainer.querySelector("img");
      let filename = null;
      if (img) {
        const url = new URL(img.src, window.location.origin);
        filename = url.pathname.split("/").pop();
      }
      if (filename) {
        fetch("/remove_bg", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename, slot: currentSlot }), // <-- add slot
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              alert("Background removed!");
              // Optionally, reload the image or the whole page
              location.reload();
            } else {
              alert("Error removing background: " + data.error);
            }
          });
      }
    };
  }
});

// Prevent context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());
