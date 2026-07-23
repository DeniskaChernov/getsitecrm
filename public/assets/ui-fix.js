/**
 * Global UX fixes: Escape closes modals, stale backdrop cleanup, mobile nav overlay.
 */
(function uiFix() {
  function closestBackdrop(el) {
    return el?.closest?.('.modal-backdrop') || null;
  }

  function dismissBackdrop(backdrop) {
    if (!backdrop || !backdrop.isConnected) return;
    const closeBtn =
      backdrop.querySelector('[aria-label*="Закрыть"], [aria-label*="закрыть"], button.close, .modal-close') ||
      [...backdrop.querySelectorAll('button')].find((b) => /закрыть|отмена|cancel/i.test(b.textContent || ''));
    if (closeBtn) {
      closeBtn.click();
      return;
    }
    // Force-remove orphaned backdrop if no close control
    backdrop.remove();
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      const backdrops = [...document.querySelectorAll('.modal-backdrop')];
      if (!backdrops.length) return;
      e.preventDefault();
      dismissBackdrop(backdrops[backdrops.length - 1]);
    },
    true
  );

  document.addEventListener(
    'click',
    (e) => {
      const backdrop = e.target.classList?.contains('modal-backdrop') ? e.target : null;
      if (!backdrop) return;
      // Click on dimmed area (not inside modal form)
      if (e.target === backdrop) dismissBackdrop(backdrop);
    },
    true
  );

  // Cleanup stuck backdrops when React unmount leaves them
  const obs = new MutationObserver(() => {
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach((bd) => {
      if (!bd.querySelector('form, .form-modal, [role="dialog"]')) {
        bd.remove();
      }
    });
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { childList: true, subtree: true });
    });
  }

  // Mobile nav overlay click closes sidebar
  document.addEventListener(
    'click',
    (e) => {
      if (!document.body.classList.contains('gs-nav-open')) return;
      if (e.target.closest('#gs-nav')) return;
      if (e.target.closest('.mobile-menu')) return;
      // ::after overlay is on body — clicks hit elements under; use body listener
      if (e.target === document.body || e.target.classList?.contains('sidebar-scrim')) {
        document.body.classList.remove('gs-nav-open');
      }
    },
    true
  );

  // Dedicated overlay element for reliable mobile dismiss
  function ensureMobileOverlay() {
    let el = document.getElementById('gs-nav-overlay');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'gs-nav-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.addEventListener('click', () => document.body.classList.remove('gs-nav-open'));
    document.body.appendChild(el);
    return el;
  }

  const syncOverlay = () => {
    ensureMobileOverlay();
  };
  syncOverlay();
  new MutationObserver(syncOverlay).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
    subtree: true,
  });
})();
