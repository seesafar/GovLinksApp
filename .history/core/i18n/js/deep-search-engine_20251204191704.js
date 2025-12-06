// core/i18n/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search

(function () {
  // 📂 مسار ملف JSON
  const SERVICES_JSON_URL = location.hostname.includes("github.io")
    ? "/GovLinksApp/core/i18n/data/services-data.json"
    : "../core/i18n/data/services-data.json";

  // 🧠 حالة البحث
  const state = {
    allServices: [],
    filtered: [],
    query: "",
    activeRegion: "all", // all | sa | eg | cn | global
    activeFilters: new Set(), // unified / justice / identity / travel / tax / health ...
  };

  // خريطة الفلاتر إلى category (مطابقة JSON)
  const FILTER_MAP = {
    unified: "unified",
    justice: "justice",
    identity: "identity",
    travel: "travel",
    tax: "tax",
    health: "health",
  };

  const CATEGORY_LABELS = {
    unified: "منصة موحدة",
    justice: "عدلي · قضائي",
    identity: "هوية رقمية",
    travel: "السفر والحدود",
    tax: "ضرائب · مالية",
    health: "الصحة",
  };

  // تطبيع أسماء المناطق
  function normalizeRegionValue(value) {
    const v = String(value || "").toLowerCase().trim();

    if (v === "sa" || v.includes("saudi") || v.includes("ksa")) return "sa";
    if (v === "eg" || v.includes("egypt") || v.includes("masr")) return "eg";
    if (v === "cn" || v.includes("china")) return "cn";
    if (v.includes("global") || v.includes("world") || v.includes("intl"))
      return "global";

    return v;
  }

  // عناصر الواجهة
  const els = {
    searchInput: document.querySelector(".search-panel input[type='search']"),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector(".search-meta strong"),
    regionChips: document.querySelectorAll(".region-tab"),
    filterChips: document.querySelectorAll(".filter-chip"),
    modal: document.querySelector("[data-service-modal]"),
    modalTitle: document.querySelector("[data-modal-title]"),
    modalSubtitle: document.querySelector("[data-modal-subtitle]"),
    modalRegion: document.querySelector("[data-modal-region]"),
    modalRegionBadge: document.querySelector("[data-modal-region-badge]"),
    modalCategory: document.querySelector("[data-modal-category]"),
    modalDesc: document.querySelector("[data-modal-desc]"),
    modalOpenLink: document.querySelector("[data-modal-open-link]"),
    modalCloseBtn: document.querySelector("[data-modal-close]"),
    modalCopyBtn: document.querySelector("[data-modal-copy-link]"),
    modalQr: document.querySelector("[data-modal-qr]"),
    toast: document.querySelector("[data-udsal-toast]"),
    emptyState: null,
  };

  // تجهيز empty-state
  (function prepareEmptyState() {
    let el = document.querySelector("[data-empty-state]");
    if (!el) {
      el = document.createElement("p");
      el.className = "empty-state";
      el.style.display = "none";
      el.setAttribute("data-empty-state", "true");
      els.resultsList.insertAdjacentElement("beforebegin", el);
    }
    els.emptyState = el;
  })();

  // -----------------------
  // تحميل البيانات
  // -----------------------
  async function loadServices() {
    try {
      const res = await fetch(SERVICES_JSON_URL, { cache: "no-store" });
      const data = await res.json();

      if (!Array.isArray(data)) throw new Error("JSON invalid");

      state.allServices = data;

      applyFiltersAndRender();
    } catch (e) {
      console.error("UDSAL load error:", e);
      showError("تعذر تحميل الخدمات الآن.");
    }
  }

  // -----------------------
  // ربط الأحداث
  // -----------------------
  function bindEvents() {
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      applyFiltersAndRender();
    });

    els.regionChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const r = chip.getAttribute("data-region") || "all";
        state.activeRegion = r;

        els.regionChips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");

        applyFiltersAndRender();
      });
    });

    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        if (chip.classList.contains("is-on")) {
          chip.classList.remove("is-on");
          state.activeFilters.clear();
        } else {
          els.filterChips.forEach((c) => c.classList.remove("is-on"));
          chip.classList.add("is-on");
          state.activeFilters.clear();
          state.activeFilters.add(key);
        }

        applyFiltersAndRender();
      });
    });

    els.modalCloseBtn?.addEventListener("click", closeModal);
    els.modal?.addEventListener("click", (e) => {
      if (e.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    els.resultsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-service]");
      if (!btn) return;

      const id = btn.getAttribute("data-open-service");
      const svc = state.allServices.find((s) => s.id === id);

      if (svc) openServiceModal(svc);
    });

    els.modalCopyBtn?.addEventListener("click", async () => {
      const url = els.modalOpenLink?.href;
      if (!url || url === "#") return showToast("لا يوجد رابط لنسخه.");

      try {
        await navigator.clipboard.writeText(url);
        showToast("تم النسخ بنجاح.");
      } catch {
        showToast("تعذر النسخ.");
      }
    });
  }

  

    state.filtered = filtered;
    renderResults();
  }

  // -----------------------
  // عرض النتائج
  // -----------------------
  function renderResults() {
    const list = state.filtered;

    if (list.length === 0) {
      els.resultsList.innerHTML = "";
      els.emptyState.style.display = "block";
      els.emptyState.textContent = "لا توجد نتائج مطابقة حالياً.";
    } else {
      els.emptyState.style.display = "none";

      els.resultsList.innerHTML = list
        .map((svc) => {
          const tags =
            svc.tags?.map((t) => `<span class="tag-pill">${t}</span>`).join("") ||
            "";

          return `
          <article class="service-card">
            <header class="service-card-header">
              <div class="service-region">
                <span class="region-pill">${svc.region_label || ""}</span>
                ${
                  svc.regionBadge
                    ? `<span class="region-badge">${svc.regionBadge}</span>`
                    : ""
                }
              </div>
              <h3 class="service-title">${svc.name}</h3>
              ${
                svc.subtitle
                  ? `<p class="service-subtitle">${svc.subtitle}</p>`
                  : ""
              }
            </header>

            <p class="service-desc">${svc.description || ""}</p>

            <footer class="service-footer">
              <div class="tags-wrapper">${tags}</div>

              <button class="btn-primary"
                data-open-service="${svc.id}">
                ${svc.cta || "Open"}
              </button>
            </footer>
          </article>
          `;
        })
        .join("");
    }

    // عداد النتائج
    if (els.countLabel) {
      els.countLabel.textContent = `${list.length} / ${state.allServices.length}`;
    }
  }

  // -----------------------
  // المودال
  // -----------------------
  function openServiceModal(svc) {
    if (!els.modal) return;

    els.modalTitle.textContent = svc.name || "";
    els.modalSubtitle.textContent = svc.subtitle || "";
    els.modalRegion.textContent = svc.region_label || "";
    els.modalRegionBadge.textContent = svc.regionBadge || "";
    els.modalCategory.textContent =
      CATEGORY_LABELS[svc.category] || svc.category || "";
    els.modalDesc.textContent = svc.description || "";

    if (svc.url) {
      els.modalOpenLink.href = svc.url;
      els.modalOpenLink.classList.remove("is-disabled");
    } else {
      els.modalOpenLink.href = "#";
      els.modalOpenLink.classList.add("is-disabled");
    }

    // QR
    if (svc.url) {
      els.modalQr.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" +
        encodeURIComponent(svc.url);
      els.modalQr.classList.remove("is-hidden");
    } else {
      els.modalQr.classList.add("is-hidden");
    }

    els.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  function closeModal() {
    els.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  // -----------------------
  // أدوات
  // -----------------------
  function showError(msg) {
    els.resultsList.innerHTML = "";
    els.emptyState.style.display = "block";
    els.emptyState.textContent = msg;
  }

  function showToast(msg) {
    if (!els.toast) return alert(msg);

    els.toast.textContent = msg;
    els.toast.classList.add("is-visible");

    setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2000);
  }

  // 🚀 تشغيل
  bindEvents();
  loadServices();
})();
