// ================================================
//  OneLink Deep Search · Golden Engine + Fuzzy + DidYouMean
// ================================================
(function () {
  // ------------- Normalization ----------------
  function normalizeText(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .trim()
      .replace(/[أإآا]/g, "ا")
      .replace(/ى/g, "ي")
      .replace(/ة/g, "ه")
      .replace(/[\u064B-\u065F]/g, "") // إزالة التشكيل
      .replace(/[^\w\u0600-\u06FF]+/g, " ")
      .replace(/\s+/g, " ");
  }

  // ✅ المسار من docs/app-ui/app-deep-search.html إلى ملف الخدمات
  const SERVICES_JSON_URL = "../core/i18n/data/services-data.json";

  // ------------- State ----------------
  const state = {
    all: [],
    filtered: [],
    query: "",
    region: "all",        // all | sa | eg | cn | global
    filters: new Set(),   // unified / justice / identity / travel / tax / health
  };

  const FILTER_MAP = {
    unified: "unified",
    justice: "justice",
    identity: "identity",
    travel: "travel",
    tax: "tax",
    health: "health",
  };

  const ui = {
    input: null,
    results: null,
    matches: null,
    suggestions: null,
    loadingDot: null,
    regionTabs: [],
    filterChips: [],
    modal: null,
    modalTitle: null,
    modalSubtitle: null,
    modalRegion: null,
    modalRegionBadge: null,
    modalCategory: null,
    modalDesc: null,
    modalOpen: null,
    modalCopy: null,
    modalQR: null,
    modalQRimg: null,
    toast: null,
    toastText: null,
    didYouMeanBox: null,
  };

  // ------------- Service normalization -------------
  function normalizeService(raw, fallbackRegion) {
    return {
      id: raw.id || raw.key || raw.slug || "",
      name: raw.name_ar || raw.name || raw.title || "خدمة",
      subtitle: raw.subtitle || raw.subtitle_ar || raw.owner || "",
      desc: raw.description || raw.description_ar || raw.desc || "",
      url: raw.url || raw.href || "#",
      region:
        (raw.region || raw.country || fallbackRegion || "global").toLowerCase(),
      category: (raw.category || raw.type || "other").toLowerCase(),
      status: (raw.status || "ok").toLowerCase(),
    };
  }

  // ------------- Levenshtein + Fuzzy -------------
  function levenshtein(a, b) {
    if (!a) return b ? b.length : 0;
    if (!b) return a.length;
    a = a.toString();
    b = b.toString();

    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1;  j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }

  function fuzzyTokenScore(field, token, baseWeight, maxDist) {
    if (!field || !token) return 0;
    const words = field.split(/\s+/).filter(Boolean);
    if (!words.length) return 0;

    let best = Infinity;
    for (const w of words) {
      const d = levenshtein(w, token);
      if (d < best) best = d;
    }

    if (best > maxDist) return 0;

    const factor = maxDist - best + 1; // d=0 → أعلى
    return baseWeight * factor;
  }

  // ------------- Match scoring (exact + fuzzy) -------------
  function computeMatchScore(svc, tokens) {
    if (!tokens.length) return 1;

    const nameNorm = normalizeText(svc.name);
    const subNorm  = normalizeText(svc.subtitle);
    const descNorm = normalizeText(svc.desc);
    const urlNorm  = normalizeText(svc.url);

    const nameDense = nameNorm.replace(/\s+/g, "");
    const subDense  = subNorm.replace(/\s+/g, "");
    const descDense = descNorm.replace(/\s+/g, "");
    const urlDense  = urlNorm.replace(/\s+/g, "");

    let total = 0;

    for (const t of tokens) {
      if (!t) continue;
      let tokenScore = 0;

      function fieldScore(field, dense, base, startBonus, exactBonus) {
        if (!field && !dense) return 0;
        let s = 0;
        if (field.includes(t) || dense.includes(t)) s += base;
        if (field.startsWith(t) || dense.startsWith(t)) s += startBonus;
        if (field === t || dense === t) s += exactBonus;
        return s;
      }

      // تطابق مباشر
      tokenScore += fieldScore(nameNorm, nameDense, 8, 6, 10);
      tokenScore += fieldScore(subNorm,  subDense,  4, 3, 5);
      tokenScore += fieldScore(descNorm, descDense, 2, 2, 3);
      tokenScore += fieldScore(urlNorm,  urlDense,  2, 1, 3);

      // فزي إذا ما فيه ولا تطابق مباشر
      if (tokenScore === 0) {
        const maxDist = 2;
        tokenScore += fuzzyTokenScore(nameNorm, t, 4, maxDist);
        tokenScore += fuzzyTokenScore(subNorm,  t, 2, maxDist);
        tokenScore += fuzzyTokenScore(descNorm, t, 1, maxDist);
        tokenScore += fuzzyTokenScore(urlNorm,  t, 1, maxDist);
      }

      total += tokenScore;
    }

    return total;
  }

  // ------------- Filtering + Ranking + DidYouMean -------------
  function applyFilters() {
    const qNorm  = normalizeText(state.query);
    const tokens = qNorm.split(/\s+/).filter(Boolean);

    if (ui.loadingDot) ui.loadingDot.hidden = false;

    const ranked = [];

    for (const svc of state.all) {
      // فلتر المنطقة
      if (state.region !== "all" && svc.region !== state.region) continue;

      // فلتر التصنيفات
      if (state.filters.size) {
        let ok = false;
        for (const f of state.filters) {
          if (svc.category === FILTER_MAP[f]) {
            ok = true;
            break;
          }
        }
        if (!ok) continue;
      }

      // حساب السكور
      let score = 1;
      if (tokens.length) {
        score = computeMatchScore(svc, tokens);
        if (score <= 0) continue;
      }

      ranked.push({ svc, score });
    }

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.svc.name.localeCompare(b.svc.name, "ar");
    });

    state.filtered = ranked.map((r) => r.svc);

     // ------ "هل تقصد؟" بعد الترتيب ------
  if (ui.didYouMeanBox) {
    // لو مافيه استعلام → نخفي الصندوق
    if (!tokens.length) {
      ui.didYouMeanBox.style.display = "none";
      ui.didYouMeanBox.innerHTML = "";
    } else {
      const queryNorm = tokens.join(" "); // مثال: "ابشر" أو "ايشر"
      const candidates = [];

      for (const svc of state.all) {
        const nameNorm = normalizeText(svc.name); // "absher ابشر اعمال"
        const words = nameNorm.split(/\s+/).filter(Boolean);
        if (!words.length) continue;

        // أقل مسافة بين الكلمة المدخلة وأي كلمة في اسم الخدمة
        let minDist = Infinity;
        for (const w of words) {
          const d = levenshtein(w, queryNorm);
          if (d < minDist) minDist = d;
        }

        // أبعد من حرفين → نخليه
        if (minDist > 2) continue;

        const s = computeMatchScore(svc, tokens);
        if (s <= 0) continue;

        candidates.push({ svc, dist: minDist, score: s });
      }

      if (!candidates.length) {
        ui.didYouMeanBox.style.display = "none";
        ui.didYouMeanBox.innerHTML = "";
      } else {
        // ترتيب: الأقرب في المسافة، ثم الأعلى في السكور
        candidates.sort((a, b) => {
          if (a.dist !== b.dist) return a.dist - b.dist;
          return b.score - a.score;
        });

        // نأخذ أفضل 3 اقتراحات
        const top = candidates.slice(0, 3);

        // بناء HTML: هل تقصد: [زر][·][زر][·][زر]
        let html = "هل تقصد:";
        html += top
          .map((item) => {
            const safeName = item.svc.name.replace(/"/g, "&quot;");
            return ` <button type="button" class="dym-pill" data-dym-name="${safeName}">${safeName}</button>`;
          })
          .join(" ·");

        ui.didYouMeanBox.innerHTML = html;
        ui.didYouMeanBox.style.display = "block";

        // ربط الأزرار: عند الضغط نعيد البحث باسم الخدمة
        const buttons = ui.didYouMeanBox.querySelectorAll("[data-dym-name]");
        buttons.forEach((btn) => {
          btn.addEventListener("click", () => {
            const name = btn.getAttribute("data-dym-name");
            if (ui.input) {
              ui.input.value = name;
            }
            state.query = name;
            applyFilters();
          });
        });
      }
    }
  }



    // إعادة الرسم + الاقتراحات
    requestAnimationFrame(() => {
      renderResults();
      updateSuggestionsWithRanking(tokens);
      if (ui.loadingDot) ui.loadingDot.hidden = true;
    });
  }

  // ------------- Render results -------------
  function renderResults() {
    if (!ui.results) return;
    ui.results.innerHTML = "";

    if (ui.matches) ui.matches.textContent = String(state.filtered.length);

    if (!state.filtered.length) {
      const p = document.createElement("p");
      p.style.textAlign = "center";
      p.style.color = "#8b9bb5";
      p.style.marginTop = "20px";
      p.innerHTML =
        'لا توجد نتائج مطابقة… جرّب كلمة أخرى مثل <b>Absher</b>.';
      ui.results.appendChild(p);
      return;
    }

    state.filtered.forEach((svc) => {
      const card = document.createElement("article");
      card.className = "result-card";

      card.innerHTML = `
        <div class="result-header">
          <div class="result-title">
            <h3>${svc.name}</h3>
            <span class="sub">${svc.subtitle || svc.url}</span>
          </div>
          <div class="result-pills">
            <span class="pill region">${regionLabel(svc.region)}</span>
            <span class="pill ${statusClass(svc.status)}">${statusLabel(svc.status)}</span>
          </div>
        </div>
        <p class="result-body">${svc.desc}</p>
        <div class="result-meta-row">
          <span class="result-url">${svc.url}</span>
          <button type="button" class="open-btn">فتح</button>
        </div>
      `;

      const openBtn = card.querySelector(".open-btn");
      if (openBtn) {
        openBtn.addEventListener("click", (ev) => {
          ev.stopPropagation();
          openModal(svc);
        });
      }

      card.addEventListener("click", () => openModal(svc));
      ui.results.appendChild(card);
    });
  }

  function regionLabel(r) {
    switch (r) {
      case "sa": return "Saudi · 🇸🇦";
      case "eg": return "Egypt · 🇪🇬";
      case "cn": return "China · 🇨🇳";
      case "global": return "Global · 🌍";
      default: return r || "Other";
    }
  }

  function statusLabel(s) {
    switch (s) {
      case "ok":   return "Ready · متاحة";
      case "soon": return "Soon · قريباً";
      case "risk": return "Deprecated";
      default:     return s || "Status";
    }
  }

  function statusClass(s) {
    switch (s) {
      case "ok":   return "status-ok";
      case "soon": return "status-soon";
      case "risk": return "status-risk";
      default:     return "status-ok";
    }
  }

  // ------------- Modal -------------
  function openModal(svc) {
    if (!ui.modal) return;

    if (ui.modalTitle)   ui.modalTitle.textContent   = svc.name;
    if (ui.modalSubtitle)ui.modalSubtitle.textContent= svc.subtitle || "";
    if (ui.modalRegion)  ui.modalRegion.textContent  = regionLabel(svc.region);
    if (ui.modalRegionBadge) ui.modalRegionBadge.textContent = regionLabel(svc.region);
    if (ui.modalCategory)ui.modalCategory.textContent= svc.category || "Service";
    if (ui.modalDesc)    ui.modalDesc.textContent    = svc.desc || "—";
    if (ui.modalOpen)    ui.modalOpen.href           = svc.url || "#";

    if (ui.modalQRimg && svc.url) {
      const qrUrl =
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
        encodeURIComponent(svc.url);
      ui.modalQRimg.src = qrUrl;
      if (ui.modalQR) ui.modalQR.style.display = "";
    } else if (ui.modalQR) {
      ui.modalQR.style.display = "none";
    }

    ui.modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    if (!ui.modal) return;
    ui.modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function copyLink() {
    if (!ui.modalOpen) return;
    const url = ui.modalOpen.href;
    if (!url || url === "#") return;

    navigator.clipboard
      .writeText(url)
      .then(() => showToast("تم نسخ الرابط بنجاح ✅"))
      .catch(() => showToast("تعذّر نسخ الرابط، جرّب يدويًا."));
  }

  function showToast(msg) {
    if (!ui.toast) return;
    if (ui.toastText) ui.toastText.textContent = msg;
    ui.toast.setAttribute("aria-hidden", "false");
    setTimeout(() => ui.toast.setAttribute("aria-hidden", "true"), 2200);
  }

  // ------------- Suggestions -------------
  function updateSuggestionsWithRanking(tokens) {
    if (!ui.suggestions) return;
    const q = state.query.trim();
    if (!q) return clearSuggestions();

    const base = state.filtered.length ? state.filtered : state.all;
    const normTokens =
      tokens && tokens.length
        ? tokens
        : normalizeText(q).split(/\s+/).filter(Boolean);

    const ranked = [];

    for (const svc of base) {
      const score = computeMatchScore(svc, normTokens);
      if (score <= 0) continue;
      ranked.push({ svc, score });
    }

    ranked.sort((a, b) => b.score - a.score);
    renderSuggestions(ranked.slice(0, 8).map((r) => r.svc));
  }

  function clearSuggestions() {
    if (!ui.suggestions) return;
    ui.suggestions.innerHTML = "";
    ui.suggestions.hidden = true;
  }

  function renderSuggestions(list) {
  if (!ui.suggestions) return;
  ui.suggestions.innerHTML = "";
  if (!list.length) return clearSuggestions();

  list.forEach((svc) => {
    const b = document.createElement("button");
    b.type = "button";

    b.innerHTML = `
      <div class="sugg-main">
        <span class="sugg-name">${svc.name}</span>
        <span class="sugg-region">${regionLabel(svc.region)}</span>
      </div>
      <span class="sugg-url">${svc.url}</span>
    `;

    b.addEventListener("click", () => {
      if (ui.input) {
        ui.input.value = svc.name;
      }
      state.query = svc.name;
      applyFilters();
      clearSuggestions();
    });

    ui.suggestions.appendChild(b);
  });

  ui.suggestions.hidden = false;
}


  document.addEventListener("click", (ev) => {
    if (!ui.suggestions || ui.suggestions.hidden) return;
    const inside =
      ui.suggestions.contains(ev.target) ||
      (ui.input && ui.input.contains(ev.target));
    if (!inside) clearSuggestions();
  });

  // ------------- Bind UI -------------
  function bindUI() {
    ui.input       = document.querySelector(".search-input-wrap input");
    ui.results     = document.getElementById("search-results");
    ui.matches     = document.querySelector(".search-meta strong");
    ui.suggestions = document.querySelector("[data-suggestions]");
    ui.loadingDot  = document.querySelector("[data-search-loading]");
    ui.regionTabs  = Array.from(document.querySelectorAll(".region-tab"));
    ui.filterChips = Array.from(document.querySelectorAll(".filter-chip"));

    ui.modal       = document.querySelector("[data-service-modal]");
    ui.modalTitle  = document.querySelector("[data-modal-title]");
    ui.modalSubtitle = document.querySelector("[data-modal-subtitle]");
    ui.modalRegion = document.querySelector("[data-modal-region]");
    ui.modalRegionBadge = document.querySelector("[data-modal-region-badge]");
    ui.modalCategory = document.querySelector("[data-modal-category]");
    ui.modalDesc   = document.querySelector("[data-modal-desc]");
    ui.modalOpen   = document.querySelector("[data-modal-open-link]");
    ui.modalCopy   = document.querySelector("[data-modal-copy]");
    ui.modalQR     = document.querySelector("[data-modal-qr-wrap]");
    ui.modalQRimg  = document.querySelector("[data-modal-qr]");

    ui.toast       = document.querySelector("[data-udsal-toast]");
    ui.toastText   = ui.toast
      ? ui.toast.querySelector("[data-udsal-toast-text]")
      : null;

    ui.didYouMeanBox = document.getElementById("did-you-mean");

    if (ui.input) {
      ui.input.addEventListener("input", (e) => {
        state.query = e.target.value || "";
        applyFilters();
      });
    }

    ui.regionTabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.region = btn.dataset.region || "all";
        ui.regionTabs.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
        applyFilters();
      });
    });

    ui.filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const k = chip.dataset.filter;
        if (!k) return;
        if (chip.classList.contains("is-on")) {
          chip.classList.remove("is-on");
          state.filters.delete(k);
        } else {
          chip.classList.add("is-on");
          state.filters.add(k);
        }
        applyFilters();
      });
    });

    if (ui.modal) {
      ui.modal.addEventListener("click", (ev) => {
        if (ev.target === ui.modal) closeModal();
      });
    }

    const closeBtn = document.querySelector("[data-modal-close]");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (ui.modalCopy) ui.modalCopy.addEventListener("click", copyLink);

    document.addEventListener("keyup", (ev) => {
      if (ev.key === "Escape") closeModal();
    });
  }

  // ------------- Load services -------------
  async function loadServices() {
    try {
      const res = await fetch(SERVICES_JSON_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(res.status + " " + res.statusText);
      const data = await res.json();

      let list = [];

      if (Array.isArray(data)) {
        list = data;
      } else if (Array.isArray(data.services)) {
        list = data.services;
      } else if (data && typeof data === "object") {
        for (const key of Object.keys(data)) {
          const val = data[key];
          if (Array.isArray(val)) {
            list = list.concat(
              val.map((svc) => normalizeService(svc, key))
            );
          }
        }
        state.all = list;
        applyFilters();
        return;
      }

      state.all = list.map((svc) => normalizeService(svc));
      applyFilters();
    } catch (err) {
      console.error("Deep Search JSON error:", err);
      showToast("تعذّر تحميل قائمة الخدمات حالياً.");
      state.all = [];
      state.filtered = [];
      renderResults();
    }
  }

  function init() {
    bindUI();
    loadServices();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
