from flask import Flask, send_from_directory, request, abort
import os
import time
import logging

# =========================
# إعداد Flask
# =========================
app = Flask(__name__, static_folder="assets/project-folder")

# =========================
# إعداد الـ Security Logging
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SECURITY_LOG = os.path.join(BASE_DIR, "security.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(SECURITY_LOG, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

# =========================
# إعداد الـ Rate Limiting
# =========================
RATE_LIMIT_WINDOW = 60        # مدة النافذة بالثواني (هنا: 60 ثانية)
RATE_LIMIT_MAX = 120          # أقصى عدد طلبات لكل IP داخل النافذة
_ip_hits = {}                 # ذاكرة مؤقتة للطلبات لكل IP


def check_rate_limit():
    """بسيطة، تمنع السبام على السيرفر."""
    ip = request.remote_addr or "unknown"
    now = time.time()

    hits = _ip_hits.get(ip, [])
    # نحذف الطلبات القديمة خارج النافذة
    hits = [t for t in hits if now - t < RATE_LIMIT_WINDOW]
    hits.append(now)
    _ip_hits[ip] = hits

    if len(hits) > RATE_LIMIT_MAX:
        logging.warning(f"[RATE_LIMIT] IP {ip} exceeded limit on path {request.path}")
        abort(429, description="Too many requests, please slow down.")


@app.before_request
def security_before_request():
    """
    فلتر أمني بسيط يشتغل قبل كل طلب:
    - يطبّق Rate Limit
    - لاحقاً نقدر نضيف فيه فلاتر إضافية (مثل فحص User-Agent أو غيره)
    """
    check_rate_limit()


@app.errorhandler(429)
def too_many_requests(e):
    msg = (
        "Too many requests. Please slow down.\n"
        "عدد الطلبات كبير جدًا، الرجاء المحاولة لاحقًا."
    )
    return msg, 429


# =========================
# المسارات الأساسية
# =========================

# الصفحة الرئيسية
@app.route("/")
def home():
    return send_from_directory("assets/project-folder", "index.html")


# أي ملف داخل مجلد المشروع (HTML / CSS / JS / صور / ...الخ)
@app.route("/<path:filename>")
def serve_static(filename):
    return send_from_directory("assets/project-folder", filename)


if __name__ == "__main__":
    app.run(debug=True, port=5000)
