(() => {
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(window.location.search);

  function notify(title, message) {
    const toast = document.createElement('div');
    toast.className = 'sonara-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<strong>' + clean(title) + '</strong><span>' + clean(message) + '</span>';
    document.body.appendChild(toast);
    window.setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      window.setTimeout(() => toast.remove(), 260);
    }, 5200);
  }

  if (params.get('account') === 'created') {
    notify('Account created', 'You are signed in. Choose Business Builder, Creator Studio, or Growth Studio to start working.');
    if (history.replaceState) history.replaceState(null, '', window.location.pathname);
  }

  if (!reduceMotion) {
    document.querySelectorAll('.card').forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(12px)';
      card.style.transition = 'opacity .34s ease, transform .34s ease';
      window.setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
      }, 70 + index * 38);
    });
  }

  document.documentElement.classList.add('sonara-js-ready');

  function clean(value) {
    return String(value || '').replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[char]));
  }
})();
