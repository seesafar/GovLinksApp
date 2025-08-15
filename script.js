// بحث فوري
const search = document.getElementById('search');
const cards = [...document.querySelectorAll('.card')];

search.addEventListener('input', () => {
  const term = search.value.trim().toLowerCase();
  cards.forEach((li, i) => {
    const hit = li.dataset.name.toLowerCase().includes(term);
    li.style.display = hit ? '' : 'none';
    // إعادة تشغيل الأنيميشن عند التصفية
    if (hit) {
      li.style.animation = 'none';
      li.offsetHeight; // reflow
      li.style.animation = `fadeUp .45s ease forwards`;
      li.style.animationDelay = `${Math.min(i, 6) * 60}ms`;
    }
  });
});

// ترتيب دخول البطاقات أول مرة
cards.forEach((li, i) => li.style.animationDelay = `${i*80}ms`);

// زر الطوارئ (تجريبي)
document.getElementById('emergency').addEventListener('click', () => {
  alert('وضع الطوارئ: سيُطلق إشعارات حرجة ويبرز أرقام الطوارئ (قريبًا).');
});
