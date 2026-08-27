// File: scripts/contact.js
document.addEventListener('DOMContentLoaded', function() {
    const sendEmailEndpoint = 'http://localhost:7103/api/SendEmailFunction';
    const SEND_TIMEOUT_MS = 20000;

    function initCalendarBookingLink() {
        const bookingLink = document.querySelector('#contact .calendar-booking-button');
        if (!bookingLink || bookingLink.dataset.wired === '1') {
            return Boolean(bookingLink);
        }

        // Keep this as a normal browser link. Avoid intercepting the click with
        // window.open(), which can be blocked or behave inconsistently.
        bookingLink.dataset.wired = '1';
        return true;
    }

    function initMobileContactModal() {
        const triggerBtn = document.getElementById('mobile-contact-trigger');
        const closeBtn = document.getElementById('contact-modal-close');
        const modalOverlay = document.getElementById('contact-modal-overlay');
        const modalContent = document.querySelector('.contact-modal-content');
        const contactForm = document.getElementById('contact-form');
        const formHome = document.querySelector('#contact .hero');

        if (!triggerBtn || !closeBtn || !modalOverlay || !modalContent || !contactForm || !formHome) {
            return false;
        }

        if (modalOverlay.dataset.wired === '1') {
            return true;
        }
        modalOverlay.dataset.wired = '1';

        // The original modal lives inside a transformed/absolutely positioned section.
        // Move only the overlay container under <body> so it cannot be covered by
        // another section. Its existing classes/CSS remain unchanged.
        if (modalOverlay.parentElement !== document.body) {
            document.body.appendChild(modalOverlay);
        }

        const overlayBg = modalOverlay.getAttribute('data-overlay-bg');
        if (overlayBg) modalOverlay.style.background = overlayBg;

        window.contactModalOverlay = {
            setBackground(bg) { modalOverlay.style.background = bg; },
            disableBackground() { modalOverlay.classList.add('no-bg'); },
            enableBackground() { modalOverlay.classList.remove('no-bg'); }
        };

        let previousBodyOverflow = '';

        function openModal() {
            const isMobile = window.matchMedia('(max-width: 1025px)').matches;
            if (!isMobile) return;

            previousBodyOverflow = document.body.style.overflow;
            modalOverlay.style.zIndex = '999999';
            modalContent.appendChild(contactForm);
            contactForm.classList.add('in-modal');
            modalOverlay.classList.add('is-open');
            modalOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('contact-modal-open');
            document.body.style.overflow = 'hidden';

            const firstInput = contactForm.querySelector('input');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
        }

        function closeModal() {
            if (!modalOverlay.classList.contains('is-open')) return;

            formHome.appendChild(contactForm);
            contactForm.classList.remove('in-modal');
            modalOverlay.classList.remove('is-open');
            modalOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('contact-modal-open');
            document.body.style.overflow = previousBodyOverflow;

            if (window.matchMedia('(max-width: 1025px)').matches) {
                triggerBtn.focus();
            }
        }

        triggerBtn.addEventListener('click', openModal);
        closeBtn.addEventListener('click', closeModal);

        modalOverlay.addEventListener('click', e => {
            if (e.target === modalOverlay) closeModal();
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && modalOverlay.classList.contains('is-open')) {
                closeModal();
            }
        });

        window.addEventListener('resize', () => {
            const isMobile = window.matchMedia('(max-width: 1025px)').matches;
            if (!isMobile) {
                closeModal();
            }
        });

        return true;
    }

    function attachListener() {
        const form = document.getElementById('contact-form');
        const container = document.querySelector('.checkbox-group');
        if (!form) {
            return false;
        }

        if (container && container.dataset.populated !== '1') {
            container.innerHTML = '';
            [
                'Option First',
                'Option Second',
                'Option Third',
                'Option #4',
                'Option #6'
            ].forEach(option => {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.name = 'interest';
                input.value = option;
                label.appendChild(input);
                label.append(` ${option}`);
                container.appendChild(label);
            });
            container.dataset.populated = '1';
        }

        const phoneInput = document.getElementById('phone');
        if (phoneInput && phoneInput.dataset.wired !== '1') {
            phoneInput.dataset.wired = '1';
            phoneInput.setAttribute('inputmode', 'tel');

            phoneInput.addEventListener('keydown', (e) => {
                const ctrlCmd = e.ctrlKey || e.metaKey;
                const allowedNav = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
                if (allowedNav.includes(e.key) || (ctrlCmd && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase()))) {
                    return;
                }
                if (e.key === '+') {
                    const pos = phoneInput.selectionStart ?? 0;
                    if (pos !== 0 || phoneInput.value.includes('+')) {
                        e.preventDefault();
                    }
                    return;
                }
                if (!/^\d$/.test(e.key)) {
                    e.preventDefault();
                }
            });

            phoneInput.addEventListener('input', () => {
                const value = phoneInput.value;
                const keepPlus = value.startsWith('+');
                const digitsOnly = value.replace(/[^\d]/g, '');
                phoneInput.value = keepPlus ? `+${digitsOnly}` : digitsOnly;
            });
        }

        if (form.dataset.submitWired === '1') {
            return true;
        }

        form.dataset.submitWired = '1';
        const messageDiv = document.getElementById('form-message');
        const submitButton = document.getElementById('submit-button');

        form.addEventListener('submit', async e => {
            e.preventDefault();

            const nameCompany = document.getElementById('name-company').value.trim();
            const email = document.getElementById('email').value.trim();
            const phone = document.getElementById('phone').value.trim();
            const message = document.getElementById('message').value.trim();
            const interests = Array.from(
                form.querySelectorAll('input[name="interest"]:checked')
            ).map(cb => cb.value);

            const lines = [
                `Name/Company: ${nameCompany}`,
                `Email: ${email}`,
                `Phone: ${phone}`
            ];
            if (interests.length > 0) {
                lines.push(`Interested in: ${interests.join(', ')}`);
            }
            if (message) {
                lines.push(`Message: ${message}`);
            }

            const formData = new FormData(form);
            formData.set('subject', `Contact form from ${nameCompany}`);
            formData.set('body', lines.join('\n'));

            if (messageDiv) {
                messageDiv.textContent = 'Sending...';
                messageDiv.style.color = '';
            }
            if (submitButton) {
                submitButton.disabled = true;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

            try {
                const response = await fetch('https://factoryfunctions.azurewebsites.net/api/SendEmailFunction?code=Bf-jCZu3gse08jleLLz2jgI7Lm1yrY1_z0hhZ_5pPMKLAzFueG16VQ==', {
                    method: 'POST',
                    body: formData,
                    signal: controller.signal
                });
                const text = await response.text();

                if (!response.ok) {
                    throw new Error(text || `Request failed with status ${response.status}`);
                }

                if (messageDiv) {
                    messageDiv.textContent = text || 'Your message was sent successfully.';
                    messageDiv.style.color = 'green';
                }
            } catch (err) {
                console.error(err);
                if (messageDiv) {
                    const errorMessage = err && err.name === 'AbortError'
                        ? 'The request timed out. Please try again.'
                        : (err instanceof Error ? err.message : String(err));
                    messageDiv.textContent = `Unable to send your message. ${errorMessage}`;
                    messageDiv.style.color = 'red';
                }
            } finally {
                clearTimeout(timeoutId);
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        });

        return true;
    }

    if (!initMobileContactModal()) {
        const modalObserver = new MutationObserver(() => {
            if (initMobileContactModal()) modalObserver.disconnect();
        });
        modalObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (!initCalendarBookingLink()) {
        const bookingObserver = new MutationObserver(() => {
            if (initCalendarBookingLink()) bookingObserver.disconnect();
        });
        bookingObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (!attachListener()) {
        const observer = new MutationObserver(() => {
            if (attachListener()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
});
