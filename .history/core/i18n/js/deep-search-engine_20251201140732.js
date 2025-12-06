// core/js/deep-search-engine.js
// =======================================
// OneLink · Global Deep Search Engine
// يقرأ الخدمات من services-data.json
// ويعرضها في صفحة app-deep-search.html
// =======================================

(function () {
  const DATA_URL = "../core/data/services-data.json"; // من مكان app-deep-search.html
  const resultsRootId = "search-results"; // بنستخدمه في الـ HTML

  const state = {
    services: [],
    region: "all",       // all | saudi | egypt | china | global
    category: "all",     // all أو category من JSON (Unified / Justice / Travel ...)
    query: ""
  };

  const REGION_META = {
    saudi: {
      title: "نتائج مميّزة · السعودية",
      badge: "Core Saudi",
      flag: "🇸🇦"
    },
    egypt: {
      title: "نتائج · مصر",
      badge: "Egypt · Unified",
      flag: "🇪🇬"
    },
    china: {
      title: "نتائج · الصين",
      badge: "China · e-Gov",
      flag: "🇨🇳"
    },
    global: {
      title: "Global matches",
      badge: "Mixed",
      flag: "🌍"
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    const resultsRoot = document.getElementById(resultsRootId);
    if (!resultsRoot) {
      console.warn(
        "[OneLink DeepSearch] لم يتم العثور على العنصر #search-results – أضفه داخل app-deep-search.html"
      );
    }

    // تحميل البيانات
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        return res.json();
      })
      .then((data) => {
        state.services = flattenServices(data);
        bindUI();
        render();
      })
      .catch((err) => {
        console.error("[OneLink DeepSearch] خطأ في تحميل البيانات:", err);
        if (resultsRoot) {
          resultsRoot.innerHTML =
            '<div class="results-section"><p style="font-size:11px;color:#fca5a5;">تعذّر تحميل قائمة الخدمات حالياً. تأكد أن ملف <strong>services-data.json</strong> في المسار الصحيح.</p></div>';
        }
      });
  });

  // توحيد البيانات في مصفوفة واحدة
  function flattenServices(data) {
    const flat = [];
    const regions = ["saudi", "egypt", "china", "global"];

    regions.forEach((key) => {
      const arr = Array.isArray(data[key]) ? data[key] : [];
      arr.forEach((svc) => {
        const normalized = {
          id: svc.id || "",
          name_ar: svc.name_ar || "",
          name_en: svc.name_en || "",
          region: (svc.region || key || "").toLowerCase(), // Saudi → saudi
          category: (svc.category || "Other").toLowerCase(), // Unified → unified
          status: (svc.status || "live").toLowerCase(),      // live / risk / soon
          description: svc.description || "",
          url: svc.url || "",
          keywords: Array.isArray(svc.keywords) ? svc.keywords : []
        };

        // نص موحد للبحث
        normalized._searchText = [
          normalized.name_ar,
          normalized.name_en,
          normalized.url,
          normalized.category,
          normalized.region,
          normalized.description,
          normalized.keywords.join(" ")
        ]
          .join(" ")
          .toLowerCase();

        flat.push(normalized);
      });
    });

    return flat;
  }

  // ربط الواجهة (التابس + الفلاتر + البحث)
  function bindUI() {
    const regionButtons = document.querySelectorAll(".region-tabs button");
    const filterChips = document.querySelectorAll(".filter-chip");
    const searchInput = document.querySelector(
      ".search-input-wrap input[type='search']"
    );
    const searchMetaMatches = document.querySelector(".search-meta span strong");

    // اختيار المنطقة
    regionButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        regionButtons.forEach((b) => b.classList.remove("is-active"));

        btn.classList.add("is-active");

        const text = btn.textContent.trim();

        if (text.includes("All") || text.includes("الكل") || text.includes("All regions")) {
          state.region = "all";
        } else if (text.includes("Saudi") || text.includes("السعودية")) {
          state.region = "saudi";
        } else if (text.includes("Egypt") || text.includes("مصر")) {
          state.region = "egypt";
        } else if (text.includes("China") || text.includes("الصين")) {
          state.region = "china";
        } else if (text.includes("Global") || text.includes("عالمية")) {
          state.region = "global";
        } else {
          state.region = "all";
        }

        render();
      });
    });

    // تصنيف النتائج (فلاتر)
    filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        // السماح بإطفاء الكل إذا نفس الفلتر
        const isOn = chip.classList.contains("is-on");
        filterChips.forEach((c) => c.classList.remove("is-on"));

        if (isOn) {
          // إعادة للوضع الافتراضي (all)
          state.category = "all";
        } else {
          chip.classList.add("is-on");
          const txt = chip.textContent.trim();

          if (txt.includes("موحدة")) {
            state.category = "unified";
          } else if (txt.includes("العدل") || txt.toLowerCase().includes("justice")) {
            state.category = "justice";
          } else if (txt.includes("هوية")) {
            state.category = "identity";
          } else if (txt.includes("سفر") || txt.includes("حدود")) {
            state.category = "travel";
          } else if (txt.includes("ضرائب") || txt.includes("مالية")) {
            state.category = "finance";
          } else if (txt.includes("صحة")) {
            state.category = "health";
          } else {
            state.category = "all";
          }
        }

        render();
      });
    });

    // البحث
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        state.query = searchInput.value.toLowerCase();
        render();

        // تحديث matches في أعلى الحقل (اختياري)
        try {
          if (searchMetaMatches) {
            const { filtered } = getFilteredServices();
            searchMetaMatches.textContent = filtered.length.toString();
          }
        } catch (e) {
          // نكتفي بتجاهل أي خطأ بسيط
        }
      });
    }
  }

  // فلترة حسب الحالة الحالية
  function getFilteredServices() {
    let filtered = [...state.services];

    if (state.region !== "all") {
      filtered = filtered.filter((svc) => svc.region === state.region);
    }

    if (state.category !== "all") {
      filtered = filtered.filter((svc) => svc.category === state.category);
    }

    if (state.query && state.query.trim().length > 0) {
      const q = state.query.trim();
      filtered = filtered.filter((svc) => svc._searchText.includes(q));
    }

    // تقسيم حسب المنطقة عشان نعرض أقسام شبيهة بالـ HTML
    const byRegion = {
      saudi: [],
      egypt: [],
      china: [],
      global: []
    };

    filtered.forEach((svc) => {
      const key = svc.region;
      if (!byRegion[key]) {
        byRegion[key] = [];
      }
      byRegion[key].push(svc);
    });

    return { filtered, byRegion };
  }

  // رسم النتائج داخل #search-results
  function render() {
    const root = document.getElementById(resultsRootId);
    if (!root) return;

    const { byRegion } = getFilteredServices();
    let html = "";

    ["saudi", "egypt", "china", "global"].forEach((regionKey) => {
      const list = byRegion[regionKey] || [];
      if (!list.length) return;

      const meta = REGION_META[regionKey] || {
        title: regionKey,
        badge: "",
        flag: ""
      };

      html += `
        <section class="results-section">
          <div class="section-header">
            <div class="section-title">
              ${meta.flag ? meta.flag + " " : ""}${meta.title}
              ${
                meta.badge
                  ? `<span class="badge">${meta.badge}</span>`
                  : ""
              }
            </div>
            <div class="section-count">
              <strong>${list.length}</strong> ${
        regionKey === "saudi"
          ? "خدمات مطابقة"
          : regionKey === "egypt"
          ? "نتائج"
          : "روابط"
      }
            </div>
          </div>
          ${list.map(renderResultCard).join("")}
        </section>
      `;
    });

    if (!html) {
      html = `
        <section class="results-section">
          <p style="font-size:11px;color:#9ca3af;">
            لا توجد نتائج مطابقة حالياً. جرّب كلمة أخرى أو وسّع نطاق البحث لجميع المناطق.
          </p>
        </section>
      `;
    }

    root.innerHTML = html;
  }

  // توليد كرت النتيجة
  function renderResultCard(svc) {
    const statusClass = getStatusClass(svc.status);
    const statusLabel = getStatusLabel(svc.status);
    const regionLabel = getRegionLabel(svc.region);

    const mainBtnLabel =
      svc.status === "risk" ? "التفاصيل والتحذير" : "Open";

    const secondary = svc.status === "risk";

    return `
      <article class="result-card">
        <div class="result-header">
          <div class="result-title">
            <h3>${escapeHtml(svc.name_ar)} — ${escapeHtml(svc.name_en)}</h3>
            <span class="sub">${escapeHtml(svc.description)}</span>
          </div>
          <div class="result-pills">
            <span class="pill region">${regionLabel}</span>
            <span class="pill ${statusClass}">${statusLabel}</span>
          </div>
        </div>
        <p class="result-body">
          ${escapeHtml(svc.description)}
        </p>
        <div class="result-meta-row">
          <span class="result-url">${escapeHtml(svc.url || "")}</span>
          <button class="open-btn${secondary ? " secondary" : ""}" type="button">
            ${mainBtnLabel}
          </button>
        </div>
      </article>
    `;
  }

  function getStatusClass(status) {
    switch (status) {
      case "risk":
        return "status-risk";
      case "soon":
        return "status-soon";
      case "live":
      default:
        return "status-ok";
    }
  }

  function getStatusLabel(status) {
    switch (status) {
      case "risk":
        return "Warning · Not official";
      case "soon":
        return "Coming soon";
      case "live":
      default:
        return "Official · Live";
    }
  }

  function getRegionLabel(region) {
    switch (region) {
      case "saudi":
        return "🇸🇦 Saudi";
      case "egypt":
        return "🇪🇬 Egypt";
      case "china":
        return "🇨🇳 China";
      case "global":
      default:
        return "🌍 Global";
    }
  }

  // حماية بسيطة من أي رموز HTML في النصوص
  function escapeHtml(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
})();
