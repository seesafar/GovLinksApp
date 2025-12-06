// OneLink · Global Deep Search (Front-end demo)
// يقرأ البيانات من services-data.json ويعرض النتائج داخل #search-results
(function () {
 const SERVICES_JSON_URL = "../../core/i18n/data/services-data.json";


  let allServices = [];
  let currentQuery = "";

  document.addEventListener("DOMContentLoaded", () => {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    // 1) تحميل البيانات من ملف JSON
    fetch(DATA_URL)
      .then((res) => res.json())
      .then((data) => {
        allServices = Array.isArray(data) ? data : [];
        renderResults(); // أول عرض
        initSearchInput(); // تفعيل خانة البحث
      })
      .catch((err) => {
        console.error("DeepSearch · failed to load JSON:", err);
        resultsEl.innerHTML =
          '<div class="footer-note">تعذّر تحميل بيانات البحث حالياً. تأكد من المسار:<br><code>core/data/services-data.json</code></div>';
      });
  });

  // تفعيل البحث المباشر
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

  // فلترة البيانات حسب النص المدخل
  function getFilteredServices() {
    if (!currentQuery) return allServices;

    return allServices.filter((svc) => {
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

  // بناء كروت النتائج داخل #search-results
  function renderResults() {
    const resultsEl = document.querySelector(RESULTS_SELECTOR);
    if (!resultsEl) return;

    const filtered = getFilteredServices();
    if (!filtered.length) {
      resultsEl.innerHTML =
        '<div class="footer-note">لا توجد نتائج مطابقة حالياً… جرّب كلمة أخرى مثل <span>Absher</span> أو <span>digital.gov.eg</span>.</div>';
      return;
    }

    // نجمع حسب المنطقة (regionTitle)
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

  // دالة بسيطة لتفادي إدخال HTML من البيانات
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
