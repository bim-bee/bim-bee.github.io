window.addEventListener("load", function () {
    const imageContainer = document.querySelector(".image-container");
    const contentContainer = document.querySelector(".content");

    if (!imageContainer || !contentContainer) {
        console.error("Missing .image-container or .content in the DOM.");
        return;
    }

    const sections = [
        "landing-page",
        "metaphor-section",
        "about-us",
        "services",
        "future-roadmap",
        "custom-plugin",
        "contact"
    ];


    const desktopImagePaths = [
        "1.jpg",
        "2.jpg",
        "3.jpg",
        "4.jpg",
        "5.jpg",
        "6.jpg",
        "7.jpg",
        "8.jpg"
    ];

    const mobileImagePaths = [
        "1.png",
        "2.png",
        "3.png",
        "4.png",
    ];

    // Controlled cache busting: update only when background assets change.
    const ASSET_VERSION = "2026-02-19";

    const MOBILE_QUERY = "(max-width: 1025px)";

    // Scroll clamp logic (robust for mobile): limit scroll so bottom of viewport cannot pass last image bottom
    let maxScroll = null;
    let clampReady = false;
    function computeMaxScroll() {
        const imgs = imageContainer.querySelectorAll('img');
        if (!imgs.length) return;
        const lastImg = imgs[imgs.length - 1];
        const rect = lastImg.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top; // document Y of top of last image
        const lastBottom = absoluteTop + rect.height;  // document Y of bottom of last image
        maxScroll = Math.max(0, lastBottom - window.innerHeight);
    }
    function enforceScrollClamp() {
        // IMPORTANT: avoid "scroll jump" while backgrounds are still loading.
        // We only clamp once all background images have finished loading.
        if (!clampReady) return;
        if (maxScroll == null) return;
        if (window.scrollY > maxScroll) window.scrollTo(0, maxScroll);
    }

    let imageLoadGeneration = 0;
    let lastIsMobile = window.matchMedia(MOBILE_QUERY).matches;
    function buildImageUrl(isMobile, filename) {
        const base = isMobile ? 'images/mobile/' : 'images/desktop/';
        return `${base}${filename}?v=${encodeURIComponent(ASSET_VERSION)}`;
    }
    function waitForImage(img) {
        return new Promise((resolve) => {
            if (img.complete) return resolve();
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        });
    }

    async function updateImages() {
        const generation = ++imageLoadGeneration;
        clampReady = false;
        maxScroll = null;

        const isMobile = window.matchMedia(MOBILE_QUERY).matches;
        lastIsMobile = isMobile;
        imageContainer.innerHTML = ""; // Clear existing images

        const paths = isMobile ? mobileImagePaths : desktopImagePaths;
        if (!paths.length) return;

        async function createAppendAndWait(path) {
            if (generation !== imageLoadGeneration) return;
            const img = document.createElement('img');
            img.src = buildImageUrl(isMobile, path);
            const altBase = path.replace(/\.[^.]+$/, '').replace(/-/g, ' ');
            img.alt = `${altBase} Background`;
            imageContainer.appendChild(img);
            await waitForImage(img);
            if (generation !== imageLoadGeneration) return;
        }

        // Load hero first, then remaining backgrounds sequentially.
        await createAppendAndWait(paths[0]);
        for (let i = 1; i < paths.length; i++) {
            await createAppendAndWait(paths[i]);
        }

        // Enable clamp only once all backgrounds have finished loading.
        if (generation === imageLoadGeneration) {
            clampReady = true;
            computeMaxScroll();
            enforceScrollClamp();
        }
    }


    function loadSections() {
        let loadedCount = 0;
        sections.forEach((section) => {
            fetch(`sections/${section}.html`)
                .then((response) => {
                    if (!response.ok) throw new Error(`Failed to load ${section}.html`);
                    return response.text();
                })
                .then((data) => {
                    const wrapper = document.createElement("div");
                    wrapper.innerHTML = data.trim();

                    const firstChild = wrapper.firstElementChild;
                    if (firstChild) {
                        contentContainer.appendChild(firstChild);
                    }
                    loadedCount++;
                    // When all sections are loaded, set the language and scroll to hash
                    if (loadedCount === sections.length) {
                        if (typeof setLanguage === "function") {
                            const saved =
                                (typeof getStoredLanguage === 'function' && getStoredLanguage()) ||
                                window.currentLang ||
                                window.startLang ||
                                (function(){ try { return localStorage.getItem('preferredLanguage') || localStorage.getItem('bimbee_lang'); } catch { return null; } })() ||
                                window.defaultLang ||
                                'en';
                            setLanguage(saved);
                        }
                        // Layout may change after sections injection; refresh clamp.
                        setTimeout(function () {
                            computeMaxScroll();
                            enforceScrollClamp();
                        }, 0);
                        // Scroll to section if hash is present
                        if (window.location.hash) {
                            setTimeout(function () {
                                var el = document.querySelector(window.location.hash);
                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                        }
                    }
                })
                .catch((error) => console.error(error));
        });
    }

    updateImages();
    loadSections();

    // Clamp is intentionally disabled until backgrounds finish loading to prevent scroll jumps.
    // Clamp on scroll (helps iOS elastic / Android overscroll)
    window.addEventListener('scroll', enforceScrollClamp, { passive: true });
    // Recompute on resize / orientation change
    let clampDebounce;
    window.addEventListener('resize', () => {
        clearTimeout(clampDebounce);
        clampDebounce = setTimeout(() => {
            computeMaxScroll();
            enforceScrollClamp();
        }, 250);
    });

    // Smooth scroll for navbar links if already on index.html
    document.addEventListener('click', function (e) {
        const target = e.target.closest('a');
        if (!target) return;
        const href = target.getAttribute('href');
        if (!href) return;
        // Do nothing for language switcher links (ids lang-en / lang-he)
        if (target.id === 'lang-en' || target.id === 'lang-he') return; // main.js handles them
        const isNavLink = target.classList.contains('nav-link') && !!target.closest('#nav-list');
        // Home button: scroll to top only if already on index.html AND all sections loaded AND it's the nav Home link
        const isOnIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
        const allSectionsLoaded = document.querySelectorAll('.content > *').length >= 7; // 7 sections expected
        if (isOnIndex && allSectionsLoaded && isNavLink && (href === '#' || href === 'index.html')) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
            history.replaceState(null, '', 'index.html');
            return;
        }
        // Only handle local hash links to index.html for nav links
        if (isNavLink) {
            const match = href.match(/^#(.+)/) || href.match(/^index\.html#(.+)/);
            if (match) {
                const sectionId = match[1];
                const el = document.getElementById(sectionId) || document.querySelector('#' + sectionId);
                if (el) {
                    e.preventDefault();
                    el.scrollIntoView({ behavior: 'smooth' });
                    history.replaceState(null, '', '#' + sectionId);
                }
            }
        }
    });

    let resizeTimeout;

    window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const isMobileNow = window.matchMedia(MOBILE_QUERY).matches;
            // Only rebuild images if we actually crossed the breakpoint.
            // Mobile browsers can fire resize during scroll (address bar show/hide).
            if (isMobileNow !== lastIsMobile) {
                updateImages();
            } else {
                // Just recompute clamp; no expensive DOM rebuild.
                computeMaxScroll();
                enforceScrollClamp();
            }
        }, 200);
    });

});
