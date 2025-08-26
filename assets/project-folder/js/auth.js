/* =========================================================
   OneLink - auth.js
   إدارة الجلسة + توست إشعارات
   ========================================================= */

(function () {
  const AUTH_KEY = 'auth';

  // ========== Toast ==========
  function ensureToastRoot(){
    let root = document.getElementById('toast-root');
    if(!root){
      root = document.createElement('div');
      root.id = 'toast-root';
      root.setAttribute('aria-live','polite');
      document.body.appendChild(root);
    }
    return root;
  }

  function showToast(message, type='success'){
    const root = ensureToastRoot();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.textContent = message;
    root.appendChild(el);
    // الإزالة بعد الحركة
    setTimeout(() => {
      el.remove();
    }, 4000);
  }
  // متاح عامًا عند الحاجة من ملفات أخرى
  window.showToast = showToast;

  // ========== تخزين ==========
  function setAuth(user){ localStorage.setItem(AUTH_KEY, JSON.stringify(user)); }
  function getAuth(){
    try{ return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
    catch{ return null; }
  }
  function clearAuth(){ localStorage.removeItem(AUTH_KEY); }
  function isAuthed(){ return !!getAuth(); }

  // ========== UI ==========
  function updateAuthUI(){
    const user = getAuth();
    document.querySelectorAll('[data-auth="in"]').forEach(el => el.style.display = user ? '' : 'none');
    document.querySelectorAll('[data-auth="out"]').forEach(el => el.style.display = user ? 'none' : '');
    const username = user?.name || user?.email || '';
    document.querySelectorAll('[data-username]').forEach(el => el.textContent = username);
  }

  function nameFromEmail(email){
    if(!email) return '';
    const base = String(email).split('@')[0] || '';
    return base.replace(/[._-]+/g, ' ').trim();
  }

  // ========== خروج ==========
  function logout(redirect = true){
    clearAuth();
    updateAuthUI();
    showToast('تم تسجيل الخروج بنجاح', 'info');
    if(redirect){
      const here = (location.pathname || '').toLowerCase();
      if(!here.endsWith('login.html')) location.href = 'login.html';
    }
  }
  window.logout = logout;

  function wireLogoutButtons(){
    document.querySelectorAll('#logoutLink, #logoutLink2').forEach(btn => {
      btn.addEventListener('click', function(e){
        e.preventDefault();
        logout(true);
      });
    });
  }

  // ========== login.html ==========
  function wireLoginForm(){
    const form = document.getElementById('loginForm');
    if(!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const email = (form.querySelector('#loginEmail')||{}).value || '';
      const password = (form.querySelector('#loginPassword')||{}).value || '';
      if(!email || !password){ showToast('يرجى إدخال البريد وكلمة المرور', 'error'); return; }

      const user = { email, name: nameFromEmail(email) };
      setAuth(user);
      updateAuthUI();
      showToast('تم تسجيل الدخول بنجاح ✅', 'success');
      setTimeout(()=>{ location.href = 'account.html'; }, 600);
    });
  }

  // ========== signup.html ==========
  function wireSignupForm(){
    const form = document.getElementById('signupForm');
    if(!form) return;
    form.addEventListener('submit', function(e){
      e.preventDefault();
      const name = (form.querySelector('#suName')||{}).value || '';
      const email = (form.querySelector('#suEmail')||{}).value || '';
      const password = (form.querySelector('#suPassword')||{}).value || '';
      if(!name || !email || !password){ showToast('يرجى تعبئة جميع الحقول', 'error'); return; }

      const user = { name, email };
      setAuth(user);
      updateAuthUI();
      showToast('تم إنشاء الحساب بنجاح 🎉', 'success');
      setTimeout(()=>{ location.href = 'account.html'; }, 600);
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    updateAuthUI();
    wireLogoutButtons();
    wireLoginForm();
    wireSignupForm();
  });
})();


