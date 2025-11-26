// security-header.js
(function () {
  'use strict';

  // =====================
  // Helpers: Alerts Queue
  // =====================
  const ALERT_KEY = 'onelink_sec_alert';
  function isArabic() {
    try {
      return (document.documentElement.lang || 'ar')
        .toLowerCase()
        .startsWith('ar');
    } catch (_) {
      return true;
    }
  }
  function queueSecurityAlert(message, variant, reason) {
    try {
      const payload = {
        message,
        variant: variant || 'warning',
        reason: reason || null,
        ts: Date.now(),
      };
      sessionStorage.setItem(ALERT_KEY, JSON.stringify(payload));
    } catch (_) {}
  }
  function consumeSecurityAlert() {
    try {
      const raw = sessionStorage.getItem(ALERT_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(ALERT_KEY);
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }
  function showAlertBanner(msg, variant) {
    if (!msg) return;
    const doc = document;
    const ar = isArabic();
    const bar = doc.createElement('div');
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.style.position = 'fixed';
    bar.style.top = '0';
    bar.style.left = '0';
    bar.style.right = '0';
    bar.style.zIndex = '2147483646';
    bar.style.padding = '10px 14px';
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    bar.style.fontFamily = 'Tahoma, Segoe UI, Arial, sans-serif';
    bar.style.fontSize = '14px';
    bar.style.direction = ar ? 'rtl' : 'ltr';
    const palette = {
      info: { bg: '#e6f4ff', fg: '#084298', border: '#b6e0ff' },
      success: { bg: '#e8f5e9', fg: '#1b5e20', border: '#c8e6c9' },
      warning: { bg: '#fff8e1', fg: '#7a4f01', border: '#ffe0b2' },
      danger: { bg: '#ffebee', fg: '#b71c1c', border: '#ffcdd2' },
    };
    const c = palette[variant] || palette.warning;
    bar.style.background = c.bg;
    bar.style.color = c.fg;
    bar.style.borderBottom = '1px solid ' + c.border;

    const text = doc.createElement('div');
    text.textContent = msg;

    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.textContent = ar ? 'إغلاق' : 'Close';
    btn.setAttribute('aria-label', ar ? 'إغلاق التنبيه' : 'Dismiss alert');
    btn.style.marginInlineStart = '12px';
    btn.style.padding = '6px 10px';
    btn.style.border = '1px solid ' + c.border;
    btn.style.background = 'transparent';
    btn.style.color = c.fg;
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', () => {
      try {
        bar.remove();
      } catch (_) {}
    });

    bar.append(text, btn);
    (doc.body || doc.documentElement).appendChild(bar);
    setTimeout(() => {
      try {
        bar.remove();
      } catch (_) {}
    }, 6000);
  }
  function ready(fn) {
    if (document.readyState === 'loading')
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  }

  // Show any queued alert on load
  ready(() => {
    const alertPayload = consumeSecurityAlert();
    if (alertPayload && alertPayload.message) {
      showAlertBanner(alertPayload.message, alertPayload.variant);
    }
  });

  // 1) Enforce HTTPS (مع استثناء localhost و 127.0.0.1 أثناء التطوير)
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (!isLocalDev && window.location.protocol === 'http:') {
    queueSecurityAlert(
      isArabic()
        ? 'تم تحويلك تلقائيًا إلى اتصال آمن (HTTPS).'
        : 'You were redirected to a secure (HTTPS) connection.',
      'info',
      'upgrade_https'
    );
    const httpsURL =
      'https://' +
      window.location.host +
      window.location.pathname +
      window.location.search +
      window.location.hash;
    window.location.replace(httpsURL);
    return; // stop further checks on this page load
  }

  // 2) Anti-clickjacking (frame busting)
  try {
    if (window.top !== window.self) {
      queueSecurityAlert(
        isArabic()
          ? 'تم منع تضمين الصفحة داخل إطار للحماية من الهجمات.'
          : 'Embedding in an iframe was blocked to protect you.',
        'warning',
        'frame_ancestors'
      );
      // Try to break out to the top window
      window.top.location = window.location;
    }
  } catch (e) {
    queueSecurityAlert(
      isArabic()
        ? 'تم اكتشاف محاولة وصول غير مصرّح بها.'
        : 'Unauthorized access was detected.',
      'danger',
      'frame_error'
    );
    window.location.href = 'html.403';
  }

  // 3) Allowed hosts whitelist
  (function () {
    const allowedHosts = [
      'localhost',
      '127.0.0.1',
      'onelink-alert-system.example', // demo / sample
      'your-domain.com', // TODO: replace with your actual domain
    ];
    if (!allowedHosts.includes(window.location.hostname)) {
      queueSecurityAlert(
        isArabic()
          ? 'تم رفض الوصول: نطاق غير مصرح.'
          : 'Access denied: untrusted host.',
        'danger',
        'host_not_allowed'
      );
      window.location.href = 'html.403';
    }
  })();

  // 4) (Optional) Surface CSP violations as gentle alerts (dev aid)
  document.addEventListener('securitypolicyviolation', function () {
    queueSecurityAlert(
      isArabic()
        ? 'حظرت سياسة الأمان تحميل مورد مخالف.'
        : 'Security policy blocked a restricted resource.',
      'warning',
      'csp_violation'
    );
  });
})();
