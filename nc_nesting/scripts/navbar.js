/**
 * NC Nesting navbar.
 *
 * Usage:
 *   <link rel="stylesheet" href="styles/navbar.css">
 *   <site-navbar data-root="../"></site-navbar>
 *   <script src="scripts/navbar.js"></script>
 *
 * data-root must point from the NC Nesting page to the BIMbee website root.
 * The selected language is stored in localStorage and announced through:
 *   - "bimbee:languagechange"
 *   - "nc-nesting:languagechange"
 */
(() => {
  'use strict';

  const DEFAULT_STORAGE_KEY = 'bimbee-language';
  const SUPPORTED_LANGUAGES = new Set(['en', 'he']);

  const NAV_ITEMS = [
    { key: 'home', href: 'index.html' },
    { key: 'about', href: 'index.html#about-us' },
    { key: 'services', href: 'index.html#services' },
    { key: 'contact', href: 'index.html#contact' },
    { key: 'blog', href: 'BIMBlog/blog.html' }
  ];

  const FALLBACK_TEXT = {
    en: {
      menu: 'Open navigation menu', closeMenu: 'Close navigation menu', navigation: 'Website navigation',
      language: 'Language', home: 'Home', about: 'About Us', services: 'Services', contact: 'Contact', blog: 'BIMblog', brandHome: 'BIMbee home'
    },
    he: {
      menu: 'פתיחת תפריט ניווט', closeMenu: 'סגירת תפריט ניווט', navigation: 'ניווט באתר',
      language: 'שפה', home: 'דף הבית', about: 'אודותינו', services: 'פתרונות ל-BIM', contact: 'צור קשר', blog: 'בימ-בלוג', brandHome: 'דף הבית של BIMbee'
    }
  };

  function navbarText(language) {
    const fallback = FALLBACK_TEXT[language] || FALLBACK_TEXT.en;
    const t = window.NCNestingI18n?.t;
    if (typeof t !== 'function') return fallback;
    return {
      menu: t('nav.menu.open', {}, language),
      closeMenu: t('nav.menu.close', {}, language),
      navigation: t('nav.navigation', {}, language),
      language: t('nav.language', {}, language),
      home: t('nav.home', {}, language),
      about: t('nav.about', {}, language),
      services: t('nav.services', {}, language),
      contact: t('nav.contact', {}, language),
      blog: t('nav.blog', {}, language),
      brandHome: t('brand.home', {}, language)
    };
  }

  function normalizeRoot(value) {
    const root = String(value || './').trim() || './';
    return root.endsWith('/') ? root : `${root}/`;
  }

  function normalizeLanguage(value) {
    const language = String(value || '').trim().toLowerCase().split('-')[0];
    return SUPPORTED_LANGUAGES.has(language) ? language : null;
  }

  function readLanguage(storageKey) {
    try {
      const stored = normalizeLanguage(window.localStorage.getItem(storageKey));
      if (stored) return stored;
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }

    return normalizeLanguage(document.documentElement.lang) || 'en';
  }

  function writeLanguage(storageKey, language) {
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {
      // Language still applies for the current page when storage is unavailable.
    }
  }

  function updateLegacyLanguageElements(language) {
    document.querySelectorAll('.lang-en, .lang-he').forEach((element) => {
      const matches = element.classList.contains(`lang-${language}`);
      element.hidden = !matches;

      // Remove old inline display:none rules when an element becomes active.
      if (matches && element.style.display === 'none') {
        element.style.removeProperty('display');
      }
    });
  }

  function announceLanguage(language) {
    const detail = {
      language,
      direction: language === 'he' ? 'rtl' : 'ltr'
    };

    window.dispatchEvent(new CustomEvent('bimbee:languagechange', { detail }));
    window.dispatchEvent(new CustomEvent('nc-nesting:languagechange', { detail }));
  }

  class SiteNavbar extends HTMLElement {
    connectedCallback() {
      if (this.dataset.initialized === 'true') return;
      this.dataset.initialized = 'true';

      this.rootPath = normalizeRoot(this.getAttribute('data-root'));
      this.storageKey = this.getAttribute('data-language-storage-key') || DEFAULT_STORAGE_KEY;
      this.language = readLanguage(this.storageKey);
      this.menuOpen = false;
      this.lastFocusedElement = null;

      this.render();
      this.cacheElements();
      this.bindEvents();
      this.initializePageActions();
      this.initializePageSolve();
      this.initializePageBack();
      this.applyLanguage(this.language, { persist: false, announce: false });

      try {
        window.dispatchEvent(new CustomEvent('site-navbar:ready'));
      } catch {
        // CustomEvent support is available in modern browsers; fail silently otherwise.
      }
    }

    disconnectedCallback() {
      document.removeEventListener('keydown', this.handleDocumentKeydown);
      window.removeEventListener('resize', this.handleWindowResize);
      window.removeEventListener('storage', this.handleStorageChange);
      this.pageActionsMedia?.removeEventListener?.('change', this.handlePageActionsMediaChange);
      this.pageSolveMedia?.removeEventListener?.('change', this.handlePageSolveMediaChange);
      document.removeEventListener('DOMContentLoaded', this.handlePageActionsDomReady);
      document.removeEventListener('DOMContentLoaded', this.handlePageSolveDomReady);
      document.removeEventListener('DOMContentLoaded', this.handlePageBackDomReady);
      this.layoutResizeObserver?.disconnect();
    }

    render() {
      const links = NAV_ITEMS.map((item) => `
        <li class="nc-navbar__item">
          <a class="nc-navbar__link" href="${this.rootPath}${item.href}" target="_blank" rel="noopener noreferrer" data-nav-key="${item.key}"></a>
        </li>`).join('');

      this.innerHTML = `
        <header class="nc-navbar" data-menu-open="false">
          <a class="nc-navbar__brand" href="${this.rootPath}index.html" aria-label="BIMbee home" data-brand-home>
            <img class="nc-navbar__logo" src="${this.rootPath}images/bimbee-logo.png" alt="BIMbee">
          </a>

          <div class="nc-navbar__solve-host" hidden></div>
          <div class="nc-navbar__back-slot nc-navbar__back-slot--ltr" hidden></div>
          <div class="nc-navbar__page-actions" hidden></div>

          <div class="nc-navbar__controls">
            <div class="nc-navbar__back-slot nc-navbar__back-slot--rtl" hidden></div>

            <div class="nc-navbar__language" role="group" aria-label="Language">
              <button class="nc-navbar__language-button" type="button" data-language="en" lang="en">English</button>
              <span class="nc-navbar__language-separator" aria-hidden="true">|</span>
              <button class="nc-navbar__language-button" type="button" data-language="he" lang="he" dir="rtl">עברית</button>
            </div>

            <button class="nc-navbar__menu-button" type="button" aria-expanded="false" aria-controls="nc-navbar-drawer">
              <span class="nc-navbar__menu-label nc-navbar__sr-only"></span>
              <span class="nc-navbar__menu-lines" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </button>
          </div>

          <button class="nc-navbar__backdrop" type="button" tabindex="-1" aria-hidden="true"></button>

          <nav class="nc-navbar__drawer" id="nc-navbar-drawer" aria-hidden="true">
            <div class="nc-navbar__drawer-header">
              <span class="nc-navbar__drawer-title"></span>
              <button class="nc-navbar__close-button" type="button">
                <span class="nc-navbar__close-label nc-navbar__sr-only"></span>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <ul class="nc-navbar__links">
              ${links}
            </ul>
          </nav>
        </header>`;
    }

    cacheElements() {
      this.navbar = this.querySelector('.nc-navbar');
      this.menuButton = this.querySelector('.nc-navbar__menu-button');
      this.menuLabel = this.querySelector('.nc-navbar__menu-label');
      this.closeButton = this.querySelector('.nc-navbar__close-button');
      this.closeLabel = this.querySelector('.nc-navbar__close-label');
      this.backdrop = this.querySelector('.nc-navbar__backdrop');
      this.drawer = this.querySelector('.nc-navbar__drawer');
      this.drawerTitle = this.querySelector('.nc-navbar__drawer-title');
      this.pageActionsHost = this.querySelector('.nc-navbar__page-actions');
      this.pageSolveHost = this.querySelector('.nc-navbar__solve-host');
      this.backSlotLtr = this.querySelector('.nc-navbar__back-slot--ltr');
      this.backSlotRtl = this.querySelector('.nc-navbar__back-slot--rtl');
      this.brand = this.querySelector('.nc-navbar__brand');
      this.controls = this.querySelector('.nc-navbar__controls');
      this.languageGroup = this.querySelector('.nc-navbar__language');
      this.languageButtons = [...this.querySelectorAll('[data-language]')];
      this.navLinks = [...this.querySelectorAll('[data-nav-key]')];
    }

    ensureLayoutResizeObserver() {
      if (!window.ResizeObserver) return;
      if (!this.layoutResizeObserver) {
        this.layoutResizeObserver = new ResizeObserver(() => this.updateNavbarLayout());
      }
      [this.brand, this.controls, this.pageActionGroup, this.pageSolveButton]
        .filter(Boolean)
        .forEach(element => this.layoutResizeObserver.observe(element));
    }

    updateNavbarLayout() {
      this.updatePageSolvePosition();
      this.updatePageActionClearance();
    }


    initializePageBack() {
      if (this.pageBackLink) return;
      const backLink = document.querySelector('[data-navbar-back]');
      if (!backLink) {
        if (document.readyState === 'loading' && !this.handlePageBackDomReady) {
          this.handlePageBackDomReady = () => this.initializePageBack();
          document.addEventListener('DOMContentLoaded', this.handlePageBackDomReady, { once: true });
        }
        return;
      }

      document.removeEventListener('DOMContentLoaded', this.handlePageBackDomReady);
      this.pageBackLink = backLink;
      this.pageBackAnchor = document.createComment('nc-navbar-page-back');
      backLink.parentNode.insertBefore(this.pageBackAnchor, backLink);
      backLink.classList.add('nc-navbar__back-link');
      this.syncPageBack();
      requestAnimationFrame(() => this.updatePageActionClearance());
    }

    syncPageBack() {
      if (!this.pageBackLink) return;
      const target = this.language === 'he' ? this.backSlotRtl : this.backSlotLtr;
      const inactive = this.language === 'he' ? this.backSlotLtr : this.backSlotRtl;
      if (this.pageBackLink.parentNode !== target) target.appendChild(this.pageBackLink);
      target.hidden = false;
      inactive.hidden = true;
      this.pageBackLink.querySelector('.back-arrow')?.replaceChildren(document.createTextNode(this.language === 'he' ? '→' : '←'));
    }

    initializePageActions() {
      if (this.pageActionGroup) return;
      const actionGroup = document.querySelector('[data-navbar-actions]');

      if (!actionGroup) {
        if (document.readyState === 'loading' && !this.handlePageActionsDomReady) {
          this.handlePageActionsDomReady = () => this.initializePageActions();
          document.addEventListener('DOMContentLoaded', this.handlePageActionsDomReady, { once: true });
        }
        return;
      }

      document.removeEventListener('DOMContentLoaded', this.handlePageActionsDomReady);
      this.pageActionGroup = actionGroup;
      this.pageActionsAnchor = document.createComment('nc-navbar-page-actions');
      actionGroup.parentNode.insertBefore(this.pageActionsAnchor, actionGroup);
      this.pageActionsMedia = window.matchMedia('(min-width: 1024px)');
      this.handlePageActionsMediaChange = () => this.syncPageActions();
      this.pageActionsMedia.addEventListener?.('change', this.handlePageActionsMediaChange);

      this.ensureLayoutResizeObserver();

      this.syncPageActions();
    }

    initializePageSolve() {
      if (this.pageSolveButton) return;
      const solveButton = document.querySelector('[data-navbar-solve]');
      if (!solveButton) {
        if (document.readyState === 'loading' && !this.handlePageSolveDomReady) {
          this.handlePageSolveDomReady = () => this.initializePageSolve();
          document.addEventListener('DOMContentLoaded', this.handlePageSolveDomReady, { once: true });
        }
        return;
      }

      document.removeEventListener('DOMContentLoaded', this.handlePageSolveDomReady);
      this.pageSolveButton = solveButton;
      this.pageSolveAnchor = document.createComment('nc-navbar-page-solve');
      solveButton.parentNode.insertBefore(this.pageSolveAnchor, solveButton);
      this.pageSolveHost.appendChild(solveButton);
      this.pageSolveMedia = window.matchMedia('(min-width: 1024px)');
      this.handlePageSolveMediaChange = () => this.syncPageSolve();
      this.pageSolveMedia.addEventListener?.('change', this.handlePageSolveMediaChange);
      this.ensureLayoutResizeObserver();
      this.syncPageSolve();
    }

    syncPageActions() {
      if (!this.pageActionGroup || !this.pageActionsAnchor) return;
      if (this.pageActionsMedia.matches) {
        if (this.pageActionGroup.parentNode !== this.pageActionsHost) this.pageActionsHost.appendChild(this.pageActionGroup);
        this.pageActionsHost.hidden = false;
        this.updatePageActionClearance();
      } else {
        if (this.pageActionGroup.parentNode !== this.pageActionsAnchor.parentNode) {
          this.pageActionsAnchor.parentNode.insertBefore(this.pageActionGroup, this.pageActionsAnchor.nextSibling);
        }
        this.pageActionsHost.hidden = true;
        this.navbar.style.removeProperty('--nc-navbar-actions-side-clearance');
      }
      window.requestAnimationFrame(() => this.updateNavbarLayout());
    }

    syncPageSolve() {
      if (!this.pageSolveButton || !this.pageSolveMedia) return;
      const show = this.pageSolveMedia.matches;
      if (this.pageSolveButton.parentNode !== this.pageSolveHost) this.pageSolveHost.appendChild(this.pageSolveButton);
      this.pageSolveHost.hidden = !show;
      this.pageSolveButton.hidden = !show;
      if (!show) this.pageSolveHost.style.removeProperty('left');
      window.requestAnimationFrame(() => this.updateNavbarLayout());
    }

    updatePageSolvePosition() {
      if (!this.pageSolveButton || !this.pageSolveMedia?.matches || this.pageSolveHost.hidden || this.pageActionsHost.hidden) return;
      const navbarRect = this.navbar.getBoundingClientRect();
      const brandRect = this.brand.getBoundingClientRect();
      const actionsRect = this.pageActionsHost.getBoundingClientRect();
      if (!navbarRect.width || !brandRect.width || !actionsRect.width) return;
      const center = ((brandRect.right + actionsRect.left) / 2) - navbarRect.left;
      this.pageSolveHost.style.left = `${center}px`;
    }

    updatePageActionClearance() {
      if (!this.pageActionGroup || this.pageActionsHost.hidden) return;
      const navbarRect = this.navbar.getBoundingClientRect();
      const brandRect = this.brand.getBoundingClientRect();
      const controlsRect = this.controls.getBoundingClientRect();
      let leftOccupied = brandRect.right - navbarRect.left;
      if (!this.backSlotLtr.hidden) leftOccupied = Math.max(leftOccupied, this.backSlotLtr.getBoundingClientRect().right - navbarRect.left);
      if (this.pageSolveButton && !this.pageSolveHost.hidden) leftOccupied = Math.max(leftOccupied, this.pageSolveButton.getBoundingClientRect().right - navbarRect.left);
      const rightOccupied = navbarRect.right - controlsRect.left;
      const clearance = Math.ceil(Math.max(leftOccupied, rightOccupied) + 18);
      this.navbar.style.setProperty('--nc-navbar-actions-side-clearance', `${clearance}px`);
    }

    bindEvents() {
      this.menuButton.addEventListener('click', () => this.setMenuOpen(!this.menuOpen));
      this.closeButton.addEventListener('click', () => this.setMenuOpen(false));
      this.backdrop.addEventListener('click', () => this.setMenuOpen(false));

      this.navLinks.forEach((link) => {
        link.addEventListener('click', () => this.setMenuOpen(false, { restoreFocus: false }));
      });

      this.languageButtons.forEach((button) => {
        button.addEventListener('click', () => {
          this.applyLanguage(button.dataset.language, { persist: true, announce: true });
        });
      });

      this.handleDocumentKeydown = (event) => {
        if (!this.menuOpen) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          this.setMenuOpen(false);
          return;
        }

        if (event.key === 'Tab') {
          this.trapFocus(event);
        }
      };

      this.handleWindowResize = () => {
        // Closing on resize prevents a stale scroll lock after device rotation.
        if (this.menuOpen) this.setMenuOpen(false, { restoreFocus: false });
        this.syncPageActions();
        this.syncPageSolve();
        this.updateNavbarLayout();
      };

      this.handleStorageChange = (event) => {
        if (event.key !== this.storageKey) return;
        const language = normalizeLanguage(event.newValue);
        if (language && language !== this.language) {
          this.applyLanguage(language, { persist: false, announce: true });
        }
      };

      document.addEventListener('keydown', this.handleDocumentKeydown);
      window.addEventListener('resize', this.handleWindowResize);
      window.addEventListener('storage', this.handleStorageChange);
    }

    applyLanguage(requestedLanguage, options = {}) {
      const language = normalizeLanguage(requestedLanguage) || 'en';
      const persist = options.persist !== false;
      const announce = options.announce !== false;
      const copy = navbarText(language);

      this.language = language;
      document.documentElement.lang = language;
      document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
      this.setAttribute('data-language', language);

      this.languageGroup.setAttribute('aria-label', copy.language);
      this.querySelector('[data-brand-home]')?.setAttribute('aria-label', copy.brandHome);
      this.menuLabel.textContent = copy.menu;
      this.closeLabel.textContent = copy.closeMenu;
      this.drawerTitle.textContent = copy.navigation;
      this.drawer.setAttribute('aria-label', copy.navigation);

      this.navLinks.forEach((link) => {
        link.textContent = copy[link.dataset.navKey] || '';
      });

      this.languageButtons.forEach((button) => {
        const active = button.dataset.language === language;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
        button.disabled = active;
      });

      updateLegacyLanguageElements(language);
      if (persist) writeLanguage(this.storageKey, language);
      if (announce) announceLanguage(language);
      this.syncPageBack();
      this.syncPageSolve();
      window.requestAnimationFrame(() => this.updateNavbarLayout());
    }

    setMenuOpen(open, options = {}) {
      const shouldOpen = Boolean(open);
      const restoreFocus = options.restoreFocus !== false;
      if (this.menuOpen === shouldOpen) return;

      this.menuOpen = shouldOpen;
      this.navbar.dataset.menuOpen = String(shouldOpen);
      this.menuButton.setAttribute('aria-expanded', String(shouldOpen));
      this.drawer.setAttribute('aria-hidden', String(!shouldOpen));
      this.backdrop.setAttribute('aria-hidden', String(!shouldOpen));
      const copy = navbarText(this.language);
      this.menuLabel.textContent = shouldOpen ? copy.closeMenu : copy.menu;

      document.documentElement.classList.toggle('nc-navbar-menu-open', shouldOpen);
      document.body.classList.toggle('nc-navbar-menu-open', shouldOpen);

      if (shouldOpen) {
        this.lastFocusedElement = document.activeElement;
        window.requestAnimationFrame(() => this.closeButton.focus());
      } else if (restoreFocus && this.lastFocusedElement instanceof HTMLElement) {
        this.lastFocusedElement.focus();
      }
    }

    trapFocus(event) {
      const focusable = [...this.drawer.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter((element) => !element.hidden);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  if (!window.customElements.get('site-navbar')) {
    window.customElements.define('site-navbar', SiteNavbar);
  }

  // Small public API for NC Nesting scripts that need the active language.
  window.NCNestingLanguage = Object.freeze({
    get() {
      const navbar = document.querySelector('site-navbar');
      return navbar?.language || normalizeLanguage(document.documentElement.lang) || 'en';
    },
    set(language) {
      const navbar = document.querySelector('site-navbar');
      if (navbar && typeof navbar.applyLanguage === 'function') {
        navbar.applyLanguage(language, { persist: true, announce: true });
      }
    }
  });
})();
