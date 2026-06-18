// File: scripts/contact.js
document.addEventListener('DOMContentLoaded', function() {
    const sendEmailEndpoint = 'http://localhost:7103/api/SendEmailFunction';

    function initCalendarBookingLink() {
        const bookingLink = document.querySelector('#contact .calendar-booking-button');
        if (!bookingLink || bookingLink.dataset.wired === '1') {
            return Boolean(bookingLink);
        }

        bookingLink.dataset.wired = '1';
        bookingLink.addEventListener('click', event => {
            const isDesktop = window.matchMedia('(min-width: 1026px)').matches;
            if (!isDesktop) return;

            event.preventDefault();
            window.open(bookingLink.href, '_blank', 'noopener,noreferrer');
        });

        return true;
    }

    function initMobileContactModal() {
        const triggerBtn = document.getElementById('mobile-contact-trigger');
        const closeBtn = document.getElementById('contact-modal-close');
        const modalOverlay = document.getElementById('contact-modal-overlay');
        const modalContent = document.querySelector('.contact-modal-content');
        const contactForm = document.getElementById('contact-form');

        if (!triggerBtn || !closeBtn || !modalOverlay || !contactForm) {
            return false;
        }

        // NEW: apply data-overlay-bg if present
        const overlayBg = modalOverlay.getAttribute('data-overlay-bg');
        if (overlayBg) modalOverlay.style.background = overlayBg;

        // OPTIONAL: expose a simple API to toggle background at runtime
        window.contactModalOverlay = {
            setBackground(bg) { modalOverlay.style.background = bg; },
            disableBackground() { modalOverlay.classList.add('no-bg'); },
            enableBackground() { modalOverlay.classList.remove('no-bg'); }
        };

        function openModal() {
            const isMobile = window.matchMedia('(max-width: 1025px)').matches;
            if (!isMobile) return;
            // Ensure overlay is top-most in case of unexpected stacking contexts
            modalOverlay.style.zIndex = '999999';
            modalContent.appendChild(contactForm);
            contactForm.classList.add('in-modal'); // add class for modal-specific CSS
            modalOverlay.classList.add('is-open');
            modalOverlay.setAttribute('aria-hidden', 'false');
            document.body.classList.add('contact-modal-open');
            document.body.style.overflow = 'hidden';
            // Scroll to the modal dialog itself
            const modalDialog = document.querySelector('.contact-modal-dialog');
            if (modalDialog) {
                modalDialog.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            const firstInput = contactForm.querySelector('input');
            if (firstInput) setTimeout(() => firstInput.focus(), 100);
                attachListener(); // Re-attach listeners after moving form
        }

        function closeModal() {
            const isMobile = window.matchMedia('(max-width: 1025px)').matches;
            if (!isMobile) return;
            const hero = document.querySelector('#contact .hero');
            if (hero) hero.appendChild(contactForm);
            contactForm.classList.remove('in-modal'); // remove class when returning to page
            modalOverlay.classList.remove('is-open');
            modalOverlay.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('contact-modal-open');
            document.body.style.overflow = '';
            triggerBtn && triggerBtn.focus();
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
            if (!isMobile && modalOverlay.classList.contains('is-open')) {
                closeModal();
            }
        });

        // Mobile-only nav Contact link opens the same modal
     //   const contactNavLinks = document.querySelectorAll('a[href="#contact"]');
       // contactNavLinks.forEach(link => {
         //   link.addEventListener('click', e => {
           //     const isMobile = window.matchMedia('(max-width: 1025px)').matches;
             //   if (!isMobile) return; // allow normal scroll on desktop
               // e.preventDefault();
              //  openModal();
          //  });
       // });

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

            try {
                const response = await fetch('https://factoryfunctions.azurewebsites.net/api/SendEmailFunction?code=Bf-jCZu3gse08jleLLz2jgI7Lm1yrY1_z0hhZ_5pPMKLAzFueG16VQ==', {
                    method: 'POST',
                    body: formData
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
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    messageDiv.textContent = `Unable to send your message. ${errorMessage}`;
                    messageDiv.style.color = 'red';
                }
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
