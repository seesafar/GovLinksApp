// OneLink · Global Deep Search (Front-end demo)
// يقرأ الخدمات من services-data.json ويعرضها في #search-results
// يدعم:
// - البحث النصي المباشر
// - فلاتر التصنيف (OR logic)
// - تبويب المناطق (Saudi / Egypt / China / Global / All)

(function () {
  const RESULTS_SELECTOR = "#search-results";
  const SERVICES_JSON_URL = "../../core/i18n/data/services-data.json";

  // الحالة الداخلية
  let allServices = [];
  let currentQuery = "";
  let activeRegion = "all";          // all | sa | eg | cn | global
  let activeCategories = new Set();  // مثل unified / justice / travel ...

  document.addEventListener("DOMContentLoaded", () => {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    // 1) تحميل البيانات
    fetch(SERVICES_JSON_URL)
      .then((res) => res.json())
      .then((data) => {
        allServices = Array.isArray(data) ? data : [];
        initRegionTabs();
        initFilterChips();
        initSearchInput();
        renderResults();
      })
      .catch((err) => {
        console.error("DeepSearch · failed to load JSON:", err);
        resultsEl.innerHTML =
          '<div class="footer-note">تعذّر تحميل بيانات البحث حالياً. تأكد من المسار:<br><code>core/i18n/data/services-data.json</code></div>';
      });

    // كائن بسيط للاختبارات من الـ Console
    window.__deep = {
      getCount: () => allServices.length,
      query: (q) => {
        currentQuery = (q || "").toLowerCase().trim();
        console.log("Filtered by:", currentQuery);
        renderResults();
        return currentQuery;
      },
      setRegion: (r) => {
        activeRegion = r || "all";
        renderResults();
        return activeRegion;
      },
      setCategories: (arr) => {
        activeCategories = new Set(arr || []);
        renderResults();
        return Array.from(activeCategories);
      }
    };
  });

  // =========================
  // 🔎 البحث النصي
  // =========================
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

  // =========================
  // 🌍 تبويب المناطق (Saudi / Egypt / China / Global / All)
  // =========================
  function initRegionTabs() {
    const tabs = document.querySelectorAll(".region-tabs button");
    if (!tabs.length) return;

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        // نقرأ القيمة من data-region لو موجودة
        const regionAttr = btn.getAttribute("data-region");

        // لو ما فيه data-region نحدّد من النص (احتياط)
        let region = regionAttr || "all";
        const txt = btn.textContent.toLowerCase();

        if (!regionAttr) {
          if (txt.includes("saudi")) region = "sa";
          else if (txt.includes("egypt")) region = "eg";
          else if (txt.includes("china")) region = "cn";
          else if (txt.includes("global")) region = "global";
          else if (txt.includes("all")) region = "all";
        }

        activeRegion = region;

        // إدارة كلاس is-active
        tabs.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        renderResults();
      });
    });
  }

  // =========================
  // 🎛️ فلاتر التصنيف (OR)
  // =========================
  function initFilterChips() {
    const chips = document.querySelectorAll(".filter-chip");
    if (!chips.length) return;

    // نلتقط أي زر عليه is-on عند تحميل الصفحة
    activeCategories = new Set(
      Array.from(chips)
        .filter((c) => c.classList.contains("is-on"))
        .map((c) => c.getAttribute("data-filter"))
        .filter(Boolean)
    );

    chips.forEach((chip) => {
      const key = chip.getAttribute("data-filter");
      if (!key) return;

      chip.addEventListener("click", () => {
        // تبديل الحالة (toggle)
        if (activeCategories.has(key)) {
          activeCategories.delete(key);
          chip.classList.remove("is-on");
        } else {
          activeCategories.add(key);
          chip.classList.add("is-on");
        }

        renderResults();
      });
    });
  }

  // =========================
  // 🧠 المنطق الأساسي للفلترة
  // =========================
  function getFilteredServices() {
    let list = allServices.slice();

    // 1) فلترة حسب المنطقة
    if (activeRegion && activeRegion !== "all") {
      list = list.filter((svc) => (svc.region || "all") === activeRegion);
    }

    // 2) فلترة حسب الفلاتر (OR logic)
    if (activeCategories.size > 0) {
      list = list.filter((svc) => {
        const cats = Array.isArray(svc.categories) ? svc.categories : [];
        if (!cats.length) return false;

        // OR: لو أي كاتيجوري من الخدمة موجود ضمن الفلاتر النشطة → مقبول
        return cats.some((c) => activeCategories.has(c));
      });
    }

    // 3) فلترة بالنص
    if (currentQuery) {
      const q = currentQuery;
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
        return haystack.includes(q);
      });
    }

    return list;
  }

  // =========================
  // 🧱 بناء HTML للنتائج
  // =========================
  function renderResults() {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    const filtered = getFilteredServices();

    if (!filtered.length) {
      resultsEl.innerHTML =
        '<div class="footer-note">لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى مثل <span>Absher</span> أو <span>digital.gov.eg</span>.</div>';
      return;
    }

    // تجميع حسب عنوان المنطقة (regionTitle)
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
        const status = svc.status || "live";
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

  // حماية بسيطة من إدخال HTML في النصوص
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
