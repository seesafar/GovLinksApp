// app-ui/app-global-hub.js
// =========================
// محرك البحث + الفلاتر لصفحة OneLink Global Hub

(function () {
  // مسار ملف الخدمات (من صفحة app-global-hub.html)
  

  // الحالة العامة
  const state = {
    allServices: [],
    filtered: [],
    activeRegion: "global", // global | sa | eg | cn | all
    query: ""
  };

  // عناصر الصفحة (اعتمدنا على data-attributes عشان ما نتعلق بالأرقام)
  const els = {
    searchInput: document.querySelector("[data-global-search-input]"),
    resultsList: document.querySelector("[data-global-results-list]"),
    countLabel: document.querySelector("[data-global-results-count]"),
    regionChips: document.querySelectorAll("[data-global-region]"),
    emptyState: document.querySelector("[data-global-empty]"),
  };

  // لو الصفحة قديمة وما فيها العناصر نطلع بهدوء
  if (!els.searchInput || !els.resultsList) {
    console.warn("[OneLink Global Hub] عناصر الواجهة غير مكتملة، لم يتم تفعيل البحث.");
    return;
  }

  // 1) تحميل بيانات الخدمات من JSON
  fetch(DATA_URL)
    .then((res) => res.json())
    .then((data) => {
      const raw = Array.isArray(data)
        ? data
        : Array.isArray(data.services)
        ? data.services
        : [];

      // نأخذ الخدمات اللي تخص السعودية/مصر/الصين/Global فقط
      state.allServices = raw.filter((item) =>
        ["global", "sa", "eg", "cn"].includes(item.region)
      );

      // ترتيب بسيط بالأسم
      state.allServices.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      applyFilters();
      wireEvents();
    })
    .catch((err) => {
      console.error("[OneLink Global Hub] خطأ في تحميل JSON:", err);
      if (els.emptyState) {
        els.emptyState.textContent = "تعذّر تحميل قائمة الخدمات العالمية حالياً.";
        els.emptyState.style.display = "block";
      }
    });

  // 2) ربط أحداث البحث والفلاتر
  function wireEvents() {
    // البحث النصي
    els.searchInput.addEventListener("input", (e) => {
      state.query = (e.target.value || "").toLowerCase().trim();
      applyFilters();
    });

    // فلاتر المنطقة (الأزرار مثل: All / Global / Saudi SA / Egypt EG / China CN)
    els.regionChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const region = chip.getAttribute("data-global-region") || "all";
        state.activeRegion = region;

        // تفعيل الشكل النشط
        els.regionChips.forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");

        applyFilters();
      });
    });
  }

  // 3) تطبيق الفلاتر (المنطقة + البحث)
  function applyFilters() {
    const q = state.query;
    const region = state.activeRegion;

    let list = [...state.allServices];

    // فلتر المنطقة
    if (region !== "all") {
      list = list.filter((item) => (item.region || "").toLowerCase() === region);
    }

    // فلتر نص البحث
    if (q) {
      list = list.filter((item) => {
        const haystack = [
          item.name,
          item.subtitle,
          item.description,
          item.region_label,
          (item.tags || []).join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      });
    }

    state.filtered = list;
    render();
  }

  // 4) رسم النتائج في الصفحة
  function render() {
    const list = state.filtered;
    const total = state.allServices.length;

    // عداد النتائج: "5 / 25"
    if (els.countLabel) {
      els.countLabel.textContent = `${list.length} / ${total}`;
    }

    // لو ما في نتائج
    if (!list.length) {
      els.resultsList.innerHTML = "";
      if (els.emptyState) {
        els.emptyState.style.display = "block";
        els.emptyState.textContent =
          state.query || state.activeRegion !== "all"
            ? "لا توجد نتائج مطابقة حاليًا… جرّب كلمة أخرى أو غيّر المنطقة."
            : "لم تتم إضافة خدمات عالمية بعد.";
      }
      return;
    }

    if (els.emptyState) {
      els.emptyState.style.display = "none";
    }

    // نبني الكروت
    const cardsHtml = list
      .map((item) => {
        const badge = item.regionBadge || "Service";
        const regionLabel = item.region_label || "Global";
        const category = item.category || "";
        const subtitle = item.subtitle || "";
        const description = item.description || "";
        const url = item.url || "#";

        // نجمع الـ Tags في شريط صغير لو موجودة
        const tags =
          Array.isArray(item.tags) && item.tags.length
            ? `<div class="gh-card-tags">
                ${item.tags
                  .slice(0, 4)
                  .map((t) => `<span class="gh-tag">${escapeHtml(t)}</span>`)
                  .join("")}
               </div>`
            : "";

        return `
          <article class="gh-card">
            <header class="gh-card-head">
              <div class="gh-card-title-wrap">
                <h3 class="gh-card-title">${escapeHtml(item.name)}</h3>
                <span class="gh-card-badge">${escapeHtml(badge)}</span>
              </div>
              <div class="gh-card-region">${escapeHtml(regionLabel)}</div>
            </header>

            <p class="gh-card-sub">${escapeHtml(subtitle)}</p>
            <p class="gh-card-desc">${escapeHtml(description)}</p>

            ${tags}

            <footer class="gh-card-footer">
              ${
                category
                  ? `<span class="gh-card-category">${escapeHtml(category)}</span>`
                  : ""
              }
              <a href="${url}" class="gh-card-cta" target="_blank" rel="noopener">
                فتح الخدمة
              </a>
            </footer>
          </article>
        `;
      })
      .join("");

    els.resultsList.innerHTML = cardsHtml;
  }

  // 5) دالة بسيطة لتفادي مشاكل HTML injection
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
