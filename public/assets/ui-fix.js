/**
 * Global UX fixes: Escape, stale backdrops, semantic labels for mobile table cards.
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

  function enhanceTableCards() {
    document.querySelectorAll('.table-panel table').forEach((table) => {
      const labels = [...table.querySelectorAll('thead th')].map((cell) =>
        (cell.textContent || '').replace(/\s+/g, ' ').trim()
      );
      if (!labels.length) return;
      table.querySelectorAll('tbody tr').forEach((row) => {
        [...row.children].forEach((cell, index) => {
          if (cell.tagName === 'TD') cell.dataset.label = labels[index] || '';
        });
      });
    });
  }

  let enhanceQueued = false;
  function scheduleEnhanceTableCards() {
    if (enhanceQueued) return;
    enhanceQueued = true;
    requestAnimationFrame(() => {
      enhanceQueued = false;
      enhanceTableCards();
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
    scheduleEnhanceTableCards();
  });
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
    scheduleEnhanceTableCards();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      obs.observe(document.body, { childList: true, subtree: true });
      scheduleEnhanceTableCards();
    });
  }

})();
