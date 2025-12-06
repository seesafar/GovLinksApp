// include.js
// =======================
// Universal Header & Footer Loader
// For OneLink (Saudi - Egypt - China - EN)
// =======================

async function includeHTML() {

  const elements = document.querySelectorAll("[data-include]");

  for (const el of elements) {
    const file = el.getAttribute("data-include");

    try {
      const response = await fetch(file);

      if (!response.ok) {
        el.innerHTML = `<div style="color:red">Error loading: ${file}</div>`;
        continue;
      }

      const html = await response.text();
      el.innerHTML = html;
    } catch (err) {
      el.innerHTML = `<div style="color:red">Include failed: ${file}</div>`;
    }
  }
}

// Run on page load
document.addEventListener("DOMContentLoaded", includeHTML);
