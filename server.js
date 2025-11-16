// ================================
// OneLink Security Server (server.js)
// ================================

// 0) بيئة + ثوابت
require("dotenv").config();
const ORIGIN = process.env.PUBLIC_ORIGIN || "http://localhost:3000";

// 1) استدعاء الحزم
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const multer = require("multer");
const bcrypt = require("bcryptjs");

// 2) الإعدادات العامة من security-config.js
const {
  ADMIN_DASHBOARD_KEY,
  ALLOWED_REDIRECT_DOMAINS,
  RATE_LIMIT_CONFIG,
  LOG_FILE_PATH,
  SERVICES_FILE_PATH,
  AUTOBAN_CONFIG,
} = require("./security-config");

// 3) إنشاء التطبيق
const app = express();
const PORT = 3000;

// 4) أمان + JSON + CORS + كوكيز
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],               // سكربت خارجي فقط
      "style-src": ["'self'", "'unsafe-inline'"], // مؤقتًا للـ CSS inline
      "img-src": ["'self'", "data:"],
      "connect-src": ["'self'"],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
    }
  },
  referrerPolicy: { policy: "no-referrer" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));

app.use(express.json());
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(cookieParser());

// 5) Rate Limiting عالمي + خاص بالإدارة
app.use(rateLimit({
  windowMs: RATE_LIMIT_CONFIG.windowMs,
  max: RATE_LIMIT_CONFIG.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent("RATE_LIMIT_BLOCK", req, { message: "Too many requests" });
    res.status(429).json({ status: "error", message: "تم إيقاف طلباتك مؤقتاً بسبب كثرة المحاولات." });
  },
}));

const adminLimiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 300 });
app.use("/api/admin", adminLimiter);

// 6) مجلدات + ملفات ثابتة
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const iconsDir = path.join(__dirname, "assets", "icons");
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

// خدمة الواجهة الأمامية
app.use(express.static(path.join(__dirname, "assets", "project-folder")));
// نخدم مجلد الواجهة على الجذر /
app.use(express.static(path.join(__dirname, "assets", "project-folder")));

// مسارات مختصرة تفتح نفس الصفحة
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "assets", "project-folder", "admin-services.html"));
});
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "assets", "project-folder", "admin-services.html"));
});

// 7) تسجيل أحداث أمنية
function logSecurityEvent(type, req, extra = {}) {
  const logEntry = {
    time: new Date().toISOString(),
    ip: req.ip,
    path: req.originalUrl,
    method: req.method,
    type,
    userAgent: req.headers["user-agent"] || "",
    ...extra,
  };
  fs.appendFile(LOG_FILE_PATH, JSON.stringify(logEntry) + "\n", (err) => {
    if (err) console.error("Error writing to log file:", err);
  });
}

// 8) AutoBan
const ipStrikes = new Map(); // ip -> { count, firstTs, bannedUntil }
const now = () => Date.now();

function getClientIp(req) {
  const raw = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
    .toString().split(",")[0].trim();
  return raw || "0.0.0.0";
}
function isWhitelisted(ip) { return AUTOBAN_CONFIG?.whitelist?.includes?.(ip); }
function isBanned(ip) { const rec = ipStrikes.get(ip); return !!(rec && rec.bannedUntil && rec.bannedUntil > now()); }
function resetWindowIfExpired(rec) {
  if (rec.firstTs + AUTOBAN_CONFIG.windowMs <= now()) { rec.count = 0; rec.firstTs = now(); }
}
function addStrike(ip, reason = "GENERIC") {
  if (!AUTOBAN_CONFIG.enabled || isWhitelisted(ip)) return;
  const rec = ipStrikes.get(ip) || { count: 0, firstTs: now(), bannedUntil: 0 };
  resetWindowIfExpired(rec);
  rec.count += 1;
  try {
    fs.appendFileSync(LOG_FILE_PATH, `[${new Date().toISOString()}] AUTOBAN_STRIKE ip=${ip} reason=${reason} count=${rec.count}\n`, "utf8");
  } catch {}
  if (rec.count >= AUTOBAN_CONFIG.maxStrikes) {
    rec.bannedUntil = now() + AUTOBAN_CONFIG.banMinutes * 60 * 1000;
    try {
      fs.appendFileSync(LOG_FILE_PATH, `[${new Date().toISOString()}] AUTOBAN_BAN ip=${ip} minutes=${AUTOBAN_CONFIG.banMinutes}\n`, "utf8");
    } catch {}
  }
  ipStrikes.set(ip, rec);
}
function autobanGate(req, res, next) {
  const ip = getClientIp(req);
  req._clientIp = ip;
  if (AUTOBAN_CONFIG.enabled && !isWhitelisted(ip) && isBanned(ip)) {
    return res.status(429).json({ status: "blocked", reason: "autoban", until: ipStrikes.get(ip).bannedUntil });
  }
  next();
}
app.use(autobanGate);

// 9) جلسات الإدارة + CSRF
const ADMIN_COOKIE_NAME = "ol_admin";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // ساعتان
const adminSessions = new Map(); // sid -> { csrf, expiresAt }

function makeId(n = 16) { return crypto.randomBytes(n).toString("hex"); }
function setAdminCookie(res, sid) {
  res.cookie(ADMIN_COOKIE_NAME, sid, {
    httpOnly: true,
    sameSite: "strict",
    secure: ORIGIN.startsWith("https"),
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}
function requireAdminSession(req, res, next) {
  const sid = req.cookies[ADMIN_COOKIE_NAME];
  const sess = sid && adminSessions.get(sid);
  if (!sess || sess.expiresAt < Date.now()) {
    if (sid) adminSessions.delete(sid);
    return res.status(401).json({ status: "auth_required" });
  }
  if (["POST","PUT","PATCH","DELETE"].includes(req.method)) {
    const token = req.headers["x-csrf-token"];
    if (!token || token !== sess.csrf) return res.status(403).json({ status: "csrf_invalid" });
  }
  sess.expiresAt = Date.now() + SESSION_TTL_MS; // تجديد
  adminSessions.set(sid, sess);
  next();
}
function requireAdmin(req, res, next) { return requireAdminSession(req, res, next); }

// 10) تسجيل الدخول/الخروج (bcrypt)
app.post("/api/admin/login", async (req, res) => {
  const { password } = req.body || {};
  const hash = process.env.ADMIN_PANEL_KEY_HASH || "";
  const ok = password && hash && await bcrypt.compare(password, hash);
  if (!ok) {
    logSecurityEvent("ADMIN_LOGIN_FAIL", req, {});
    return res.status(401).json({ status: "invalid_credentials" });
  }
  const sid = makeId(16);
  const csrf = makeId(16);
  adminSessions.set(sid, { csrf, expiresAt: Date.now() + SESSION_TTL_MS });
  setAdminCookie(res, sid);
  logSecurityEvent("ADMIN_LOGIN_OK", req, {});
  res.json({ status: "ok", csrf });
});
app.post("/api/admin/logout", requireAdmin, (req, res) => {
  const sid = req.cookies[ADMIN_COOKIE_NAME];
  if (sid) adminSessions.delete(sid);
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
  res.json({ status: "ok" });
});

// 11) إدارة الخدمات (قراءة/كتابة JSON)
function readServices() {
  try {
    if (!fs.existsSync(SERVICES_FILE_PATH)) return [];
    const raw = fs.readFileSync(SERVICES_FILE_PATH, "utf8");
    if (!raw.trim()) return [];
    return JSON.parse(raw);
  } catch (err) { console.error("Error reading services file:", err); return []; }
}
function backupServices() {
  try {
    if (fs.existsSync(SERVICES_FILE_PATH)) {
      fs.copyFileSync(SERVICES_FILE_PATH, SERVICES_FILE_PATH + ".bak");
    }
  } catch {}
}
function writeServices(services) {
  try {
    backupServices();
    fs.writeFileSync(SERVICES_FILE_PATH, JSON.stringify(services, null, 2), "utf8");
  } catch (err) { console.error("Error writing services file:", err); }
}
function validateServicePayload(p) {
  const errors = [];
  const idOk = typeof p.id === "string" && /^[a-z0-9_-]{2,40}$/i.test(p.id);
  if (!idOk) errors.push("id: 2-40 حروف/أرقام/شرطة/شرطة سفلية فقط");
  const arOk = typeof p.nameAr === "string" && p.nameAr.trim().length >= 2;
  if (!arOk) errors.push("nameAr مفقود/قصير");
  const urlOk = typeof p.url === "string" && /^https:\/\/[^ ]+$/i.test(p.url);
  if (!urlOk) errors.push("url يجب أن يبدأ بـ https://");
  if (p.icon && !/^\/icons\/[^ ]+\.(png|jpg|jpeg|svg|webp)$/i.test(p.icon)) {
    errors.push("icon يجب أن يكون داخل /icons/ وبامتداد صحيح");
  }
  if (p.order && !(Number.isInteger(p.order) && p.order >= 1 && p.order <= 10000)) {
    errors.push("order رقم صحيح من 1 إلى 10000");
  }
  return errors;
}

// GET all
app.get("/api/admin/services", requireAdmin, (req, res) => {
  const list = readServices().sort((a, b) => (a.order || 0) - (b.order || 0));
  res.json({ status: "ok", data: list });
});

// POST create
app.post("/api/admin/services", requireAdmin, (req, res) => {
  const { id, nameAr, nameEn, category, url, icon, enabled, order } = req.body || {};
  const errs = validateServicePayload({ id, nameAr, url, icon, order });
  if (errs.length) return res.status(400).json({ status: "error", message: errs.join(" | ") });

  const services = readServices();
  if (services.find((s) => s.id === id)) {
    return res.status(400).json({ status: "error", message: "يوجد خدمة بنفس المعرف (id) مسبقاً." });
  }

  const newService = {
    id,
    nameAr,
    nameEn: nameEn || "",
    category: category || "غير مصنفة",
    url,
    icon: icon || "",
    enabled: enabled !== false,
    order: order || services.length + 1,
  };
  services.push(newService);
  writeServices(services);
  logSecurityEvent("ADMIN_ADD_SERVICE", req, { id, url });
  res.json({ status: "ok", data: newService });
});

// PUT update
app.put("/api/admin/services/:id", requireAdmin, (req, res) => {
  const serviceId = req.params.id;
  const updates = req.body || {};
  const services = readServices();
  const idx = services.findIndex((s) => s.id === serviceId);
  if (idx === -1) return res.status(404).json({ status: "error", message: "الخدمة غير موجودة." });

  const merged = { ...services[idx], ...updates, id: services[idx].id };
  const errs = validateServicePayload({
    id: merged.id, nameAr: merged.nameAr, url: merged.url, icon: merged.icon, order: merged.order,
  });
  if (errs.length) return res.status(400).json({ status: "error", message: errs.join(" | ") });

  services[idx] = merged;
  writeServices(services);
  logSecurityEvent("ADMIN_UPDATE_SERVICE", req, { id: serviceId });
  res.json({ status: "ok", data: services[idx] });
});

// PATCH toggle
app.patch("/api/admin/services/:id/toggle", requireAdmin, (req, res) => {
  const serviceId = req.params.id;
  const services = readServices();
  const idx = services.findIndex((s) => s.id === serviceId);
  if (idx === -1) return res.status(404).json({ status: "error", message: "الخدمة غير موجودة." });

  services[idx].enabled = !services[idx].enabled;
  writeServices(services);
  logSecurityEvent("ADMIN_TOGGLE_SERVICE", req, { id: serviceId, enabled: services[idx].enabled });
  res.json({ status: "ok", data: services[idx] });
});

// DELETE remove
app.delete("/api/admin/services/:id", requireAdmin, (req, res) => {
  const serviceId = req.params.id;
  const services = readServices();
  const idx = services.findIndex((s) => s.id === serviceId);
  if (idx === -1) return res.status(404).json({ status: "error", message: "الخدمة غير موجودة." });

  const removed = services.splice(idx, 1)[0];
  writeServices(services);
  logSecurityEvent("ADMIN_DELETE_SERVICE", req, { id: serviceId });
  res.json({ status: "ok", data: removed });
});

// 12) رفع الأيقونات (multer) — تأمين النوع والحجم
const upload = multer({
  storage: multer.diskStorage({
    destination: (_, __, cb) => cb(null, iconsDir),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}_${crypto.randomBytes(4).toString("hex")}${ext}`);
    },
  }),
  fileFilter: (_, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"].includes(file.mimetype);
    cb(ok ? null : new Error("INVALID_FILETYPE"));
  },
  limits: { fileSize: 512 * 1024 },
});
app.post("/api/admin/upload-icon", requireAdmin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ status: "error", message: "لم يتم رفع ملف." });
  const rel = `/icons/${path.basename(req.file.path)}`;
  logSecurityEvent("ADMIN_UPLOAD_ICON", req, { file: rel, size: req.file.size });
  res.json({ status: "ok", path: rel });
});

// 13) Smart Redirect API
app.post("/api/safe-redirect", (req, res) => {
  const { url } = req.body || {};
  try {
    if (!url) return res.status(400).json({ status: "error", message: "Missing URL" });
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isAllowed = ALLOWED_REDIRECT_DOMAINS.some((d) => hostname.endsWith(d.toLowerCase()));
    if (!isAllowed) {
      logSecurityEvent("BLOCKED_REDIRECT", req, { url });
      addStrike(req._clientIp || getClientIp(req), "UNSAFE_REDIRECT");
      return res.status(400).json({ status: "blocked", message: "تم حظر إعادة التوجيه. الرابط غير موثوق وقد تم تسجيل المحاولة." });
    }
    logSecurityEvent("ALLOWED_REDIRECT", req, { url });
    return res.json({ status: "ok", redirectTo: url });
  } catch (e) {
    logSecurityEvent("REDIRECT_ERROR", req, { error: e.message, url });
    return res.status(400).json({ status: "error", message: "رابط غير صالح." });
  }
});

// 14) استقبال تقارير أمنية من الواجهة
app.post("/api/security/report-incident", (req, res) => {
  const { reason, details } = req.body || {};
  logSecurityEvent("CLIENT_INCIDENT", req, { reason, details });
  addStrike(req._clientIp || getClientIp(req), "CLIENT_INCIDENT");
  res.json({ status: "ok" });
});

// 15) Security Dashboard (HTML)
app.get("/admin-security", (req, res) => {
  const key = req.query.key;
  if (key !== ADMIN_DASHBOARD_KEY) {
    logSecurityEvent("UNAUTHORIZED_DASHBOARD_ACCESS", req, { keyAttempt: key || "" });
    return res.status(403).send("<h1>Access Denied</h1>");
  }

  const escapeHtml = (s = "") => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  fs.readFile(LOG_FILE_PATH, "utf8", (err, data) => {
    let events = [];
    if (!err && data && data.trim()) {
      for (const line of data.split("\n").filter(Boolean)) {
        try { events.push(JSON.parse(line)); } catch {}
      }
    }
    events.sort((a,b)=> new Date(b.time) - new Date(a.time));
    const MAX_EVENTS = 300;
    const visible = events.slice(0, MAX_EVENTS);

    const countByType = {};
    for (const ev of events) { const t = ev.type || "UNKNOWN"; countByType[t] = (countByType[t] || 0) + 1; }

    const htmlRows = visible.map(ev => {
      const time = escapeHtml(ev.time||"");
      const ip = escapeHtml(ev.ip||"");
      const pathVal = escapeHtml(ev.path||"");
      const method = escapeHtml(ev.method||"");
      const type = escapeHtml(ev.type||"UNKNOWN");
      const ua = escapeHtml(ev.userAgent||"");
      const extra = escapeHtml(ev.url || ev.details || ev.message || ev.reason || "");
      const short = extra.length>120 ? extra.slice(0,117)+"..." : extra;

      let badge = "badge-other";
      if (type.includes("BLOCKED_REDIRECT") || type.includes("UNSAFE")) badge = "badge-block";
      else if (type.includes("ALLOWED")) badge = "badge-allow";
      else if (type.includes("RATE_LIMIT")) badge = "badge-rate";
      else if (type.includes("UNAUTHORIZED")) badge = "badge-unauth";

      return `<tr>
        <td>${time}</td>
        <td>${ip}</td>
        <td><span class="badge ${badge}">${type}</span></td>
        <td><code>${method}</code></td>
        <td class="path-cell">${pathVal}</td>
        <td class="details-cell">${short}</td>
        <td class="ua-cell" title="${ua}">عرض</td>
      </tr>`;
    }).join("");

    const blockedRedirects = (countByType["BLOCKED_REDIRECT"]||0) + (countByType["BLOCKED_UNSAFE_REDIRECT"]||0);
    const allowedRedirects = countByType["ALLOWED_REDIRECT"]||0;
    const rateLimitBlocks = countByType["RATE_LIMIT_BLOCK"]||0;

    const tableSection = visible.length
      ? `<table dir="rtl"><thead><tr>
           <th>الوقت</th><th>IP</th><th>نوع الحدث</th><th>الطريقة</th>
           <th>المسار</th><th>تفاصيل إضافية</th><th>المتصفح / الجهاز</th>
         </tr></thead><tbody>${htmlRows}</tbody></table>`
      : '<div class="empty-state">لا توجد أحداث أمنية مسجلة حتى الآن.</div>';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8" />
<title>OneLink · Security Dashboard</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(circle at top left,#0f172a,#020617);color:#e5e7eb;padding:24px}
header{display:flex;flex-direction:column;gap:8px;margin-bottom:24px}
.title{font-size:1.8rem;font-weight:700;color:#38bdf8}.subtitle{font-size:.95rem;color:#9ca3af}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.chip{padding:4px 10px;border-radius:999px;background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.35);font-size:.75rem;display:inline-flex;align-items:center;gap:6px}
.chip span{font-weight:600;color:#e5e7eb}.chip small{color:#9ca3af}
.badge{display:inline-flex;align-items:center;justify-content:center;padding:2px 8px;border-radius:999px;font-size:.72rem;font-weight:600;letter-spacing:.02em;text-transform:uppercase;border:1px solid transparent}
.badge-block{background:rgba(248,113,113,.14);color:#fecaca;border-color:rgba(248,113,113,.6)}
.badge-rate{background:rgba(251,146,60,.14);color:#fed7aa;border-color:rgba(251,146,60,.6)}
.badge-allow{background:rgba(34,197,94,.14);color:#bbf7d0;border-color:rgba(34,197,94,.6)}
.badge-unauth{background:rgba(129,140,248,.12);color:#c7d2fe;border-color:rgba(129,140,248,.6)}
.badge-other{background:rgba(148,163,184,.14);color:#e5e7eb;border-color:rgba(148,163,184,.6)}
.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:20px}
.card{background:rgba(15,23,42,.95);border-radius:16px;padding:12px 14px;border:1px solid rgba(55,65,81,.9);box-shadow:0 18px 40px rgba(15,23,42,.8)}
.card-label{font-size:.8rem;color:#9ca3af;margin-bottom:6px}.card-value{font-size:1.4rem;font-weight:700}.card-tag{font-size:.75rem;margin-top:4px;color:#6b7280}
.card-total .card-value{color:#e5e7eb}.card-block .card-value{color:#fecaca}.card-allow .card-value{color:#bbf7d0}.card-rate .card-value{color:#fed7aa}
.table-wrapper{margin-top:8px;border-radius:16px;border:1px solid rgba(55,65,81,.9);overflow:hidden;background:rgba(15,23,42,.96);box-shadow:0 22px 50px rgba(15,23,42,.9)}
table{width:100%;border-collapse:collapse;font-size:.82rem}thead{background:linear-gradient(to left,#0f172a,#020617)}
th,td{padding:8px 10px;text-align:right;border-bottom:1px solid rgba(31,41,55,.85);vertical-align:top}
th{font-weight:600;color:#9ca3af;position:sticky;top:0;backdrop-filter:blur(8px);z-index:2}
tbody tr:nth-child(even) td{background:rgba(15,23,42,.9)}tbody tr:nth-child(odd) td{background:rgba(2,6,23,.96)}
tbody tr:hover td{background:rgba(8,47,73,.85)}.path-cell{max-width:260px;word-break:break-all;color:#e5e7eb}
.details-cell{max-width:260px;word-break:break-all;color:#d1d5db}.ua-cell{cursor:help;color:#60a5fa;text-decoration:underline;text-underline-offset:2px;white-space:nowrap;text-align:center}
.empty-state{padding:18px;text-align:center;color:#9ca3af;font-size:.9rem}.footer-note{margin-top:16px;font-size:.75rem;color:#6b7280}
</style>
</head>
<body>
<header>
  <div class="title">OneLink · Security Dashboard</div>
  <div class="subtitle">عرض آخر الأحداث الأمنية (محاولات مشبوهة، إعادة توجيه، Rate Limit، إلخ).</div>
  <div class="chips">
    <div class="chip"><span>إجمالي الأحداث</span><small>${events.length}</small></div>
    <div class="chip"><span>حظر إعادة التوجيه</span><small>${blockedRedirects}</small></div>
    <div class="chip"><span>إعادة توجيه آمنة</span><small>${allowedRedirects}</small></div>
    <div class="chip"><span>Rate Limit</span><small>${rateLimitBlocks}</small></div>
    <div class="chip"><span>المعروضة الآن</span><small>${visible.length} / ${MAX_EVENTS}</small></div>
  </div>
</header>
<section class="table-wrapper">${tableSection}</section>
<div class="footer-note">يمكن تغيير <code>MAX_EVENTS</code> من داخل <code>server.js</code>.</div>
</body></html>`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
});

// 16) Healthcheck
app.get("/healthz", (_, res) => res.json({ ok: true, ts: Date.now() }));

// 17) تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 OneLink Security Server running at http://localhost:${PORT}`);
});
