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

  function closeMobileNav() {
    document.body.classList.remove('gs-nav-open');
    document.querySelectorAll('.mobile-menu').forEach((b) => {
      b.setAttribute('aria-expanded', 'false');
      b.setAttribute('aria-label', 'Открыть меню');
    });
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape') return;
      if (document.body.classList.contains('gs-nav-open')) {
        e.preventDefault();
        closeMobileNav();
        return;
      }
      const adminModal = document.getElementById('gs-user-admin-modal');
      if (adminModal && !adminModal.hidden) {
        e.preventDefault();
        adminModal.hidden = true;
        return;
      }
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

})();
