// core/i18n/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search
// يعمل مع HTML (region-tab, filter-chip, search-panel ...)

(function () {
  // 📂 مسار ملف JSON (من صفحة docs/app-ui/app-deep-search.html)
const SERVICES_JSON_URL = "../core/i18n/data/services-data.json";



  // 🧠 حالة البحث
  const state = {
    allServices: [],
    filtered: [],
    query: "",
    activeRegion: "all",      // all | sa | eg | cn | global
    activeFilters: new Set(), // unified / justice / identity / travel / tax / health ...
  };

  // خريطة الفلاتر → category داخل services-data.json
  const FILTER_MAP = {
    unified: "unified",   // منصات موحدة
    justice: "justice",   // خدمات العدل / القضاء
    identity: "identity", // هوية رقمية
    travel: "travel",     // سفر / حدود / تأشيرات
    tax: "tax",           // ضرائب / مالية / زكاة
    health: "health",     // صحة
  };

  // 🎯 عناصر الواجهة
  const els = {
    searchInput: document.querySelector(".search-panel input[type='search']"),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector(".search-meta strong"),
    regionChips: document.querySelectorAll(".region-tab"),
    filterChips: document.querySelectorAll(".filter-chip"),
    emptyState: null,
  };

  // لو الواجهة ناقصة نطلع بهدوء
  if (!els.searchInput || !els.resultsList) {
    console.warn("[UDSAL Deep Search] UI elements not found, aborting.");
    return;
  }

  // ===============================
  // تجهيز عنصر "لا توجد نتائج"
  // ===============================
  (function prepareEmptyState() {
    let el = document.querySelector("[data-empty-state]");
    if (!el) {
      el = document.createElement("p");
      el.className = "empty-state";
      el.style.display = "none";
      el.setAttribute("data-empty-state", "true");
      // نحطه قبل النتائج
      els.resultsList.insertAdjacentElement("beforebegin", el);
    }
    els.emptyState = el;
  })();

  // ===============================
  // Ripple Effect للفلاتر
  // ===============================
  function addRippleEffect(chip, event) {
    const rect = chip.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    // إزالة أي Ripple قديم
    const old = chip.querySelector(".ripple");
    if (old) old.remove();

    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";

    chip.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
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

      // لو فيه تاب مفعّل من HTML
      const activeTab = document.querySelector(".region-tab.is-active");
      if (activeTab) {
        const r = activeTab.getAttribute("data-region");
        if (r) state.activeRegion = r;
      }

      // لو فيه فلتر واحد مفعّل is-on نعتبره البداية (نظام حصري)
      let firstActiveFilter = null;
      els.filterChips.forEach((chip) => {
        if (chip.classList.contains("is-on") && !firstActiveFilter) {
          const key = chip.getAttribute("data-filter");
          if (key) {
            firstActiveFilter = key;
          } else {
            chip.classList.remove("is-on");
          }
        } else if (chip.classList.contains("is-on")) {
          // نطفي أي زيادات
          chip.classList.remove("is-on");
        }
      });
      if (firstActiveFilter) {
        state.activeFilters.add(firstActiveFilter);
      }

      applyFiltersAndRender();
    } catch (err) {
      console.error("[UDSAL Deep Search] Failed to load JSON:", err);
      showError("تعذّر تحميل بيانات UDSAL حالياً. تأكّد من المسار أو جرّب التحديث لاحقاً.");
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

    // فلاتر التصنيف (نظام حصري + Ripple)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", (event) => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        // تأثير الريبّل
        addRippleEffect(chip, event);

        // نظام فلتر واحد فقط (Exclusive)
        if (chip.classList.contains("is-on")) {
          // إطفاء الكل
          chip.classList.remove("is-on");
          state.activeFilters.clear();
        } else {
          els.filterChips.forEach((c) => c.classList.remove("is-on"));
          state.activeFilters.clear();

          chip.classList.add("is-on");
          state.activeFilters.add(key);
        }

        applyFiltersAndRender();
      });
    });
  }

  // =========================
  // 3) تطبيق الفلاتر
  // =========================
 function applyFiltersAndRender() {
  // مؤقتاً تجاهل كل الفلاتر:
  state.filtered = state.allServices.slice();
  renderResults();
}


      // الفلاتر حسب التصنيف
      if (state.activeFilters.size > 0) {
        const neededCategories = Array.from(state.activeFilters).map(
          (key) => FILTER_MAP[key] || key
        );
        if (!neededCategories.includes(svc.category)) {
          return false;
        }
      }

      // البحث النصي
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

    // عداد النتائج "matches: xx / yy"
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

  // 🚀 تشغيل
  bindEvents();
  loadServices();
})();
