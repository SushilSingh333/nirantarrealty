(function () {
    'use strict';

    // ==========================================
    //  WEBHOOK CONFIG (replace with real URLs)
    // ==========================================
    const WEBHOOK_URL        = 'https://connect.pabbly.com/workflow/sendwebhookdata/YOUR_WEBHOOK_HERE';
    const BACKUP_WEBHOOK_URL = '';

    // ==========================================
    //  MODAL
    // ==========================================
    const modal     = document.getElementById('leadModal');
    const modalClose = document.getElementById('modalClose');
    const modalForm  = document.getElementById('modalLeadForm');
    const modalSuccess = document.getElementById('modalSuccess');

    const openModal = (config = '') => {
        if (!modal) return;
        modal.classList.add('is-open');
        modal.setAttribute('aria-hidden', 'false');
        hideMobileSticky();
        if (config) {
            const sel = modalForm?.querySelector('select[name="config"]');
            if (sel) sel.value = config;
        }
        const first = modalForm?.querySelector('input');
        if (first) setTimeout(() => first.focus(), 60);
    };

    const closeModal = () => {
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        showMobileSticky();
    };

    if (modalClose) modalClose.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // AUTO POPUP after 12 seconds (once per session)
    const SESSION_KEY = 'nr_modal_shown';
    if (!sessionStorage.getItem(SESSION_KEY)) {
        setTimeout(() => {
            openModal();
            sessionStorage.setItem(SESSION_KEY, '1');
        }, 12000);
    }

    // ==========================================
    //  CLICK DELEGATION — CTA Buttons
    // ==========================================
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('[id^="bookVisit"], [id^="stickyVisit"]');
        if (btn) {
            e.preventDefault();
            openModal();
            return;
        }

        // Plan enquire buttons
        const planCta = e.target.closest('.plan-cta-btn');
        if (planCta) {
            e.preventDefault();
            openModal(planCta.getAttribute('data-config') || '');
            return;
        }

        // Download plan button
        const dlBtn = e.target.closest('#downloadPlanBtn');
        if (dlBtn) {
            e.preventDefault();
            openModal();
            return;
        }
    });

    // ==========================================
    //  MOBILE STICKY BAR
    // ==========================================
    const mobileSticky = document.querySelector('.mobile-sticky');

    const hideMobileSticky = () => { if (mobileSticky) mobileSticky.style.display = 'none'; };
    const showMobileSticky = () => { if (mobileSticky) mobileSticky.style.display = ''; };

    // ==========================================
    //  FLOOR PLAN TABS
    // ==========================================
    const planTabs   = document.querySelectorAll('.plan-tab');
    const planPanels = document.querySelectorAll('.plan-panel');

    planTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-plan');

            planTabs.forEach(t => t.classList.remove('active'));
            planPanels.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            const panel = document.getElementById('plan-' + target);
            if (panel) panel.classList.add('active');
        });
    });

    // ==========================================
    //  FAQ ACCORDION
    // ==========================================
    document.querySelectorAll('.faq-q').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.closest('.faq-item');
            const isOpen = item.classList.contains('active');

            document.querySelectorAll('.faq-item.active').forEach(i => i.classList.remove('active'));
            if (!isOpen) item.classList.add('active');
        });
    });

    // ==========================================
    //  SCARCITY / URGENCY ENGINE
    // ==========================================
    const TOTAL_UNITS = 48;

    function initScarcity() {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        // Pseudo-random but stable seed per day
        const sold = Math.min(TOTAL_UNITS - 8, 20 + Math.floor((dayOfYear * 7) % 20));
        const remaining = TOTAL_UNITS - sold;
        const pct = Math.round((sold / TOTAL_UNITS) * 100);
        const pctLeft = 100 - pct;

        document.querySelectorAll('.units-left').forEach(el => { el.textContent = remaining; });
        document.querySelectorAll('.percent-left').forEach(el => { el.textContent = pctLeft + '% Remaining'; });

        setTimeout(() => {
            document.querySelectorAll('.scarcity-fill').forEach(el => {
                el.style.width = pct + '%';
                if (pct > 75) el.style.background = '#d32f2f';
            });
            const heroFill = document.getElementById('heroFill');
            if (heroFill) heroFill.style.width = pct + '%';
        }, 400);
    }

    initScarcity();

    // ==========================================
    //  FORM VALIDATION + SUBMIT
    // ==========================================
    const cleanParam = (v) => (v && v.trim()) ? v.trim() : 'not_set';

    const urlP = new URLSearchParams(window.location.search);
    const tracking = {
        utm_source:   urlP.get('utm_source')   || 'not_set',
        utm_medium:   urlP.get('utm_medium')   || 'not_set',
        utm_campaign: urlP.get('utm_campaign') || 'not_set',
        utm_content:  urlP.get('utm_content')  || 'not_set',
        gclid:        urlP.get('gclid')        || 'not_set',
        fbclid:       urlP.get('fbclid')       || 'not_set',
    };

    const postWithTimeout = async (url, payload, ms = 8000) => {
        if (!url) return false;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), ms);
        try {
            const r = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: ctrl.signal
            });
            clearTimeout(timer);
            return r.ok || r.status === 0;
        } catch { clearTimeout(timer); return false; }
    };

    async function submitLead(formEl, successCallback) {
        const name   = formEl.querySelector('[name="name"]')?.value?.trim() || '';
        const phone  = formEl.querySelector('[name="phone"]')?.value?.trim() || '';
        const config = formEl.querySelector('[name="config"]')?.value?.trim() || '';
        const city   = formEl.querySelector('[name="city"]')?.value?.trim() || '';
        const email  = formEl.querySelector('[name="email"]')?.value?.trim() || '';

        // Clear previous errors
        formEl.querySelectorAll('.field-err').forEach(el => { el.style.display = 'none'; el.textContent = ''; });

        let valid = true;

        const showErr = (fieldName, msg) => {
            const el = formEl.querySelector(`[data-err="${fieldName}"]`);
            if (el) { el.textContent = msg; el.style.display = 'block'; }
            valid = false;
        };

        if (name.length < 2) showErr('name', 'Please enter your name.');
        if (!/^\d{10}$/.test(phone)) showErr('phone', 'Please enter a valid 10-digit number.');
        if (!config) showErr('config', 'Please select a configuration.');
        if (city.length < 2) showErr('city', 'Please enter your city.');

        if (!valid) return;

        const btn = formEl.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; }

        const payload = {
            name: cleanParam(name),
            phone: cleanParam(phone),
            config: cleanParam(config),
            city: cleanParam(city),
            email: cleanParam(email),
            ...tracking,
            page_url: window.location.href,
            timestamp: new Date().toISOString()
        };

        const [ok1, ok2] = await Promise.all([
            postWithTimeout(WEBHOOK_URL, payload),
            postWithTimeout(BACKUP_WEBHOOK_URL, payload)
        ]);

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> BOOK FREE SITE VISIT'; }

        successCallback(ok1 || ok2);
    }

    // Modal form
    modalForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitLead(modalForm, (ok) => {
            if (ok && modalSuccess) {
                modalSuccess.hidden = false;
                setTimeout(closeModal, 3000);
            } else if (!ok && modalSuccess) {
                modalSuccess.hidden = false;
                modalSuccess.textContent = '✅ Request received! We\'ll call you shortly.';
                modalSuccess.hidden = false;
                setTimeout(closeModal, 3000);
            }
        });
    });

    // Hero form (no modal validation fields)
    document.getElementById('heroLeadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const btn = form.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...'; }

        const name   = form.querySelector('[name="name"]')?.value?.trim() || '';
        const phone  = form.querySelector('[name="phone"]')?.value?.trim() || '';
        const config = form.querySelector('[name="config"]')?.value?.trim() || '';
        const city   = form.querySelector('[name="city"]')?.value?.trim() || '';

        if (name.length < 2 || !/^\d{10}$/.test(phone) || !config || city.length < 2) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> SEND ENQUIRY'; }
            alert('Please fill all required fields correctly.');
            return;
        }

        const payload = { name, phone, config, city, ...tracking, page_url: window.location.href, timestamp: new Date().toISOString() };
        await postWithTimeout(WEBHOOK_URL, payload);

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> SUBMITTED — We\'ll Call You!'; btn.style.background = '#2e7d32'; }
        form.reset();
    });

    // Contact form
    document.getElementById('contactLeadForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const btn = form.querySelector('[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...'; }

        const name  = form.querySelector('[name="name"]')?.value?.trim() || '';
        const phone = form.querySelector('[name="phone"]')?.value?.trim() || '';
        const city  = form.querySelector('[name="city"]')?.value?.trim() || '';

        const payload = { name, phone, city, ...tracking, page_url: window.location.href, timestamp: new Date().toISOString() };
        await postWithTimeout(WEBHOOK_URL, payload);

        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Sent! We\'ll contact you soon.'; btn.style.background = '#2e7d32'; }
        form.reset();
    });

    // ==========================================
    //  MOBILE MENU (simple toggle)
    // ==========================================
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const headerNav = document.querySelector('.header-nav');

    mobileMenuBtn?.addEventListener('click', () => {
        const isOpen = headerNav?.style.display === 'flex';
        if (headerNav) {
            headerNav.style.display = isOpen ? '' : 'flex';
            headerNav.style.flexDirection = 'column';
            headerNav.style.position = 'absolute';
            headerNav.style.top = '70px';
            headerNav.style.left = '0';
            headerNav.style.right = '0';
            headerNav.style.background = '#fff';
            headerNav.style.padding = '16px 24px';
            headerNav.style.boxShadow = '0 8px 20px rgba(0,0,0,0.1)';
            headerNav.style.zIndex = '999';
        }
        if (isOpen && headerNav) {
            headerNav.removeAttribute('style');
        }
    });

    headerNav?.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                headerNav.removeAttribute('style');
            }
        });
    });

    // ==========================================
    //  SMOOTH SCROLL FOR ALL ANCHOR LINKS
    // ==========================================
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (href === '#') return;
            const target = document.querySelector(href);
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });

    // ==========================================
    //  PASS UTM PARAMS TO ALL INTERNAL LINKS
    // ==========================================
    if (window.location.search) {
        document.querySelectorAll('a[href]:not([href^="http"]):not([href^="tel"]):not([href^="mailto"])').forEach(a => {
            const href = a.getAttribute('href');
            if (href && href !== '#') {
                const sep = href.includes('?') ? '&' : '?';
                a.setAttribute('href', href + sep + window.location.search.substring(1));
            }
        });
    }

})();