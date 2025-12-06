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

  // تطبيع اسم المنطقة
  function normalizeRegionValue(value) {
    const v = String(value || "").toLowerCase().trim();

    if (v === "sa" || v.includes("saudi") || v.includes("ksa")) return "sa";
    if (v === "eg" || v.includes("egypt") || v.includes("masr")) return "eg";
    if (v === "cn" || v.includes("china")) return "cn";
    if (v.includes("global") || v.includes("world") || v.includes("intl"))
      return "global";

    return v;
  }

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


      // تشغيل أولي
      applyFiltersAndRender();
    } catch (err) {
      console.error("[UDSAL Deep Search] Failed to load JSON:", err);
      showError(
        "تعذّر تحميل بيانات UDSAL حالياً. تأكّد من المسار، أو جرّب التحديث لاحقاً."
      );
    }
  }
}  // ← إغلاق bindEvents

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

    // فلاتر التصنيف (فلتر واحد فقط)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        if (chip.classList.contains("is-on")) {
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

    // أزرار إغلاق المودال
    if (els.modal && els.modalCloseBtn) {
      els.modalCloseBtn.addEventListener("click", closeModal);

      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) closeModal();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }

    // تفويض الكليك على أزرار Open داخل الكروت
    els.resultsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-service]");
      if (!btn) return;

      const id = btn.getAttribute("data-open-service");
      if (!id) return;

      const svc = state.allServices.find((s) => s.id === id);
      if (!svc) return;

      openServiceModal(svc);
    });

    // زر نسخ الرابط داخل المودال
if (els.modalCopyBtn) {
  els.modalCopyBtn.addEventListener("click", async () => {
    const url = els.modalOpenLink ? els.modalOpenLink.href : "";
    if (!url || url === "#") {
      showToast("لا يوجد رابط لنسخه حالياً");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("تم نسخ رابط الخدمة بنجاح ✅");
    } catch (err) {
      console.warn("[UDSAL] Clipboard error:", err);
      showToast("تعذّر نسخ الرابط، جرّب النسخ اليدوي.");
    }
  });
}
/ زر نسخ الرابط داخل المودال
    if (els.modalCopyBtn) {
      els.modalCopyBtn.addEventListener("click", async () => {
        const url = els.modalOpenLink ? els.modalOpenLink.href : "";
        if (!url || url === "#") {
          showToast("لا يوجد رابط لنسخه حالياً");
          return;
        }

        


  // =========================
  // 3) تطبيق الفلاتر
  // =========================
  function applyFiltersAndRender() {
    const activeRegion = normalizeRegionValue(state.activeRegion || "all");

    const filtered = state.allServices.filter((svc) => {
      // فلتر الدولة
      if (activeRegion !== "all") {
        const r = normalizeRegionValue(svc.region);
        if (r !== activeRegion) return false;
      }


      // فلتر التصنيف
      if (state.activeFilters.size > 0) {
        const [fkey] = Array.from(state.activeFilters);
        const mapped = (FILTER_MAP[fkey] || "").toLowerCase();
        const cat = String(svc.category || "").toLowerCase();

        if (!cat.includes(mapped)) return false;
      }

      // البحث النصي
      const q = state.query.toLowerCase();
      if (q) {
        const hay = [
          svc.name,
          svc.subtitle,
          svc.description,
          svc.region_label,
          (svc.tags || []).join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });

    state.filtered = filtered;
    renderResults();
  }

 // =========================
  // 4) عرض النتائج
  // =========================
  function renderResults() {
    const list = state.filtered;

    if (list.length === 0) {
      els.resultsList.innerHTML = "";
      els.emptyState.style.display = "block";
      els.emptyState.textContent =
        state.query ||
        state.activeRegion !== "all" ||
        state.activeFilters.size
          ? "لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى، أو غيّر الدولة أو الفلاتر."
          : "لم يتم إضافة خدمات في هذه المنطقة بعد.";
    } else {
      els.emptyState.style.display = "none";

      els.resultsList.innerHTML = list
        .map((svc) => {
          const tags =
            svc.tags?.map((t) => `<span class="tag-pill">${t}</span>`).join("") ||
            "";

          const hasUrl = !!svc.url;
          const ctaText = svc.cta || (hasUrl ? "Open in browser" : "قريباً");

          return `
          <article class="service-card">
            <header class="service-card-header">
              <div class="service-region">
                <span class="region-pill">${svc.region_label || "Service"}</span>
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

              ${
                hasUrl
                  ? `<button class="btn-primary"
                        type="button"
                        data-open-service="${svc.id}">
                        ${ctaText}
                     </button>`
                  : `<button class="btn-secondary" type="button" disabled>
                        ${ctaText}
                     </button>`
              }
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

  // =========================
  // 5) المودال
  // =========================
  function openServiceModal(svc) {
    if (!els.modal) {
      if (svc.url) window.open(svc.url, "_blank", "noopener");
      return;
    }

    if (els.modalTitle) els.modalTitle.textContent = svc.name || "";
    if (els.modalSubtitle)
      els.modalSubtitle.textContent = svc.subtitle || "";
    if (els.modalRegion)
      els.modalRegion.textContent = svc.region_label || "";

    if (els.modalRegionBadge) {
      els.modalRegionBadge.textContent =
        svc.regionBadge || svc.region_label || "";
    }

    if (els.modalCategory) {
      const catLabel =
        CATEGORY_LABELS[svc.category] || svc.category || "";
      els.modalCategory.textContent = catLabel;
    }

    if (els.modalDesc) els.modalDesc.textContent = svc.description || "";

    if (els.modalOpenLink) {
      if (svc.url) {
        els.modalOpenLink.href = svc.url;
        els.modalOpenLink.textContent =
          svc.cta || "Open in browser";
        els.modalOpenLink.classList.remove("is-disabled");
      } else {
        els.modalOpenLink.href = "#";
        els.modalOpenLink.textContent = "لا يوجد رابط متاح";
        els.modalOpenLink.classList.add("is-disabled");
      }
    }

    // QR code (اختياري)
    if (els.modalQr) {
      if (svc.url) {
        const encoded = encodeURIComponent(svc.url);
        els.modalQr.src =
          "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" +
          encoded;
        els.modalQr.alt = "QR · " + (svc.name || "");
        els.modalQr.classList.remove("is-hidden");
      } else {
        els.modalQr.classList.add("is-hidden");
      }
    }

    els.modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-modal-open");
  }

  function closeModal() {
    if (!els.modal) return;
    els.modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-modal-open");
  }

  // =========================
  // 6) أدوات مساعدة
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

  function showToast(message) {
    // لو ما فيه توست في الصفحة نستخدم alert كخطة B
    if (!els.toast) {
      alert(message);
      return;
    }

    els.toast.textContent = message;
    els.toast.classList.add("is-visible");

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.remove("is-visible");
    }, 2500);
  }

  // 🚀 تشغيل
  bindEvents();
  loadServices();
})();
