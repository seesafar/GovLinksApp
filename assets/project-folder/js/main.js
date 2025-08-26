// OneLink - UI interactions
document.addEventListener('DOMContentLoaded', function () {
  // ====== زر القائمة الرئيسية ======
  const menuBtn = document.getElementById('menuToggle');
  const menu    = document.getElementById('mainMenu');
  if (menuBtn && menu) {
    // اخفِ المنسدلة داخلياً في البداية
    menu.classList.remove('is-open');

    menuBtn.addEventListener('click', function () {
      menu.classList.toggle('is-open');
      const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // ====== منسدلة "الخدمات" ======
  const dropBtn = document.querySelector('.dropdown-toggle');
  const drop    = document.getElementById('servicesDropdown');
  if (dropBtn && drop) {
    drop.classList.remove('is-open');

    dropBtn.addEventListener('click', function () {
      drop.classList.toggle('is-open');
      const expanded = dropBtn.getAttribute('aria-expanded') === 'true';
      dropBtn.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // ====== زر الرجوع ======
  const back = document.getElementById('backBtn');
  if (back) {
    back.addEventListener('click', function () {
      if (history.length > 1) history.back();
      else location.href = 'index.html';
    });
  }

  // ====== حركة الاهتزاز العامة ======
  // أي عنصر عليه data-shake="onClick" يهتز ضغطة سريعة
  function shakeElement(el) {
    el.classList.remove('shake'); // لو كانت شغالة قبل
    // إعادة تشغيل الأنيميشن
    void el.offsetWidth;
    el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
  }

  document.querySelectorAll('[data-shake="onClick"]').forEach(el => {
    el.addEventListener('click', () => shakeElement(el));
  });
});



