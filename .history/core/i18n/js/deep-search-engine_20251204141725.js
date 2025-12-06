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
    unified: "unified",   // منصات موحدة
    justice: "justice",   // خدمات العدل / القضاء
    identity: "identity", // هوية رقمية
    travel: "travel",     // سفر / حدود / تأشيرات
    tax: "tax",           // ضرائب / مالية / زكاة
    health: "health"      // صحة
  };

  // 🎯 عناصر الواجهة
  const els = {
    searchInput: document.querySelector(".search-panel input[type='search']"),
    resultsList: document.querySelector("#search-results"),
    countLabel: document.querySelector(".search-meta strong"),
    regionChips: document.querySelectorAll(".region-tab"),
    filterChips: document.querySelectorAll(".filter-chip"),

    // عناصر المودال
    modal: document.querySelector("[data-service-modal]"),
    modalTitle: document.querySelector("[data-modal-title]"),
    modalSubtitle: document.querySelector("[data-modal-subtitle]"),
    modalRegion: document.querySelector("[data-modal-region]"),
    modalDesc: document.querySelector("[data-modal-desc]"),
    modalOpenLink: document.querySelector("[data-modal-open-link]"),
    modalCloseBtn: document.querySelector("[data-modal-close]"),

    modalCopyBtn: document.querySelector("[data-modal-copy]"),
    modalQrImg: document.querySelector("[data-modal-qr]"),
    modalQrWrap: document.querySelector("[data-modal-qr-wrap]"),

    modalRegionBadge: document.querySelector("[data-modal-region-badge]"),
modalCategory: document.querySelector("[data-modal-category]"),
modalCopyBtn: document.querySelector("[data-modal-copy-link]"),

toast: document.querySelector("[data-udsal-toast]"),
toastText: document.querySelector("[data-udsal-toast-text]"),

    emptyState: null,
  };

  if (!els.searchInput || !els.resultsList) {
    console.warn("[UDSAL Deep Search] UI elements not found, aborting.");
    return;
  }

  // إنشاء عنصر حالة "لا توجد نتائج"
(function prepareEmptyState() {
  let el = document.querySelector("[data-empty-state]");
  
  // لو ما فيه عنصر جاهز، ننشئ واحد جديد
  if (!el) {
    el = document.createElement("p");
    el.className = "empty-state";
    el.style.display = "none"; // نخفيه افتراضياً
    el.setAttribute("data-empty-state", "true");

    // نضيف العنصر فوق قائمة النتائج مباشرة
    els.resultsList.insertAdjacentElement("beforebegin", el);
  }

  // نخزن العنصر داخل els لاستخدامه لاحقاً
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

    // فلاتر التصنيف (نظام حصري: فلتر واحد فقط)
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.getAttribute("data-filter");
        if (!key) return;

        if (chip.classList.contains("is-on")) {
          // لو هو نفسه مفعّل → نطفي كل الفلاتر
          chip.classList.remove("is-on");
          state.activeFilters.clear();
        } else {
          // نطفي كل الفلاتر ونشغل واحد
          els.filterChips.forEach((c) => c.classList.remove("is-on"));
          state.activeFilters.clear();

          chip.classList.add("is-on");
          state.activeFilters.add(key);
          
        }

        applyFiltersAndRender();
      });
    });
 // زر إغلاق المودال
    if (els.modal && els.modalCloseBtn) {
      els.modalCloseBtn.addEventListener("click", closeModal);
      els.modal.addEventListener("click", (e) => {
        if (e.target === els.modal) closeModal();
      });

       // زر نسخ الرابط داخل المودال
    if (els.modalCopyBtn && els.modalOpenLink) {
      els.modalCopyBtn.addEventListener("click", async () => {
        const href = els.modalOpenLink.getAttribute("href");
        if (!href || href === "#") return;

        try {
          await navigator.clipboard.writeText(href);
          const oldText = els.modalCopyBtn.textContent;
          els.modalCopyBtn.textContent = "تم النسخ ✓";
          setTimeout(() => {
            els.modalCopyBtn.textContent = oldText || "نسخ الرابط";
          }, 1600);
        } catch (e) {
          console.warn("Clipboard failed:", e);
          els.modalCopyBtn.textContent = "تعذّر النسخ";
          setTimeout(() => {
            els.modalCopyBtn.textContent = "نسخ الرابط";
          }, 1600);
        }
      });
    }


      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeModal();
      });
    }

    // تفويض حدث الضغط على أزرار Open داخل الكروت
    els.resultsList.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-open-service]");
      if (!btn) return;

      const id = btn.getAttribute("data-open-service");
      if (!id) return;

      const svc = state.allServices.find((s) => s.id === id);
      if (!svc) return;

      openServiceModal(svc);
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
const CATEGORY_LABELS = {
  unified: "منصة موحّدة",
  justice: "عدل / قضاء",
  identity: "هوية رقمية",
  travel: "سفر / حدود",
  tax: "ضرائب / مالية",
  health: "صحة",
  concept: "Concept",
  demo: "تجريبي"
};

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

          const hasUrl = !!svc.url;
          const ctaText = svc.cta || (hasUrl ? "Open in browser" : "قريباً");

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
                hasUrl
                  ? `<button type="button"
                            class="btn-primary"
                            data-open-service="${escapeHtml(svc.id)}">
                        ${escapeHtml(ctaText)}
                      </button>`
                  : `<button type="button"
                            class="btn-secondary"
                            disabled>
                        ${escapeHtml(ctaText)}
                      </button>`
              }
            </footer>
          </article>
        `;
        })
        .join("");

      els.resultsList.innerHTML = cardsHtml;
    }
      const cards = els.resultsList.querySelectorAll(".service-card");
      cards.forEach((card, index) => {
        card.classList.remove("is-visible");
        // تأخير بسيط لكل كرت (Stagger)
        setTimeout(() => {
          card.classList.add("is-visible");
        }, 35 * index);
      });

    // عداد النتائج في "matches: xx"
    if (els.countLabel) {
      els.countLabel.textContent = `${filtered.length} / ${allServices.length}`;
    }
  }

  // =========================
  // 5) المودال
  // =========================
  function openServiceModal(svc) {
    if (!els.modal) {
      // لو المودال غير موجود نفتح الرابط مباشرة
      if (svc.url) window.open(svc.url, "_blank", "noopener");
      return;
    }
if (els.modalTitle) els.modalTitle.textContent = svc.name || "";
if (els.modalSubtitle) els.modalSubtitle.textContent = svc.subtitle || "";
if (els.modalRegion)
  els.modalRegion.textContent = svc.region_label || "";

if (els.modalRegionBadge) {
  els.modalRegionBadge.textContent = svc.regionBadge || "";
}

if (els.modalCategory) {
  const label =
    CATEGORY_LABELS[svc.category] || svc.category || "Service";
  els.modalCategory.textContent = label;
}

    if (els.modalTitle) els.modalTitle.textContent = svc.name || "";
    if (els.modalSubtitle) els.modalSubtitle.textContent = svc.subtitle || "";
    if (els.modalRegion)
      els.modalRegion.textContent = svc.region_label || "";
    if (els.modalDesc) els.modalDesc.textContent = svc.description || "";

        // إعداد رابط فتح الخدمة
    let serviceUrl = svc.url || "";
    if (els.modalOpenLink) {
      if (serviceUrl) {
        els.modalOpenLink.href = serviceUrl;
        els.modalOpenLink.textContent = svc.cta || "Open in browser";
        els.modalOpenLink.classList.remove("is-disabled");
      } else {
        els.modalOpenLink.href = "#";
        els.modalOpenLink.textContent = "لا يوجد رابط متاح";
        els.modalOpenLink.classList.add("is-disabled");
      }
    }

    // تفعيل/تعطيل زر نسخ الرابط
    if (els.modalCopyBtn) {
      if (serviceUrl) {
        els.modalCopyBtn.disabled = false;
        els.modalCopyBtn.classList.remove("is-disabled");
        els.modalCopyBtn.textContent = "نسخ الرابط";
      } else {
        els.modalCopyBtn.disabled = true;
        els.modalCopyBtn.classList.add("is-disabled");
        els.modalCopyBtn.textContent = "لا يوجد رابط";
      }
    }

    // توليد صورة QR من خدمة خارجية
    if (els.modalQrImg && els.modalQrWrap) {
      if (serviceUrl) {
        const qrSrc =
          "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
          encodeURIComponent(serviceUrl);

        els.modalQrImg.src = qrSrc;
        els.modalQrWrap.style.display = "flex";
      } else {
        els.modalQrImg.src = "";
        els.modalQrWrap.style.display = "none";
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
  if (!els.toast || !els.toastText) return;

  els.toastText.textContent = message;
  els.toast.classList.add("is-visible");
  els.toast.setAttribute("aria-hidden", "false");

  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }

  state.toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
    els.toast.setAttribute("aria-hidden", "true");
  }, 2200);
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
