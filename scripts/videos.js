// scripts/videos.js
// Now accepts a title and displays it

const pluginPlaylist = ['fabpackager', 'bimchecker', 'drawingcreator'];
let currentPluginKey = null;
const NEXT_BUTTON_LAST_SECONDS = 15;
const DEFAULT_VIDEO_VOLUME = 0.3;
const VIDEO_VOLUME_STORAGE_KEY = 'bimbee_modalVideoVolume';
const VIDEO_MUTED_STORAGE_KEY = 'bimbee_modalVideoMuted';

function getVideosBaseUrl() {
    // Resolve the /videos/ folder relative to where this script is served from.
    // This allows the same videos.js to work from nested pages (e.g. /BIMBlog/posts/...).
    try {
        const scriptEl = document.querySelector('script[src$="/scripts/videos.js"], script[src$="scripts/videos.js"]');
        if (scriptEl && scriptEl.src) {
            const scriptUrl = new URL(scriptEl.src, window.location.href);
            return new URL('../videos/', scriptUrl).toString();
        }
    } catch {
        // ignore
    }
    // Fallback: relative to current page
    try {
        return new URL('videos/', window.location.href).toString();
    } catch {
        return 'videos/';
    }
}

function getSiteRootUrl() {
    // Site root derived from where this script is hosted: /scripts/videos.js -> /
    try {
        const scriptEl = document.querySelector('script[src$="/scripts/videos.js"], script[src$="scripts/videos.js"]');
        if (scriptEl && scriptEl.src) {
            const scriptUrl = new URL(scriptEl.src, window.location.href);
            return new URL('../', scriptUrl).toString();
        }
    } catch {
        // ignore
    }
    // Fallback: assume current origin root
    try {
        return new URL('/', window.location.href).toString();
    } catch {
        return '/';
    }
}

function resolveVideoSrc(path) {
    if (!path) return path;
    // already absolute or special schemes
    if (/^(https?:)?\/\//.test(path) || path.startsWith('data:') || path.startsWith('blob:')) {
        return path;
    }
    // If callers pass "videos/<file>", normalize to just "<file>"
    const cleaned = path.startsWith('videos/') ? path.slice('videos/'.length) : path;
    return getVideosBaseUrl() + cleaned;
}

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function loadSavedVideoPrefs() {
    try {
        const rawVol = localStorage.getItem(VIDEO_VOLUME_STORAGE_KEY);
        const rawMuted = localStorage.getItem(VIDEO_MUTED_STORAGE_KEY);
        const volume = rawVol === null ? null : Number(rawVol);
        const muted = rawMuted === null ? null : (rawMuted === '1');
        return {
            volume: Number.isFinite(volume) ? clampNumber(volume, 0, 1) : null,
            muted: typeof muted === 'boolean' ? muted : null
        };
    } catch {
        return { volume: null, muted: null };
    }
}

function saveVideoPrefs(volume, muted) {
    try {
        if (Number.isFinite(volume)) {
            localStorage.setItem(VIDEO_VOLUME_STORAGE_KEY, String(clampNumber(volume, 0, 1)));
        }
        if (typeof muted === 'boolean') {
            localStorage.setItem(VIDEO_MUTED_STORAGE_KEY, muted ? '1' : '0');
        }
    } catch {
        // ignore storage failures (private mode / disabled storage)
    }
}

function applyInitialVideoPrefs(video) {
    if (!video) return;
    const prefs = loadSavedVideoPrefs();
    const targetVolume = prefs.volume === null ? DEFAULT_VIDEO_VOLUME : prefs.volume;
    const targetMuted = prefs.muted === null ? false : prefs.muted;
    try {
        video.muted = targetMuted;
        video.volume = clampNumber(targetVolume, 0, 1);
    } catch {
        // ignore if browser blocks setting these for some reason
    }
}

function wireVideoVolumePersistenceOnce() {
    const { video } = getModalElements();
    if (!video || video.dataset.volumeWired === '1') return;
    video.dataset.volumeWired = '1';

    video.addEventListener('volumechange', function () {
        if (video.dataset.suppressVolumeSave === '1') return;
        saveVideoPrefs(video.volume, video.muted);
    });
}

function getModalElements() {
    return {
        modal: document.getElementById('video-modal'),
        video: document.getElementById('modal-video'),
        title: document.getElementById('modal-title'),
        description: document.getElementById('modal-description'),
        nextButton: document.getElementById('modal-next'),
        contactButton: document.getElementById('modal-contact')
    };
}

function isModalOpen() {
    const { modal } = getModalElements();
    return !!(modal && modal.style.display === 'flex');
}

function getNextPluginKey(currentKey) {
    if (!currentKey) return null;
    const idx = pluginPlaylist.indexOf(currentKey);
    if (idx === -1) return null;
    return pluginPlaylist[(idx + 1) % pluginPlaylist.length];
}

function hideNextButton() {
    const { nextButton } = getModalElements();
    if (!nextButton) return;
    nextButton.style.display = 'none';
    nextButton.removeAttribute('data-next-plugin');
    nextButton.textContent = '';
}

function hideContactButton() {
    const { contactButton } = getModalElements();
    if (!contactButton) return;
    contactButton.style.display = 'none';
    contactButton.textContent = '';
}

function showNextButton(nextPluginKey) {
    const { nextButton } = getModalElements();
    if (!nextButton || !nextPluginKey) return;
    const wasHidden = nextButton.style.display === 'none' || !nextButton.style.display;
    const lang = getCurrentLang();
    nextButton.textContent = lang === 'he' ? 'לסרטון הבא' : 'Next video';
    nextButton.setAttribute('data-next-plugin', nextPluginKey);
    nextButton.style.display = 'inline-flex';
    if (wasHidden) {
        nextButton.focus({ preventScroll: true });
    }
}

function showContactButton() {
    const { contactButton } = getModalElements();
    if (!contactButton) return;
    const lang = getCurrentLang();
    contactButton.textContent = lang === 'he' ? 'יצירת קשר' : 'Contact';
    contactButton.style.display = 'inline-flex';
}

function goToContact() {
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 1025px)').matches;

    // Prefer opening the existing mobile contact modal if available
    if (isMobile) {
        const triggerBtn = document.getElementById('mobile-contact-trigger');
        if (triggerBtn) {
            triggerBtn.click();
            return;
        }
    }

    // Desktop (or fallback): scroll to section and set hash
    const contactSection = document.getElementById('contact');
    if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        // If this page doesn't have the contact section (e.g. a blog post), jump to homepage contact.
        const root = getSiteRootUrl();
        window.location.href = new URL('index.html#contact', root).toString();
        return;
    }
    try {
        history.pushState(null, '', '#contact');
    } catch {
        window.location.hash = 'contact';
    }
}

function updateNextButtonVisibility() {
    const { video } = getModalElements();
    if (!video) return;

    const nextKey = getNextPluginKey(currentPluginKey);
    const duration = video.duration;
    const currentTime = video.currentTime;
    if (!Number.isFinite(duration) || duration <= 0) {
        hideNextButton();
        hideContactButton();
        return;
    }

    const showFrom = Math.max(0, duration - NEXT_BUTTON_LAST_SECONDS);
    if (currentTime >= showFrom) {
        // Contact button always shows in the last N seconds
        showContactButton();
        if (nextKey) {
            showNextButton(nextKey);
        } else {
            hideNextButton();
        }
    } else {
        hideNextButton();
        hideContactButton();
    }
}

function wireContactButtonOnce() {
    const { contactButton } = getModalElements();
    if (!contactButton || contactButton.dataset.wired === '1') return;
    contactButton.dataset.wired = '1';
    contactButton.addEventListener('click', function () {
        closeModal();
        // Give the modal a moment to close before moving focus/scroll.
        setTimeout(goToContact, 0);
    });
}

function playNextFromButton() {
    const { nextButton } = getModalElements();
    const nextKey = nextButton ? nextButton.getAttribute('data-next-plugin') : null;
    if (!nextKey) return;
    openPluginModal(nextKey);
}

function wireNextButtonOnce() {
    const { nextButton } = getModalElements();
    if (!nextButton || nextButton.dataset.wired === '1') return;
    nextButton.dataset.wired = '1';
    nextButton.addEventListener('click', function () {
        playNextFromButton();
    });
}

function wireVideoEndHandler() {
    const { video } = getModalElements();
    if (!video || video.dataset.endedWired === '1') return;
    video.dataset.endedWired = '1';
    video.addEventListener('ended', function () {
        updateNextButtonVisibility();
    });
}

function wireVideoTimeHandlers() {
    const { video } = getModalElements();
    if (!video || video.dataset.timeWired === '1') return;
    video.dataset.timeWired = '1';

    // Keep the button strictly constrained to the last N seconds,
    // including when the user scrubs the timeline.
    video.addEventListener('timeupdate', updateNextButtonVisibility);
    video.addEventListener('seeking', updateNextButtonVisibility);
    video.addEventListener('loadedmetadata', updateNextButtonVisibility);
    video.addEventListener('play', updateNextButtonVisibility);
}

function openModal(videoSrc, videoTitle, descriptionId) {
    wireNextButtonOnce();
    wireContactButtonOnce();
    wireVideoEndHandler();
    wireVideoTimeHandlers();
    wireVideoVolumePersistenceOnce();

    var modal = document.getElementById("video-modal");
    var video = document.getElementById("modal-video");
    var title = document.getElementById("modal-title");
    var description = document.getElementById("modal-description");

    // title.textContent = videoTitle;
    title.textContent = '';
    var descElem = document.getElementById(descriptionId);
    description.innerHTML = descElem ? descElem.innerHTML : "";

    hideNextButton();
    hideContactButton();

    applyInitialVideoPrefs(video);

    video.src = videoSrc;
    video.load();
    video.play();
    modal.style.display = "flex";
}

function closeModal() {
    var modal = document.getElementById("video-modal");
    var video = document.getElementById("modal-video");

    modal.style.display = "none";
    hideNextButton();
    hideContactButton();
    if (video) {
        fadeOutVideoAudio(video);
    }
    // video.pause();
    // video.src = "";
}

window.onclick = function (event) {
    var modal = document.getElementById("video-modal");
    if (event.target === modal) {
        closeModal();
    }
}

function getCurrentLang() {
    // Detects current language by checking which .lang element is visible
    var heElem = document.querySelector('.lang.lang-he');
    if (heElem && heElem.style.display !== 'none') {
        return 'he';
    }
    return 'en';
}

function openPluginModal(plugin) {
    var lang = getCurrentLang();
    var videoSrc, descriptionId;
    var videoTitle = '';

    currentPluginKey = plugin;

    if (plugin === 'fabpackager') {
        videoSrc = resolveVideoSrc('videos/FabPackager-HEB-Promo.mp4');
        // videoTitle = lang === 'he' ? 'חיסכון בכאב ראש שמגיע הזמן לייצור וביצוע' : 'Save stress when it’s time for execution';
        descriptionId = lang === 'he' ? 'fabpackager-vid-description-he' : 'fabpackager-vid-description-en';
    } else if (plugin === 'bimchecker') {
        videoSrc = resolveVideoSrc('videos/BIMChecker-HEB-Promo.mp4');
        // videoTitle = lang === 'he' ? 'חיסכון בכסף עם בדיקות מודל אוטומטיות' : 'Save money with automated model checks';
        descriptionId = lang === 'he' ? 'bimchecker-desc-he' : 'bimchecker-desc-en';
    } else if (plugin === 'drawingcreator') {
        videoSrc = resolveVideoSrc('videos/DrawingCreator-HEB-Promo.mp4');
        // videoTitle = lang === 'he' ? 'חיסכון בזמן על משימות ידניות חוזרות' : 'Save time on manual repetitive tasks';
        descriptionId = lang === 'he' ? 'drawingcreator-desc-he' : 'drawingcreator-desc-en';
    } else if (plugin === 'promo') {
        videoSrc = resolveVideoSrc('videos/promo.mp4');
        // videoTitle = lang === 'he' ? 'הסבר על BIMbee וכל התוספים' : 'BIMbee Overview & Plugins Promo';
        descriptionId = lang === 'he' ? 'promo-desc-he' : 'promo-desc-en';
    } else {
        currentPluginKey = null;
        return;
    }
    openModal(videoSrc, videoTitle, descriptionId);
}

function fadeOutVideoAudio(video, duration = 1700) {
    if (!video) return;
    video.dataset.suppressVolumeSave = '1';
    const initialVolume = video.volume;
    const steps = 20;
    const stepTime = duration / steps;
    let currentStep = 0;

    function fade() {
        currentStep++;
        video.volume = Math.max(0, initialVolume * (1 - currentStep / steps));
        if (currentStep < steps) {
            setTimeout(fade, stepTime);
        } else {
            video.pause();
            video.volume = initialVolume; // Reset for next play
            setTimeout(function () {
                delete video.dataset.suppressVolumeSave;
            }, 0);
        }
    }
    fade();
}

// Add event delegation for links inside the modal description
document.addEventListener('DOMContentLoaded', function () {
    var modalDescription = document.getElementById('modal-description');
    if (modalDescription) {
        modalDescription.addEventListener('click', function (e) {
            var target = e.target;
            // Check if the clicked element is a link
            if (target.tagName === 'A' && target.target === '_blank') {
                var video = document.getElementById("modal-video");
                if (video) {
                    fadeOutVideoAudio(video);
                }
                // Let the default behavior (open in new tab) continue
            }
        });
    }

    wireNextButtonOnce();
    wireContactButtonOnce();
    wireVideoEndHandler();
    wireVideoTimeHandlers();

    // Keyboard shortcuts while modal is open
    document.addEventListener('keydown', function (e) {
        if (!isModalOpen()) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
        }
        if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowRight') {
            const nextKey = getNextPluginKey(currentPluginKey);
            if (!nextKey) return;
            e.preventDefault();
            openPluginModal(nextKey);
        }
    });
});
