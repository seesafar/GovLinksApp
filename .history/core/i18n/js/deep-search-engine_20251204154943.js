// core/i18n/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search

(function () {
  // 📂 مسار ملف JSON (من صفحة docs/app-ui/app-deep-search.html)
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

  // خريطة الفلاتر → category داخل services-data.json
  const FILTER_MAP = {
    unified: "unified", // منصات موحدة
    justice: "justice", // خدمات العدل / القضاء
    identity: "identity", // هوية رقمية
    travel: "travel", // سفر / حدود / تأشيرات
    tax: "tax", // ضرائب / مالية / زكاة
    health: "health", // صحة
  };

  // اسم لطيف لكل category (للمودال)
  const CATEGORY_LABELS = {
    unified: "منصة موحدة",
    justice: "عدلي / قضائي",
    identity: "هوية رقمية",
    travel: "سفر / حدود",
    tax: "ضرائب / مالية",
    health: "صحة",
  };

  // 🎯 عناصر الواجهة
  const els = {
    // البحث والنتائج
    searchInput: document.querySelector(
      ".search-panel input[type='search']"
    ),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector(".search-meta strong"),
    regionChips: document.querySelectorAll(".region-tab"),
    filterChips: document.querySelectorAll(".filter-chip"),

    // عناصر المودال
    modal: document.querySelector("[data-service-modal]"),
    modalTitle: document.querySelector("[data-modal-title]"),
    modalSubtitle: document.querySelector("[data-modal-subtitle]"),
    modalRegion: document.querySelector("[data-modal-region]"),
    modalRegionBadge: document.querySelector(
      "[data-modal-region-badge]"
    ),
    modalCategory: document.querySelector("[data-modal-category]"),
    modalDesc: document.querySelector("[data-modal-desc]"),
    modalOpenLink: document.querySelector("[data-modal-open-link]"),
    modalCloseBtn: document.querySelector("[data-modal-close]"),
    modalCopyBtn: document.querySelector("[data-modal-copy-link]"),
    modalQr: document.querySelector("[data-modal-qr]"),

    // توست للإشعارات (اختياري)
    toast: document.querySelector("[data-udsal-toast]"),

    // حالة "لا توجد نتائج"
    emptyState: null,
  };

  if (!els.searchInput || !els.resultsList) {
    console.warn("[UDSAL Deep Search] UI elements not found, aborting.");
    return;
  }

  // تجهيز عنصر حالة "لا توجد نتائج"
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

  // =========================
  // 1) تحميل البيانات
  // =========================
  async function loadServices() {
    try {
      const res = await fetch(SERVICES_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      if (!Array.isArray(data)) {
        throw new Error("UDSAL JSON must be an array.");
      }

      state.allServices = data;

      // لو فيه تاب مفعّل في HTML نقرأه كبداية
      const activeTab = document.querySelector(".region-tab.is-active");
      if (activeTab) {
        const r = activeTab.getAttribute("data-region");
        if (r) state.activeRegion = r;
      }

      // لو في فلاتر عليها is-on نعتبرها مفعلة من البداية
      els.filterChips.forEach((chip) => {
        if (chip.classList.contains("is-on")) {
          const key = chip.getAttribute("data-filter");
          if (key) state.activeFilters.add(key);
        }
      });

      // أول رندر بعد التحميل
      applyFiltersAndRender();
    } catch (err) {
      console.error("[UDSAL] Failed to load services:", err);
      showError("تعذّر تحميل قائمة الخدمات العالمية حالياً. حاول مرة أخرى لاحقاً.");
    }
  }

  // =========================
  // 2) ربط الأحداث
  // =========================
  function bindEvents() {
    // البحث النصي
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      applyFiltersAndRender();
    });

    // تابات المناطق
    els.regionChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const region = chip.getAttribute("data-region") || "all";
        state.activeRegion = region;

        els.regionChips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");

        applyFiltersAndRender();
      });
    });

    // فلاتر التصنيف (فلتر واحد فقط في نفس الوقت)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        if (chip.classList.contains("is-on")) {
          // إطفاء الفلتر
