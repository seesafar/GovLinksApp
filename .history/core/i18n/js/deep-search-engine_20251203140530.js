// core/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search
// يقرأ من ملف UDSAL الموحد ويعرض النتائج حسب الدولة + الفلاتر

(function () {
  // 📂 مسار ملف JSON (من صفحة docs/app-ui/app-deep-search.html)
  const SERVICES_JSON_URL = "../../core/i18n/data/services-data.json";

  // 🧠 حالة البحث
  const state = {
    allServices: [],
    filtered: [],
    query: "",
    activeRegion: "all", // all | sa | eg | cn | global
    activeFilters: new Set(), // unified / justice / identity / travel / tax / health ...
  };

  // 🧩 خريطة الفلاتر → category
  const FILTER_MAP = {
    unified: "unified",
    justice: "justice",
    identity: "identity",
    travel: "travel",
    tax: "tax",
    health: "health",
    developer: "developer",
    ai: "ai",
    learning: "learning",
  };

  // 🎯 عناصر الواجهة
  const els = {
    searchInput: document.querySelector("[data-search-input]"),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector("[data-results-count]"),
    regionChips: document.querySelectorAll("[data-region]"),
    filterChips: document.querySelectorAll("[data-filter]"),
    emptyState: document.querySelector("[data-empty-state]"),
  };

  // لو الصفحة ما فيها العناصر (نسخة قديمة) نطلع بهدوء
  if (!els.searchInput || !els.resultsList) {
    console.warn("[UDSAL Deep Search] UI elements not found, aborting.");
    return;
  }

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
      applyFiltersAndRender();
    } catch (err) {
      console.error("[UDSAL Deep Search] Failed to load JSON:", err);
      showError("تعذّر تحميل بيانات UDSAL حالياً. تأكد من المسار أو جرّب التحديث لاحقاً.");
    }
  }

  // =========================
  // 2) التعامل مع الأحداث
  // =========================
  function bindEvents() {
    // بحث نصي
    els.searchInput.addEventListener("input", (e) => {
      state.query = e.target.value.trim();
      applyFiltersAndRender();
    });

    // اختيار المنطقة (السعودية / مصر / الصين / Global / All)
    els.regionChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const region = chip.getAttribute("data-region") || "all";
        state.activeRegion = region;

        // فعّل الستايل
        els.regionChips.forEach((c) => c.classList.remove("pill-active"));
        chip.classList.add("pill-active");

        applyFiltersAndRender();
      });
    });

    // فلاتر التصنيف (منصات موحدة / قضاء / هوية / سفر / ...)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        if (state.activeFilters.has(key)) {
          state.activeFilters.delete(key);
          chip.classList.remove("pill-active");
        } else {
          state.activeFilters.add(key);
          chip.classList.add("pill-active");
        }

        applyFiltersAndRender();
      });
    });
  }

  // =========================
  // 3) تطبيق الفلاتر
  // =========================
  function applyFiltersAndRender() {
    const list = state.allServices.filter((svc) => {
      // 3.1 المنطقة
      if (state.activeRegion !== "all" && svc.region !== state.activeRegion) {
        return false;
      }

      // 3.2 الفلاتر (category)
      if (state.activeFilters.size > 0) {
        const neededCategories = Array.from(state.activeFilters).map(
          (key) => FILTER_MAP[key] || key
        );
        if (!neededCategories.includes(svc.category)) {
          return false;
        }
      }

      // 3.3 البحث النصي
      const q = state.query.toLowerCase();
      if (!q) return true;

      const haystack = [
        svc.name,
        svc.subtitle,
        svc.description,
        svc.region_label,
        (svc.tags || []).join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });

    state.filtered = list;
    renderResults();
  }

  // =========================
  // 4) عرض النتائج
  // =========================
  function renderResults() {
    const { filtered, allServices } = state;

    if (!els.resultsList) return;

    if (!filtered.length) {
      els.resultsList.innerHTML = "";
      if (els.emptyState) {
        els.emptyState.style.display = "block";
        els.emptyState.textContent =
          state.query || state.activeRegion !== "all" || state.activeFilters.size
            ? "لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى، أو غيّر الدولة أو الفلاتر."
            : "لم يتم إضافة خدمات في هذه المنطقة بعد.";
      }
    } else {
      if (els.emptyState) els.emptyState.style.display = "none";

      const cardsHtml = filtered
        .map((svc) => {
          const tags =
            svc.tags && svc.tags.length
              ? svc.tags
                  .slice(0, 6)
                  .map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`)
                  .join("")
              : "";

          return `
          <article class="service-card">
            <header class="service-card-header">
              <div class="service-region">
                <span class="region-pill">${escapeHtml(
                  svc.region_label || "Service"
                )}</span>
                ${
                  svc.regionBadge
                    ? `<span class="region-badge">${escapeHtml(
                        svc.regionBadge
                      )}</span>`
                    : ""
                }
              </div>
              <h3 class="service-title">${escapeHtml(svc.name)}</h3>
              ${
                svc.subtitle
                  ? `<p class="service-subtitle">${escapeHtml(
                      svc.subtitle
                    )}</p>`
                  : ""
              }
            </header>

            <p class="service-desc">
              ${escapeHtml(svc.description || "")}
            </p>

            <footer class="service-footer">
              <div class="tags-wrapper">
                ${tags}
              </div>
              ${
                svc.url
                  ? `<a href="${encodeURI(
                      svc.url
                    )}" class="btn-primary" target="_blank" rel="noopener">
                      ${escapeHtml(svc.cta || "Open")}
                    </a>`
                  : `<button class="btn-secondary" disabled>${
                      svc.cta ? escapeHtml(svc.cta) : "Coming soon"
                    }</button>`
              }
            </footer>
          </article>
        `;
        })
        .join("");

      els.resultsList.innerHTML = cardsHtml;
    }

    if (els.countLabel) {
      els.countLabel.textContent = `${filtered.length} / ${allServices.length}`;
    }
  }

  // =========================
  // 5) أدوات مساعدة
  // =========================
  function showError(msg) {
    if (els.resultsList) {
      els.resultsList.innerHTML = "";
    }
    if (els.emptyState) {
      els.emptyState.style.display = "block";
      els.emptyState.textContent = msg;
    }
    if (els.countLabel) {
      els.countLabel.textContent = "0 / 0";
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 🚀 تشغيل كل شيء
  bindEvents();
  loadServices();
})();
