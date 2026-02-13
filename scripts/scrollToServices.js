// How many pixels of space to leave above the Services section after scrolling.
// Increase this value to stop higher (more empty space above).
// Use a smaller or negative value to scroll further down.
var SERVICES_SCROLL_OFFSET = -75;

// Temporary scroll-to-services function for landing page button
function scrollToServices() {
    function scrollWithOffset(el) {
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        var targetY = rect.top + scrollTop - SERVICES_SCROLL_OFFSET;

        window.scrollTo({
            top: targetY,
            behavior: 'smooth'
        });
    }

    var servicesSection = document.getElementById('services');
    if (servicesSection) {
        scrollWithOffset(servicesSection);
    } else {
        // Wait for sections to load, then scroll
        function onSectionsLoaded() {
            var el = document.getElementById('services');
            if (el) {
                scrollWithOffset(el);
            }
            window.removeEventListener('bimbee:sectionsLoaded', onSectionsLoaded);
        }
        window.addEventListener('bimbee:sectionsLoaded', onSectionsLoaded);
    }
}