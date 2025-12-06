// OneLink · Global Deep Search (Front-end demo)
// يقرأ البيانات من services-data.json ويعرض النتائج داخل #search-results
// يدعم:
//  - البحث النصي
//  - فلاتر التصنيف (OR logic)
//  - Tabs حسب الدولة (Saudi / Egypt / China / Global / All)

(function () {
  // 🔗 مكان عرض النتائج في الصفحة
  const RESULTS_SELECTOR = "#search-results";

  // 📂 مسار ملف JSON (من داخل docs/app-deep-search.html)
const SERVICES_JSON_URL = "core/i18n/data/services-data.json";


  // 🧠 حالة البحث
  let allServices = [];
  let currentQuery = "";
  let activeRegion = "all"; // sa / eg / cn / global / all

  // مجموعة الفلاتر المفعّلة (منصات موحدة / قضاء / هوية / سفر / ضرائب / صحة)
  const activeFilters = new Set();

  // خريطة الفلاتر → نوع التصنيف في الـ JSON (نسخة منسّقة OneLink)
const FILTER_MAP = {
  unified: "unified",   // منصات موحدة
  justice: "justice",   // خدمات العدل / القضاء
  identity: "identity", // هوية رقمية
  travel: "travel",     // سفر / حدود
  tax: "tax",           // ضرائب / مالية
  health: "health"      // صحة
};

  // ✅ البداية
  document.addEventListener("DOMContentLoaded", () => {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    // 1) تحميل البيانات
    fetch(SERVICES_JSON_URL)
      .then((res) => res.json())
      .then((data) => {
        allServices = Array.isArray(data) ? data : [];
        // تهيئة البحث والفلاتر والتابات
        initSearchInput();
        initFilterChips();
        initRegionTabs();
        exposeDebugHelpers();
        // أول رسم للنتائج
        renderResults();
      })
      .catch((err) => {
        console.error("DeepSearch · failed to load JSON:", err);
        resultsEl.innerHTML =
          '<div class="footer-note">تعذّر تحميل بيانات البحث حالياً. تأكد من المسار:<br><code>core/i18n/data/services-data.json</code></div>';
      });
  });

  // ============================
  // 🟢 البحث النصي
  // ============================
  function initSearchInput() {
    const input = document.querySelector(
      ".search-input-wrap input[type='search']"
    );
    if (!input) return;

    input.addEventListener("input", (e) => {
      currentQuery = (e.target.value || "").toLowerCase().trim();
      renderResults();
    });
  }

  // ============================
  // 🟢 فلاتر التصنيف (chips)
  // ============================
  function initFilterChips() {
    const chips = document.querySelectorAll(".filter-chip");
    if (!chips.length) return;

    chips.forEach((chip) => {
      // نحدّد المفتاح من النص (بدون تعديل الـ HTML)
      const text = chip.textContent.trim();

      let key = null;
      if (text.includes("منصات موحدة")) key = "unified";
      else if (text.includes("العدل") || text.includes("القضاء")) key = "justice";
      else if (text.includes("هوية رقمية")) key = "identity";
      else if (text.includes("سفر")) key = "travel";
      else if (text.includes("ضرائب") || text.includes("مالية")) key = "tax";
      else if (text.includes("صحة")) key = "health";

      if (!key) return;

      // نخزن المفتاح داخل الـ element لو احتجناه لاحقاً
      chip.dataset.filterKey = key;

      // لو كان عليه is-on من البداية نضيفه في الـ Set
      if (chip.classList.contains("is-on")) {
        activeFilters.add(key);
      }

      chip.addEventListener("click", () => {
        const filterKey = chip.dataset.filterKey;
        if (!filterKey) return;

        if (activeFilters.has(filterKey)) {
          activeFilters.delete(filterKey);
          chip.classList.remove("is-on");
        } else {
          activeFilters.add(filterKey);
          chip.classList.add("is-on");
        }

        renderResults();
      });
    });
  }

  // ============================
  // 🟢 Tabs الدول (Saudi / Egypt / China / Global / All)
  // ============================
  function initRegionTabs() {
    const tabs = document.querySelectorAll(".region-tab");
    if (!tabs.length) return;

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const region = tab.dataset.region || "all";

        // نحدّث الحالة
        activeRegion = region;

        // نضبط الـ class is-active على التاب الحالي فقط
        tabs.forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");

        // نعيد رسم النتائج
        renderResults();
      });
    });
  }

  // ============================
  // 🧠 المنطق الأساسي للفلترة
  // ============================
  function getFilteredServices() {
    let list = allServices.slice();

    // 1) فلترة حسب الدولة (Region Tab)
    if (activeRegion && activeRegion !== "all") {
      list = list.filter((svc) => {
        const code =
          svc.region ||
          svc.region_code ||
          svc.country_code ||
          "";
        return code.toLowerCase() === activeRegion.toLowerCase();
      });
    }

    // 2) فلترة حسب البحث النصي
    if (currentQuery) {
      list = list.filter((svc) => {
        const haystack = (
          (svc.name || "") +
          " " +
          (svc.subtitle || "") +
          " " +
          (svc.description || "") +
          " " +
          (svc.url || "")
        )
          .toString()
          .toLowerCase();
        return haystack.includes(currentQuery);
      });
    }

    // 3) فلترة حسب الفلاتر (OR logic)
    if (activeFilters.size > 0) {
      list = list.filter((svc) => {
        const categoryKey =
          (svc.category_key || svc.categoryKey || svc.category || "")
            .toString()
            .toLowerCase();

        // لو ما فيه تصنيف في الـ JSON نتركه يمر بدون فلترة
        if (!categoryKey) return true;

        // نشوف هل تصنيف الخدمة موجود ضمن أي فلتر مفعّل
        for (const filterKey of activeFilters) {
          const expectedCategory = (FILTER_MAP[filterKey] || "").toLowerCase();
          if (expectedCategory && categoryKey === expectedCategory) {
            return true;
          }
        }
        return false;
      });
    }

    return list;
  }

  // ============================
  // 🎨 توليد الـ HTML للنتائج
  // ============================
  function renderResults() {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    const filtered = getFilteredServices();

    // لو ما فيه نتائج
    if (!filtered.length) {
      resultsEl.innerHTML =
        '<div class="footer-note">لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى مثل <span>Absher</span> أو <span>digital.gov.eg</span>.</div>';
      return;
    }

    // نجمع حسب العنوان (regionTitle) عشان تبقى نفس شكل الأقسام
    const grouped = {};
    filtered.forEach((svc) => {
      const key = svc.regionTitle || "النتائج";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(svc);
    });

    let html = "";

    Object.keys(grouped).forEach((groupKey) => {
      const groupItems = grouped[groupKey];
      const first = groupItems[0] || {};
      const badge = first.regionBadge || "";
      const sectionCount = groupItems.length;

      html += `
        <section class="results-section">
          <div class="section-header">
            <div class="section-title">
              ${groupKey}
              ${
                badge
                  ? `<span class="badge">${escapeHtml(badge)}</span>`
                  : ""
              }
            </div>
            <div class="section-count">
              <strong>${sectionCount}</strong> نتيجة
            </div>
          </div>
      `;

      groupItems.forEach((svc) => {
        const status = (svc.status || "live").toLowerCase();
        let statusPill = "";
        if (status === "warning") {
          statusPill =
            '<span class="pill status-risk">Warning · Not official</span>';
        } else if (status === "soon") {
          statusPill =
            '<span class="pill status-soon">Coming soon</span>';
        } else {
          statusPill =
            '<span class="pill status-ok">Official · Live</span>';
        }

        html += `
          <article class="result-card">
            <div class="result-header">
              <div class="result-title">
                <h3>${escapeHtml(svc.name || "")}</h3>
                ${
                  svc.subtitle
                    ? `<span class="sub">${escapeHtml(
                        svc.subtitle
                      )}</span>`
                    : ""
                }
              </div>
              <div class="result-pills">
                ${
                  svc.region_label
                    ? `<span class="pill region">${escapeHtml(
                        svc.region_label
                      )}</span>`
                    : ""
                }
                ${statusPill}
              </div>
            </div>
            ${
              svc.description
                ? `<p class="result-body">${escapeHtml(
                    svc.description
                  )}</p>`
                : ""
            }
            <div class="result-meta-row">
              ${
                svc.url
                  ? `<span class="result-url">${escapeHtml(
                      svc.url
                    )}</span>`
                  : "<span></span>"
              }
              <button class="open-btn${
                status === "warning" ? " secondary" : ""
              }" type="button">
                ${
                  svc.cta
                    ? escapeHtml(svc.cta)
                    : status === "warning"
                    ? "Show details"
                    : "Open"
                }
              </button>
            </div>
          </article>
        `;
      });

      html += `</section>`;
    });

    resultsEl.innerHTML = html;
  }

  // 🧼 دالة لتفادي إدخال HTML من JSON
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ============================
  // 🧪 Helpers للاختبار من الـ Console
  // ============================
  function exposeDebugHelpers() {
    window.__deep = {
      getCount() {
        return allServices.length;
      },
      query(q) {
        currentQuery = (q || "").toLowerCase().trim();
        renderResults();
        return "Filtered by: " + currentQuery;
      },
      setRegion(regionCode) {
        activeRegion = regionCode || "all";
        renderResults();
        return "Region set to: " + activeRegion;
      },
      reset() {
        currentQuery = "";
        activeRegion = "all";
        activeFilters.clear();
        renderResults();
        return "DeepSearch reset";
      }
    };
  }
})();
