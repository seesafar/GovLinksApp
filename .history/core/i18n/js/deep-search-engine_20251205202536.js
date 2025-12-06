// core/i18n/js/deep-search-engine.js
// =====================================
// OneLink UDSAL · Global Deep Search (نسخة جديدة منظمة)

(function () {
  // 🗂 مسار ملف الخدمات
  const SERVICES_JSON_URL = "../core/i18n/data/services-data.json";

  // 🧠 حالة التطبيق
  const state = {
    allServices: [],      // كل الخدمات من JSON
    filtered: [],         // النتائج بعد الفلترة
    query: "",            // نص البحث
    activeRegion: "all",  // all | sa | eg | cn | global
    activeFilters: new Set(), // unified / justice / identity / travel / tax / health
  };

  // خريطة الفلاتر → category داخل JSON
  const FILTER_MAP = {
    unified: "unified",   // منصات موحدة
    justice: "justice",   // العدل / القضاء
    identity: "identity", // هوية رقمية
    travel: "travel",     // سفر / حدود
    tax: "tax",           // ضرائب / مالية
    health: "health",     // صحة
  };

  // 🧩 عناصر الواجهة
  const els = {
    searchInput: null,
    searchResults: null,
    regionTabs: [],
    filterChips: [],
    matchesCounter: null,
    // عناصر المودال
    modalBackdrop: null,
    modalTitle: null,
    modalSubtitle: null,
    modalRegion: null,
    modalRegionBadge: null,
    modalCategory: null,
    modalDesc: null,
    modalOpenLink: null,
    modalCopyBtn: null,
    modalQrWrap: null,
    modalQrImg: null,
    toast: null,
    toastText: null,
  };

  // 🧱 دالة مساعدة: تطبيع شكل الخدمة من JSON
  function normalizeService(raw) {
    // نحاول نتوقع أسماء الحقول قدر الإمكان
    const service = {
      id: raw.id || raw.key || raw.slug || raw.code || "",
      name:
        raw.name_ar ||
        raw.name ||
        raw.title_ar ||
        raw.title ||
        "خدمة بدون اسم",
      subtitle:
        raw.subtitle_ar ||
        raw.subtitle ||
        raw.sub ||
        raw.owner ||
        "",
      desc:
        raw.description_ar ||
        raw.description ||
        raw.desc ||
        "",
      region: (raw.region || raw.country || "global").toLowerCase(),
      category:
        raw.category ||
        raw.type ||
        raw.group ||
        "other",
      url: raw.url || raw.link || raw.href || "#",
      status: (raw.status || "ok").toLowerCase(), // ok | soon | risk
      // لو عندك رابط ثابت لصورة QR في JSON:
      qr: raw.qr || "",
    };

    return service;
  }

  // 🧮 فلترة الخدمات حسب الحالة الحالية
  function applyFilters() {
    const q = state.query.trim().toLowerCase();

    state.filtered = state.allServices.filter((svc) => {
      // فلتر المنطقة
      if (state.activeRegion !== "all" && svc.region !== state.activeRegion) {
        return false;
      }

      // فلتر التصنيف
      if (state.activeFilters.size > 0) {
        let ok = false;
        for (const f of state.activeFilters) {
          const cat = FILTER_MAP[f];
          if (cat && svc.category === cat) {
            ok = true;
            break;
          }
        }
        if (!ok) return false;
      }

      // فلتر نص البحث
      if (!q) return true;

      const haystack = [
        svc.name,
        svc.subtitle,
        svc.desc,
        svc.url,
        svc.region,
        svc.category,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }

  // 🧾 تحديث عدّاد النتائج في الهيدر
  function updateMatchesCounter() {
    if (!els.matchesCounter) return;
    els.matchesCounter.textContent = String(state.filtered.length);
  }

  // 🧱 إنشاء كرت خدمة واحد
  function createServiceCard(service) {
    const card = document.createElement("article");
    card.className = "result-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    // هيدر الكرت
    const header = document.createElement("div");
    header.className = "result-header";

    const titleWrap = document.createElement("div");
    titleWrap.className = "result-title";

    const h3 = document.createElement("h3");
    h3.textContent = service.name;

    const sub = document.createElement("span");
    sub.className = "sub";
    sub.textContent = service.subtitle || service.url;

    titleWrap.appendChild(h3);
    titleWrap.appendChild(sub);

    const pillsWrap = document.createElement("div");
    pillsWrap.className = "result-pills";

    // حبة المنطقة
    const regionPill = document.createElement("span");
    regionPill.className = "pill region";
    regionPill.textContent = regionLabel(service.region);
    pillsWrap.appendChild(regionPill);

    // حبة الحالة
    const statusPill = document.createElement("span");
    statusPill.className = "pill " + statusClass(service.status);
    statusPill.textContent = statusLabel(service.status);
    pillsWrap.appendChild(statusPill);

    header.appendChild(titleWrap);
    header.appendChild(pillsWrap);

    // جسم الكرت
    const body = document.createElement("p");
    body.className = "result-body";
    body.textContent = service.desc || "وصف الخدمة سيظهر هنا من ملف JSON.";

    // ميتا سطر أخير
    const metaRow = document.createElement("div");
    metaRow.className = "result-meta-row";

    const urlSpan = document.createElement("span");
    urlSpan.className = "result-url";
    urlSpan.textContent = service.url;

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "open-btn";
    openBtn.textContent = "فتح";
    openBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      window.open(service.url, "_blank", "noopener");
    });

    metaRow.appendChild(urlSpan);
    metaRow.appendChild(openBtn);

    // تجميع
    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(metaRow);

    // عند الضغط على الكرت → افتح المودال
    card.addEventListener("click", () => {
      openServiceModal(service);
    });

    card.addEventListener("keyup", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        openServiceModal(service);
      }
    });

    return card;
  }

  function regionLabel(region) {
    switch (region) {
      case "sa":
        return "Saudi · 🇸🇦";
      case "eg":
        return "Egypt · 🇪🇬";
      case "cn":
        return "China · 🇨🇳";
      case "global":
        return "Global · 🌍";
      default:
        return region || "Other";
    }
  }

  function statusLabel(status) {
    switch (status) {
      case "ok":
        return "Ready · متاحة";
      case "soon":
        return "Soon · قريباً";
      case "risk":
        return "Deprecated / Risk";
      default:
        return status || "Status";
    }
  }

  function statusClass(status) {
    switch (status) {
      case "ok":
        return "status-ok";
      case "soon":
        return "status-soon";
      case "risk":
        return "status-risk";
      default:
        return "status-ok";
    }
  }

  // 🧱 إعادة رسم النتائج في DOM
  function renderResults() {
    if (!els.searchResults) return;

    els.searchResults.innerHTML = "";

    if (!state.filtered.length) {
      const empty = document.createElement("p");
      empty.className = "result-empty";
      empty.textContent =
        "لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى مثل Absher أو digital.gov.eg.";
      els.searchResults.appendChild(empty);
      updateMatchesCounter();
      return;
    }

    state.filtered.forEach((svc) => {
      const card = createServiceCard(svc);
      els.searchResults.appendChild(card);
    });

    updateMatchesCounter();
  }

  // 🧷 فتح المودال وملء البيانات
  function openServiceModal(service) {
    if (!els.modalBackdrop) return;

    els.modalTitle.textContent = service.name;
    els.modalSubtitle.textContent = service.subtitle || "";
    els.modalRegion.textContent = regionLabel(service.region);
    if (els.modalRegionBadge) {
      els.modalRegionBadge.textContent = regionLabel(service.region);
    }
    if (els.modalCategory) {
      els.modalCategory.textContent = service.category || "Service";
    }
    els.modalDesc.textContent =
      service.desc || "تفاصيل الخدمة سيتم إدراجها من ملف JSON.";

    if (els.modalOpenLink) {
      els.modalOpenLink.href = service.url || "#";
    }

    // QR
    if (els.modalQrWrap) {
      if (service.qr) {
        els.modalQrImg.src = service.qr;
        els.modalQrWrap.style.display = "";
      } else {
        els.modalQrImg.src = "";
        els.modalQrWrap.style.display = "none";
      }
    }

    els.modalBackdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeServiceModal() {
    if (!els.modalBackdrop) return;
    els.modalBackdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  // 📋 نسخ الرابط وإظهار التوست
  function copyServiceLink() {
    if (!els.modalOpenLink || !els.toast) return;
    const url = els.modalOpenLink.href;
    if (!url || url === "#") return;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        showToast("تم نسخ رابط الخدمة بنجاح ✅");
      })
      .catch(() => {
        showToast("تعذّر نسخ الرابط، جرّب يدويًا.");
      });
  }

  function showToast(message) {
    if (!els.toast) return;
    if (els.toastText) {
      els.toastText.textContent = message;
    } else {
      els.toast.textContent = message;
    }
    els.toast.setAttribute("aria-hidden", "false");

    setTimeout(() => {
      els.toast.setAttribute("aria-hidden", "true");
    }, 2500);
  }

  // ⚙️ ربط عناصر الواجهة والأحداث
  function wireUI() {
    els.searchInput = document.querySelector(".search-input-wrap input");
    els.searchResults = document.getElementById("search-results");
    els.regionTabs = Array.from(document.querySelectorAll(".region-tab"));
    els.filterChips = Array.from(document.querySelectorAll(".filter-chip"));
    els.matchesCounter = document.querySelector(".search-meta strong");

    // المودال
    els.modalBackdrop = document.querySelector(
      ".udsal-modal-backdrop[data-service-modal]"
    );
    if (els.modalBackdrop) {
      els.modalTitle = els.modalBackdrop.querySelector(
        "[data-modal-title]"
      );
      els.modalSubtitle = els.modalBackdrop.querySelector(
        "[data-modal-subtitle]"
      );
      els.modalRegion = els.modalBackdrop.querySelector(
        "[data-modal-region]"
      );
      els.modalRegionBadge = els.modalBackdrop.querySelector(
        "[data-modal-region-badge]"
      );
      els.modalCategory = els.modalBackdrop.querySelector(
        "[data-modal-category]"
      );
      els.modalDesc = els.modalBackdrop.querySelector(
        "[data-modal-desc]"
      );
      els.modalOpenLink = els.modalBackdrop.querySelector(
        "[data-modal-open-link]"
      );
      els.modalCopyBtn = els.modalBackdrop.querySelector(
        "[data-modal-copy]"
      );
      els.modalQrWrap = els.modalBackdrop.querySelector(
        "[data-modal-qr-wrap]"
      );
      els.modalQrImg = els.modalBackdrop.querySelector(
        "[data-modal-qr]"
      );
    }

    els.toast = document.querySelector("[data-udsal-toast]");
    els.toastText = els.toast
      ? els.toast.querySelector("[data-udsal-toast-text]")
      : null;

    // 🔍 البحث المباشر
    if (els.searchInput) {
      els.searchInput.addEventListener("input", (ev) => {
        state.query = ev.target.value || "";
        applyFilters();
        renderResults();
      });
    }

    // 🌍 تبويبات المناطق
    els.regionTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const region = btn.dataset.region || "all";
        state.activeRegion = region;

        els.regionTabs.forEach((b) =>
          b.classList.remove("is-active")
        );
        btn.classList.add("is-active");

        applyFilters();
        renderResults();
      });
    });

    // 🏷 فلاتر التصنيف
    els.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const key = chip.dataset.filter;
        if (!key) return;

        if (chip.classList.contains("is-on")) {
          chip.classList.remove("is-on");
          state.activeFilters.delete(key);
        } else {
          chip.classList.add("is-on");
          state.activeFilters.add(key);
        }

        applyFilters();
        renderResults();
      });
    });

    // 🎛 أزرار المودال
    if (els.modalBackdrop) {
      const closeBtn = els.modalBackdrop.querySelector(
        "[data-modal-close]"
      );
      if (closeBtn) {
        closeBtn.addEventListener("click", closeServiceModal);
      }

      els.modalBackdrop.addEventListener("click", (ev) => {
        if (ev.target === els.modalBackdrop) {
          closeServiceModal();
        }
      });

      document.addEventListener("keyup", (ev) => {
        if (ev.key === "Escape") {
          closeServiceModal();
        }
      });

      if (els.modalCopyBtn) {
        els.modalCopyBtn.addEventListener("click", copyServiceLink);
      }
    }
  }

  // 🌐 تحميل ملف JSON
  async function loadServices() {
    try {
      const res = await fetch(SERVICES_JSON_URL, {
        headers: {
          "Accept": "application/json",
        },
      });
      if (!res.ok) {
        console.error("⚠️ فشل تحميل الخدمات:", res.status, res.statusText);
        showToast("تعذّر تحميل قائمة الخدمات حالياً.");
        return;
      }

      const data = await res.json();
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.services)
        ? data.services
        : [];

      state.allServices = list.map(normalizeService);

      // أول رسم
      applyFilters();
      renderResults();
    } catch (err) {
      console.error("⚠️ خطأ أثناء جلب الخدمات:", err);
      showToast("حدث خطأ أثناء الاتصال بملف الخدمات.");
    }
  }

    // 🚀 تشغيل المحرك بعد تحميل الـ DOM (بطريقة ذكية)
  function initDeepSearch() {
    wireUI();
    loadServices();
  }

  if (document.readyState === "loading") {
    // لو الصفحة لسه ما خلصت تحميل الـ DOM
    document.addEventListener("DOMContentLoaded", initDeepSearch);
  } else {
    // لو السكربت انحط بعد ما الـ DOM جاهز (زي حالتنا)
    initDeepSearch();
  }
})();

