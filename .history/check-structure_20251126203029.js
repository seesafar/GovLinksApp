// check-structure.js
// ===============================
// OneLink · Project Structure Checker
// فحص تلقائي ليتأكد أن الملفات الأساسية تحت docs
// ويكشف النسخ المكررة خارج docs
// ===============================

const fs = require("fs");
const path = require("path");

// 📌 مجلد المشروع (المكان الحالي للملف)
const ROOT = __dirname;
// 📂 مجلد docs الرسمي
const DOCS_DIR = path.join(ROOT, "docs");



// ✅ مجلدات مهمة داخل docs (لو حاب تتأكد منها)
const requiredDirsInDocs = [
  "assets",
  "assets/icons",
  "css"
];

// 🧠 دالة تساعدنا نطبع سطر ملون (أبسط شيء بدون مكتبات)
function logStatus(status, msg) {
  const colors = {
    OK: "\x1b[32m",      // أخضر
    MISSING: "\x1b[31m", // أحمر
    WARN: "\x1b[33m",    // أصفر
    RESET: "\x1b[0m"
  };
  const color = colors[status] || colors.RESET;
  console.log(color + `[${status}]` + colors.RESET + " " + msg);
}

// 🧾 فحص وجود المجلد docs
if (!fs.existsSync(DOCS_DIR)) {
  logStatus("MISSING", `Folder "docs" not found at: ${DOCS_DIR}`);
  process.exit(1);
}

// ===============================
// الجزء الأول: التأكد من وجود الملفات تحت docs
// ===============================
console.log("\n=== Checking required files in docs/ ===\n");

for (const fileName of requiredFilesInDocs) {
  const fullPath = path.join(DOCS_DIR, fileName);
  if (fs.existsSync(fullPath)) {
    logStatus("OK", `docs/${fileName}`);
  } else {
    logStatus("MISSING", `docs/${fileName}`);
  }
}

console.log("\n=== Checking important directories in docs/ ===\n");

for (const dirRelPath of requiredDirsInDocs) {
  const fullPath = path.join(DOCS_DIR, dirRelPath);
  if (fs.existsSync(fullPath)) {
    logStatus("OK", `docs/${dirRelPath}/`);
  } else {
    logStatus("MISSING", `docs/${dirRelPath}/`);
  }
}

// ===============================
// الجزء الثاني: البحث عن نسخ مكررة خارج docs
// ===============================
console.log("\n=== Searching for duplicate files outside docs/ ===\n");

// نبني خريطة: اسم الملف -> جميع المسارات اللي تحمل نفس الاسم
const fileMap = new Map();

// دالة تمشي على كل الملفات والمجلدات (recursive)
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // تخطي مجلدات ما نحتاجها
    if (entry.isDirectory()) {
      const skip = [
        "node_modules",
        ".git",
        ".history",
        ".vscode"
      ];

      if (skip.includes(entry.name)) continue;

      walk(fullPath);
    } else {
      const fileName = entry.name;

      // نهتم فقط بالأسماء اللي في قائمة requiredFilesInDocs
      if (requiredFilesInDocs.includes(fileName)) {
        if (!fileMap.has(fileName)) {
          fileMap.set(fileName, []);
        }
        fileMap.get(fileName).push(fullPath);
      }
    }
  }
}

// نبدأ من جذر المشروع
walk(ROOT);

// الآن نراجع كل ملف ونتأكد هل له نسخة برا docs؟
for (const [fileName, paths] of fileMap.entries()) {
  const pathsOutsideDocs = paths.filter(p => !p.includes(path.sep + "docs" + path.sep));

  if (pathsOutsideDocs.length > 0) {
    logStatus(
      "WARN",
      `File "${fileName}" also exists OUTSIDE docs: \n  - ` +
        pathsOutsideDocs.map(p => path.relative(ROOT, p)).join("\n  - ")
    );
  } else {
    // لو حاب تعرف أنه نظيف بدون نسخ برا docs، فعّل السطر تحت
    // logStatus("OK", `"${fileName}" exists only under docs/`);
  }
}

console.log("\n=== Done. Review the warnings above (if any). ===\n");
