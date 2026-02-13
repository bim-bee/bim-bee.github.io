// File: scripts/contact.js
document.addEventListener('DOMContentLoaded', function() {
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
        const contactNavLinks = document.querySelectorAll('a[href="#contact"]');
        contactNavLinks.forEach(link => {
            link.addEventListener('click', e => {
                const isMobile = window.matchMedia('(max-width: 1025px)').matches;
                if (!isMobile) return; // allow normal scroll on desktop
                e.preventDefault();
                openModal();
            });
        });

        return true;
    }

    function attachListener() {
        const form = document.getElementById('contact-form');
        const container = document.querySelector('.checkbox-group');
        if (form && container) {
            // File: scripts/contact.js
            // Phone input: allow only digits and a single leading '+'
            const phoneInput = document.getElementById('phone');
            if (phoneInput) {
                // Helpful on mobile keyboards
                phoneInput.setAttribute('inputmode', 'tel');

                // Block invalid keys at typing time
                phoneInput.addEventListener('keydown', (e) => {
                    const ctrlCmd = e.ctrlKey || e.metaKey;
                    const allowedNav = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','Home','End'];
                    if (allowedNav.includes(e.key) || (ctrlCmd && ['a','c','v','x'].includes(e.key.toLowerCase()))) {
                        return;
                    }
                    if (e.key === '+') {
                        const pos = phoneInput.selectionStart ?? 0;
                        // Only allow one '+' and only at position 0
                        if (pos !== 0 || phoneInput.value.includes('+')) e.preventDefault();
                        return;
                    }
                    if (!/^\d$/.test(e.key)) {
                        e.preventDefault();
                    }
                });

                // Sanitize pasted/auto-filled content
                const sanitize = () => {
                    const v = phoneInput.value;
                    const keepPlus = v.startsWith('+');
                    const digitsOnly = v.replace(/[^\d]/g, '');
                    phoneInput.value = keepPlus ? ('+' + digitsOnly) : digitsOnly;
                };
                phoneInput.addEventListener('input', sanitize);
            }
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

            const messageDiv = document.getElementById('form-message');
            form.addEventListener('submit', async e => {
                e.preventDefault();
                const nameCompany = document.getElementById('name-company').value.trim();
                const email = document.getElementById('email').value.trim();
                const phone = document.getElementById('phone').value.trim();
                const message = document.getElementById('message').value.trim();
                const interests = Array.from(
                    document.querySelectorAll('input[name="interest"]:checked')
                ).map(cb => cb.value);

                const lines = [
                    `Name/Company: ${nameCompany}`,
                    `Email: ${email}`,
                    `Phone: ${phone}`,
                    `Interested in: ${interests.join(', ')}`
                ];
                if (message) lines.push(`Message: ${message}`);
                const formData = new FormData();
                formData.append('subject', `Contact form from ${nameCompany}`);
                formData.append('body', lines.join('\n'));

                try {
                    const res = await fetch('https://factoryfunctions.azurewebsites.net/api/SendEmailFunction?code=Bf-jCZu3gse08jleLLz2jgI7Lm1yrY1_z0hhZ_5pPMKLAzFueG16VQ==', {
                        method: 'POST',
                        body: formData
                    });
                    const text = await res.text();
                    if (!res.ok) throw text;
                    if (messageDiv) {
                        messageDiv.textContent = text;
                        messageDiv.style.color = 'green';
                    }
                    const submitButton = document.getElementById('submit-button');
                    if (submitButton) submitButton.disabled = true;
                } catch (err) {
                    console.error(err);
                    if (messageDiv) {
                        messageDiv.textContent = '❌ ' + err;
                        messageDiv.style.color = 'red';
                    }
                }
            });
            return true;
        }
        return false;
    }

    if (!initMobileContactModal()) {
        const modalObserver = new MutationObserver(() => {
            if (initMobileContactModal()) modalObserver.disconnect();
        });
        modalObserver.observe(document.body, { childList: true, subtree: true });
    }

    if (!attachListener()) {
        const observer = new MutationObserver(() => {
            if (attachListener()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
});
