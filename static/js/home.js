document.addEventListener("DOMContentLoaded", () => {
  // --- Elements ---
  const dropZone = document.getElementById("drop-zone");
  const fileInput = document.getElementById("file-input");
  const gallery = document.getElementById("gallery");
  const deleteBox = document.getElementById("delete-box");
  let idCounter = 0;

  // --- State Management ---
  const savedTags = JSON.parse(localStorage.getItem("imageTags")) || {};

  // Initialize existing images
  document.querySelectorAll('.draggable').forEach(img => {
    const container = createImageContainer(img.src);
    container.dataset.id = img.dataset.id || `cont_${idCounter++}`;
    
    // Transfer position data
    const imgStyle = window.getComputedStyle(img);
    container.style.left = imgStyle.left;
    container.style.top = imgStyle.top;
    
    // Replace image element
    img.replaceWith(container);
    container.querySelector('img').src = img.src;
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

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(files) {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append("file", file));

    fetch("/upload", {
      method: "POST",
      body: formData
    })
    .then(response => response.json())
    .then(data => {
      data.urls.forEach(url => {
        const container = createImageContainer(url);
        container.dataset.id = `cont_${idCounter++}`;
        setupContainer(container);
      });
    })
    .catch(console.error);
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

    container.append(img, resizeHandle);
    gallery.appendChild(container);
    return container;
  }

  function setupContainer(container) {
    // --- Position & Size Initialization ---
    const savedData = savedTags[container.dataset.id];
    container.style.position = "absolute";
    
    // Set default size
    container.style.width = savedData?.size?.width || "150px";
    container.style.height = savedData?.size?.height || "150px";
  
    // Apply saved position or random position
    if (savedData?.position) {
      container.style.left = savedData.position.left;
      container.style.top = savedData.position.top;
    } else {
      container.style.left = Math.random() * (window.innerWidth - 200) + 20 + "px";
      container.style.top = Math.random() * (window.innerHeight - 200) + 20 + "px";
    }
  
    // --- Element References ---
    const resizeHandle = container.querySelector('.resize-handle');
  
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
          top: cont.style.top 
        },
        size: { 
          width: cont.style.width, 
          height: cont.style.height 
        },
        ...(savedTags[cont.dataset.id]?.tags || {})
      };
      localStorage.setItem('imageTags', JSON.stringify(savedTags));
    }
  
    function checkDeleteBox(cont) {
      const contRect = cont.getBoundingClientRect();
      const delRect = deleteBox.getBoundingClientRect();
      
      if (contRect.left < delRect.right && 
          contRect.right > delRect.left &&
          contRect.top < delRect.bottom && 
          contRect.bottom > delRect.top) {
        cont.remove();
        delete savedTags[cont.dataset.id];
        localStorage.setItem('imageTags', JSON.stringify(savedTags));
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
  `;
  document.body.appendChild(tagForm);

  function openTagForm(e, container) {
    const containerId = container.dataset.id;
    const tags = savedTags[containerId]?.tags || {};
    
    // Position form at click location
    tagForm.style.display = "block";
    tagForm.style.left = `${e.clientX}px`;
    tagForm.style.top = `${e.clientY}px`;
    tagForm.style.position = "fixed";

    // Populate form fields
    tagForm.querySelector('.price-input').value = tags.price || '';
    tagForm.querySelector('.name-input').value = tags.name || '';
    tagForm.querySelector('.link-input').value = tags.link || '';

    // Close handler
    tagForm.querySelector('.close-button').onclick = () => {
      tagForm.style.display = "none";
    };

    // Save handler
    tagForm.querySelector('.save-tags-btn').onclick = () => {
      if (!savedTags[containerId]) savedTags[containerId] = {};
      savedTags[containerId].tags = {
        price: tagForm.querySelector('.price-input').value,
        name: tagForm.querySelector('.name-input').value,
        link: tagForm.querySelector('.link-input').value
      };
      localStorage.setItem('imageTags', JSON.stringify(savedTags));
      tagForm.style.display = "none";
    };
  }
});

// Prevent context menu
document.addEventListener("contextmenu", (e) => e.preventDefault());
