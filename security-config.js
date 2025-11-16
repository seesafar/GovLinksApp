// security-config.js
// ===============================
// مركز إعدادات أمان OneLink
// ===============================

const path = require("path");

// 🔐 مفتاح لوحة التحكم الأمنية (Security Dashboard)
const ADMIN_DASHBOARD_KEY = "OneLink_Admin_2025_OnlySafar";



// 🌍 الدومينات الموثوقة لإعادة التوجيه الأمن
const ALLOWED_REDIRECT_DOMAINS = [
  "absher.sa",
  "my.gov.sa",
  "najiz.sa",
  "tawakkalna.sdaia.gov.sa",
  "gov.sa",
  "sa" // احتياط للروابط المختصرة
];

// ⚙️ إعدادات Rate Limiting (منع الطلبات المفرطة)
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5000,
};
// 🚫 إعدادات الحظر التلقائي (AutoBan)
const AUTOBAN_CONFIG = {
  enabled: true,               // تفعيل الحظر
  windowMs: 10 * 60 * 1000,    // نافذة القياس: 10 دقائق
  maxStrikes: 6,               // كم ضربة قبل الحظر
  banMinutes: 30,              // مدة الحظر: 30 دقيقة
  // الأحداث التي تُسجِّل ضربة
  strikeOn: [
    "UNAUTHORIZED_ADMIN_API",
    "UNAUTHORIZED_DASHBOARD_ACCESS",
    "RATE_LIMIT_BLOCK",
    "BLOCKED_REDIRECT"
  ],
  // عناوين لا تُحظر (بياض)
  whitelist: ["127.0.0.1", "::1"]
};

// 🧾 مسار ملف اللوقات
const LOG_FILE_PATH = path.join(__dirname, "logs", "security.log");

// 📁 مسار ملف الخدمات (للإدارة عبر لوحة التحكم)
const SERVICES_FILE_PATH = path.join(__dirname, "services-data.json");
// كلمة مرور لوحة الإدارة (نفس اللي تكتبها في صفحة admin-services)
const ADMIN_PANEL_KEY = "OneLink_Admin_2025_OnlySafar";

// سرّ التوقيع الخاص بالتوكن (طوّلها وغير النص اللي تحت)
const ADMIN_TOKEN_SECRET = "S_OneLink_Safar_SuperSecret_Token_Key_2025_OnlyServer";

// مدة صلاحية التوكن بالدقائق
const ADMIN_TOKEN_TTL_MIN = 30;


module.exports = {
  ADMIN_DASHBOARD_KEY,
  ADMIN_PANEL_KEY,
  ADMIN_TOKEN_SECRET,
  ADMIN_TOKEN_TTL_MIN,
  ALLOWED_REDIRECT_DOMAINS,
  RATE_LIMIT_CONFIG,
  LOG_FILE_PATH,
  SERVICES_FILE_PATH,
  AUTOBAN_CONFIG,            // ✅ أضف هذا
};
