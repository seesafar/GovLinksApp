/* core/js/switcher.js
   - يلوّن زر الدولة الحالية في .country-switcher (active)
   - يضبط body.classList حسب الدولة (eg | sa | cn) عند التحميل
   - يحافظ على ?lang= في الروابط عند التنقل بين الدول
   - آمن لو الـcountry-switcher غير موجود
*/

(function () {
  const PATH = location.pathname.replace(/\\/g, "/");
  const LINKS = document.querySelectorAll(".country-switcher a");
  const BODY = document.body;

  // 1) استنتاج الدولة الحالية من المسار
  function detectCountry() {
    if (PATH.includes("/egypt-app/")) return "eg";
    if (PATH.includes("/saudi-app/")) return "sa";
    if (PATH.includes("/china-app/")) return "cn";
    // افتراضي: لا دولة محددة
    return "";
  }

  // 2) إبراز الزر الحالي
  function highlightActive(country) {
    LINKS.forEach(a => a.classList.remove("active"));
    if (!country) return;

    // نحاول مطابقته عبر data-country="eg/sa/cn"
    for (const a of LINKS) {
      const code = (a.getAttribute("data-country") || "").toLowerCase();
      if (code === country) {
        a.classList.add("active");
        break;
      }
    }
  }

  // 3) ضبط class على <body> (يؤثر على ثيم الألوان في base.css)
  function applyBodyClass(country) {
    BODY.classList.remove("eg", "sa", "cn");
    if (country) BODY.classList.add(country);
  }

  // 4) الحفاظ على ?lang= عند الضغط على روابط الدول
  function preserveLangOnLinks() {
    const url = new URL(window.location.href);
    const lang = url.searchParams.get("lang"); // قد تكون null

    LINKS.forEach(a => {
      try {
        const href = new URL(a.getAttribute("href"), window.location.origin);
        if (lang) href.searchParams.set("lang", lang);
        a.setAttribute("href", href.pathname + href.search + href.hash);
      } catch {
        // لو href نسبي بدون origin، نستخدم معالجة بسيطة:
        if (lang) {
          const raw = a.getAttribute("href");
          if (!raw.includes("?")) {
            a.setAttribute("href", raw + "?lang=" + lang);
          } else if (!raw.includes("lang=")) {
            a.setAttribute("href", raw + "&lang=" + lang);
          }
        }
      }
    });
  }

  function boot() {
    const country = detectCountry();
    applyBodyClass(country);
    if (LINKS.length) {
      highlightActive(country);
      preserveLangOnLinks();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
س