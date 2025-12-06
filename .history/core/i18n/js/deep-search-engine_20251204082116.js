// core/i18n/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search

(function () {
  // 📂 مسار ملف JSON (من داخل docs/app-ui/app-deep-search.html)
  const SERVICES_JSON_URL = "../core/i18n/data/services-data.json";

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

  // 🎯 عناصر الواجهة
  const els = {
    searchInput: document.querySelector(
      ".search-panel input[type='search']"
    ),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector(".search-meta strong"),
    regionChips: document.querySelectorAll(".region-tab"),
    filterChips: document.querySelectorAll(".filter-chip"),
    emptyState: null,
  };

  if (!els.searchInput || !els.resultsList) {
    console.warn("[UDSAL Deep Search] UI elements not found, aborting.");
    return;
  }

  // نجهز عنصر حالة "لا توجد نتائج"
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

  // ===============================
  // إعداد المودال (إن وُجد في الصفحة)
  // ===============================
  const modal = {
    root: document.querySelector("[data-service-modal]"),
  };

  if (modal.root) {
    modal.dialog = modal.root.querySelector(".service-modal-dialog");
    modal.title = modal.root.querySelector("[data-modal-title]");
    modal.subtitle = modal.root.querySelector("[data-modal-subtitle]");
    modal.desc = modal.root.querySelector("[data-modal-desc]");
    modal.region = modal.root.querySelector("[data-modal-region]");
    modal.openLink = modal.root.querySelector("[data-modal-open-link]");
    modal.closeBtns = modal.root.querySelectorAll("[data-modal-close]");

    modal.close = function () {
      modal.root.classList.remove("is-open");
      modal.root.setAttribute("aria-hidden", "true");
    };

    if (modal.closeBtns && modal.closeBtns.length) {
      modal.closeBtns.forEach((btn) => {
        btn.addEventListener("click", modal.close);
      });
    }

    // إغلاق عند الضغط خارج الصندوق
    modal.root.addEventListener("click", (e) => {
      if (e.target === modal.root) {
        modal.close();
      }
    });

    // إغلاق بـ Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        modal.close();
      }
    });
  }

  // ===============================
  // Ripple للفلاتر
  // ===============================
  els.filterChips.forEach((chip) => {
    chip.addEventListener("pointerdown", (e) => {
      const rect = chip.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const oldRipple = chip.querySelector(".ripple");
      if (oldRipple) oldRipple.remove();

      const ripple = document.createElement("span");
      ripple.classList.add("ripple");
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      chip.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });

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

      applyFiltersAndRender();
    } catch (err) {
      console.error("[UDSAL Deep Search] Failed to load JSON:", err);
      showError(
        "تعذّر تحميل بيانات UDSAL حالياً. تأكّد من المسار أو جرّب التحديث لاحقاً."
      );
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

    // فلاتر التصنيف — نظام حصري (فلتر واحد فقط)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        const isOn = chip.classList.contains("is-on");

        // نطفي الكل
        els.filterChips.forEach((c) => c.classList.remove("is-on"));
        state.activeFilters.clear();

        // لو كان مطفي → نشغله
        if (!isOn) {
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
    const list = state.allServices.filter((svc) => {
      // المنطقة
      if (state.activeRegion !== "all" && svc.region !== state.activeRegion) {
        return false;
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
          state.query ||
          state.activeRegion !== "all" ||
          state.activeFilters.size
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
                  .map(
                    (t) => `<span class="tag-pill">${escapeHtml(t)}</span>`
                  )
                  .join("")
              : "";

          const ctaLabel = svc.cta || "Open in browser";

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
                  ? `<button
                      type="button"
                      class="btn-primary service-open-modal"
                      data-url="${encodeURI(svc.url)}"
                      data-name="${escapeHtml(svc.name)}"
                      data-subtitle="${escapeHtml(svc.subtitle || "")}"
                      data-desc="${escapeHtml(svc.description || "")}"
                      data-region="${escapeHtml(svc.region_label || "")}"
                      data-cta="${escapeHtml(ctaLabel)}"
                    >
                      ${escapeHtml(ctaLabel)}
                    </button>`
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

      // ربط أزرار المودال بعد ما نرسم الكروت
      attachModalButtons();
    }

    // عداد النتائج في matches: xx
    if (els.countLabel) {
      els.countLabel.textContent = `${filtered.length} / ${allServices.length}`;
    }
  }

  // ربط أزرار الكروت بالمودال
  function attachModalButtons() {
    if (!modal.root) return;

    const buttons = document.querySelectorAll(".service-open-modal");
    if (!buttons.length) return;

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!modal.dialog) return;

        const name = btn.getAttribute("data-name") || "";
        const subtitle = btn.getAttribute("data-subtitle") || "";
        const desc = btn.getAttribute("data-desc") || "";
        const region = btn.getAttribute("data-region") || "";
        const url = btn.getAttribute("data-url") || "#";
        const cta = btn.getAttribute("data-cta") || "Open in browser";

        if (modal.title) modal.title.textContent = name;
        if (modal.subtitle) modal.subtitle.textContent = subtitle;
        if (modal.desc) modal.desc.textContent = desc;
        if (modal.region) modal.region.textContent = region || "Service";
        if (modal.openLink) {
          modal.openLink.href = url;
          modal.openLink.textContent = cta;
        }

        modal.root.classList.add("is-open");
        modal.root.setAttribute("aria-hidden", "false");
      });
    });
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
