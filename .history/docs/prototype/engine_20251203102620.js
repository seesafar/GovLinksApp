// OneLink Prototype Engine
// ========================
// يطبّق فكرة Unified Digital Services Access Layer (UDSAL)
// - يقرأ schema.json
// - يفلتر حسب المنطقة
// - يبحث نصياً
// - يمرر النتيجة إلى Router ذكي بسيط

(function () {
  const DATA_URL = "schema.json";

  const state = {
    all: [],
    filtered: [],
    activeRegion: "all",
    query: ""
  };

  const els = {
    searchInput: document.querySelector("[data-search-input]"),
    resultsList: document.querySelector("[data-results-list]"),
    countLabel: document.querySelector("[data-results-count]"),
    emptyState: document.querySelector("[data-empty-state]"),
    regionChips: document.querySelectorAll("[data-region]")
  };

  if (!els.searchInput || !els.resultsList) {
    console.warn("[Prototype] عناصر الواجهة غير مكتملة.");
    return;
  }

  // تحميل البيانات
  fetch(DATA_URL)
    .then((res) => {
      if (!res.ok) {
        throw new Error("Failed to load schema.json");
      }
      return res.json();
    })
    .then((data) => {
      state.all = Array.isArray(data) ? data : [];
      applyFiltersAndRender();
    })
    .catch((err) => {
      console.error("[Prototype] تعذّر تحميل البيانات:", err);
      if (els.emptyState) {
        els.emptyState.textContent =
          "تعذّر تحميل مخطط الخدمات الموحد (schema.json). تأكد من المسار.";
      }
    });

  // أحداث الواجهة
  els.searchInput.addEventListener("input", (e) => {
    state.query = e.target.value.trim();
    applyFiltersAndRender();
  });

  els.regionChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      els.regionChips.forEach((c) => c.classList.remove("chip-active"));
      chip.classList.add("chip-active");
      state.activeRegion = chip.getAttribute("data-region") || "all";
      applyFiltersAndRender();
    });
  });

  function applyFiltersAndRender() {
    const q = state.query.toLowerCase();
    const region = state.activeRegion;

    let list = state.all.slice();

    if (region !== "all") {
      list = list.filter((item) => item.region === region);
    }

    if (q) {
      list = list.filter((item) => {
        const haystack =
          (item.name || "") +
          " " +
          (item.subtitle || "") +
          " " +
          (item.description || "") +
          " " +
          (item.tags || []).join(" ");
        return haystack.toLowerCase().includes(q);
      });
    }

    state.filtered = list;
    renderResults();
  }

  function renderResults() {
    const list = state.filtered;
    const total = state.all.length;

    if (els.countLabel) {
      els.countLabel.textContent = `${list.length} / ${total}`;
    }

    if (!list.length) {
      els.resultsList.innerHTML = "";
      if (els.emptyState) {
        els.emptyState.style.display = "block";
        els.emptyState.textContent =
          state.query || state.activeRegion !== "all"
            ? "لا توجد نتائج مطابقة حاليًا… جرّب كلمة أخرى أو غيّر المنطقة."
            : "لم تتم إضافة خدمات في هذا النموذج بعد.";
      }
      return;
    }

    if (els.emptyState) {
      els.emptyState.style.display = "none";
    }

    els.resultsList.innerHTML = list
      .map((svc) => createCardHTML(svc))
      .join("");
    attachCardEvents();
  }

  function createCardHTML(svc) {
    const tagsHtml = (svc.tags || [])
      .map((t) => `<span class="tag">${t}</span>`)
      .join("");

    return `
      <article class="card" data-service-id="${svc.id}">
        <div class="card-header">
          <span>${svc.region_label || ""}</span>
          <span class="badge">${svc.regionBadge || ""}</span>
        </div>
        <h2 class="card-title">${svc.name}</h2>
        <p class="card-subtitle">${svc.subtitle || ""}</p>
        <p class="card-description">${svc.description || ""}</p>
        <div class="tags">
          ${tagsHtml}
        </div>
        <div class="card-footer">
          <button class="btn-primary" data-open-service>
            ${svc.cta || "Open"}
          </button>
          <span class="badge badge-pill">${svc.category || ""}</span>
        </div>
      </article>
    `;
  }

  function attachCardEvents() {
    const buttons = document.querySelectorAll("[data-open-service]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest("[data-service-id]");
        if (!card) return;
        const id = card.getAttribute("data-service-id");
        const svc = state.all.find((s) => s.id === id);
        if (!svc) return;
        routeToService(svc);
      });
    });
  }

  // =========================
  // Router التجريبي (قلب الاختراع)
  // =========================
  function routeToService(svc) {
    const type = svc.routeType || "external";

    // فقط للبرهنة على الفكرة:
    // - onelink-sa / eg / cn → توجيه مبدئي لصفحة داخل OneLink
    // - external           → فتح الرابط الأصلي
    if (type === "onelink-sa") {
      // مسار تجريبي: يفتح صفحة الخدمات السعودية في مشروعك
      window.open("../app-home-global.html#sa-" + svc.id, "_blank");
    } else if (type === "onelink-eg") {
      window.open("../egypt-app/index.html#" + svc.id, "_blank");
    } else if (type === "onelink-cn") {
      window.open("../china-app/index.html#" + svc.id, "_blank");
    } else {
      // توجيه مباشر للموقع الأصلي
      if (svc.url) {
        window.open(svc.url, "_blank");
      } else {
        alert("لا يوجد رابط معرف لهذه الخدمة (نموذج تجريبي).");
      }
    }
  }
})();
