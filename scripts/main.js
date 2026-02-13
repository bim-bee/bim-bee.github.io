// Store the original order of navigation items
let originalNavOrder = [];
let navInitialized = false;

// Delegated language switcher (works for static and custom navbar)
document.addEventListener('click', function (event) {
    if (event.target && (event.target.id === 'lang-en' || event.target.id === 'lang-he')) {
        event.preventDefault();
        const lang = event.target.id === 'lang-en' ? 'en' : 'he';
        setLanguage(lang);
        try { localStorage.setItem('preferredLanguage', lang); } catch {}
        document.cookie = 'preferredLanguage=' + encodeURIComponent(lang) + ';path=/;max-age=31536000';
    }
});

// Helper to get stored language (localStorage + cookie + legacy key)
function getStoredLanguage() {
    let saved = null;
    try {
        saved = localStorage.getItem('preferredLanguage') ||
                localStorage.getItem('bimbee_lang') || null;
    } catch {}
    if (!saved) {
        const m = document.cookie.match(/(?:^|;\s*)preferredLanguage=([^;]+)/);
        if (m) saved = decodeURIComponent(m[1]);
    }
    return saved;
}

// Initialize when nav-list is available
function initLanguageUI() {
    const navList = document.getElementById('nav-list');
    if (!navList || navInitialized) return;
    originalNavOrder = Array.from(navList.children);
    navInitialized = true;
    const saved = getStoredLanguage() || window.startLang;
    setLanguage(saved || window.defaultLang || 'he');
}

window.addEventListener('DOMContentLoaded', initLanguageUI);
window.addEventListener('site-navbar:ready', initLanguageUI);

// Fallback in case neither event catches (e.g. race conditions)
const navWaitObserver = new MutationObserver(() => {
    if (document.getElementById('nav-list')) {
        initLanguageUI();
        navWaitObserver.disconnect();
    }
});
navWaitObserver.observe(document.documentElement, { childList: true, subtree: true });

function setLanguage(lang) {
    var elements = document.querySelectorAll('.lang');
    elements.forEach(function (el) {
        if (el.classList.contains('lang-' + lang)) {
            el.style.display = ''; // Show the selected language
        } else {
            el.style.display = 'none'; // Hide other languages
        }
    });

    // Reorder navigation items based on the selected language
    if (lang === 'he') {
        reorderNav('rtl');
    } else {
        reorderNav('ltr');
    }

    // Notify the rest of the site (e.g., BIMblog) that the language changed
    // and expose the current language in a safe, global spot.
    try {
        window.currentLang = lang;
        window.dispatchEvent(new CustomEvent('bimbee:languagechange', { detail: { lang: lang } }));
    } catch (e) { /* no-op */ }
}

function toggleMenu() {
    const list = document.getElementById('nav-list');
    if (list) list.classList.toggle('active');
}
function closeMenu() {
    const list = document.getElementById('nav-list');
    if (list) list.classList.remove('active');
}

function reorderNav(direction) {
    const navList = document.getElementById('nav-list');
    if (!navList || !originalNavOrder.length) return;
    navList.innerHTML = '';
    // Only reverse for desktop (width > 1025px)
    const isDesktop = window.matchMedia('(min-width: 1025px)').matches;
    if (direction === 'rtl' && isDesktop) {
        originalNavOrder.slice().reverse().forEach(item => navList.appendChild(item));
    } else {
        originalNavOrder.forEach(item => navList.appendChild(item));
    }
}

// Close the menu when clicking outside of it on mobile
document.addEventListener('click', (e) => {
    const navListEl = document.getElementById('nav-list');
    const hamburger = document.querySelector('.hamburger');
    // Only close menu if hamburger is visible (mobile) and click is outside nav/hamburger
    const isMobile = window.matchMedia('(max-width: 1025px)').matches;
    if (isMobile && navListEl && hamburger &&
        !navListEl.contains(e.target) && !hamburger.contains(e.target)) {
        closeMenu();
    }
});

// Close the menu immediately after selecting a nav link on mobile
document.addEventListener('click', (e) => {
    const link = e.target.closest('#nav-list a.nav-link');
    if (!link) return;
    const navListEl = document.getElementById('nav-list');
    const isMobile = window.matchMedia('(max-width: 1025px)').matches;
    if (isMobile && navListEl && navListEl.classList.contains('active')) {
        // Close before or after scroll/navigation; immediate is fine
        closeMenu();
    }
});

// Existing code remains unchanged...
// Add lazy-loading for initial images and for dynamically added images
document.addEventListener('DOMContentLoaded', function () {
    // Set lazy-loading for images present on page load
    const addLazyAttribute = function () {
        document.querySelectorAll('img:not([loading])').forEach(function (img) {
            img.setAttribute('loading', 'lazy');
        });
    };

    addLazyAttribute();

    // Use a MutationObserver to watch for new images added to the DOM
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            mutation.addedNodes.forEach(function (node) {
                // If the added node is an image, apply lazy-loading
                if (node.tagName === 'IMG') {
                    node.setAttribute('loading', 'lazy');
                }
                // If the node contains images, process them too
                else if (node.querySelectorAll) {
                    node.querySelectorAll('img:not([loading])').forEach(function (img) {
                        img.setAttribute('loading', 'lazy');
                    });
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
});