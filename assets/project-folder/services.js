// services.js
// OneLink · حماية الروابط الخارجية + تنبيهات أمنية

// 🔥 رسالة تحذير عند محاولة فتح رابط غير موثوق
function showHackWarning(details) {
  alert(
    "🚨 تنبيه أمني:\n" +
      "تم رصد محاولة فتح رابط غير آمن أو غير موثوق.\n" +
      "تم تسجيل جهازك ومحاولتك في نظام الحماية الخاص بـ OneLink.\n\n" +
      "التفاصيل: " +
      (details || "رابط غير موثوق.")
  );

  // إرسال بلاغ للسيرفر (يسجل في logs/security.log)
  fetch("/api/security/report-incident", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: "BLOCKED_UNSAFE_REDIRECT",
      details,
    }),
  }).catch(() => {
    // ما نحتاج نسوي شيء هنا، فقط نتجنب كسر الصفحة لو صار خطأ
  });
}

// 🧠 دالة إعادة توجيه آمنة تمر عبر السيرفر
async function safeRedirect(url) {
  try {
    if (!url) {
      showHackWarning("رابط فارغ أو غير محدد.");
      return;
    }

    const res = await fetch("/api/safe-redirect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url }),
    });

    const data = await res.json();

    if (data.status === "ok" && data.redirectTo) {
      // ✅ رابط موثوق → نسمح بالتوجيه
      window.location.href = data.redirectTo;
    } else {
      // ⛔ رابط غير موثوق → نطلق التحذير
      showHackWarning(data.message || "تم إيقاف إعادة التوجيه لرابط غير موثوق.");
    }
  } catch (err) {
    showHackWarning("خطأ أثناء معالجة الرابط. يرجى المحاولة لاحقاً.");
  }
}

// 🧷 نجعل الدوال متاحة في الـ window عشان تشتغل مع onclick في HTML
window.safeRedirect = safeRedirect;
window.showHackWarning = showHackWarning;

// 🧩 (اختياري) ربط تلقائي لأي عنصر يحمل data-service-url
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-service-url]");
  if (!target) return;

  const url = target.getAttribute("data-service-url");
  if (!url) return;

  event.preventDefault();
  safeRedirect(url);
});
