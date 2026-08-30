(function () {
    const measurementId = 'G-GD41K6C42F';

    function readRecipientId() {
        const rawHash = window.location.hash
            ? window.location.hash.slice(1).trim()
            : '';

        if (!rawHash) {
            return '';
        }

        try {
            return decodeURIComponent(rawHash);
        } catch {
            return rawHash;
        }
    }

    function clearVisibleHash() {
        if (!window.location.hash) {
            return;
        }

        const cleanPath =
            `${window.location.pathname}${window.location.search}`;

        if (
            window.history &&
            typeof window.history.replaceState === 'function'
        ) {
            window.history.replaceState(
                null,
                document.title,
                cleanPath
            );
            return;
        }

        window.location.hash = '';
    }

    function derivePageId() {
        const path = window.location.pathname || '';
        const pathParts = path.split('/').filter(Boolean);
        const fileName = pathParts[pathParts.length - 1] || '';

        // BIMBlog article
        if (path.includes('/BIMBlog/posts/')) {
            return fileName
                .replace(/\.html$/i, '')
                .replace(/^\d{4}-\d{2}-\d{2}-/, '') || 'post';
        }

        // NC nesting calculator
        if (path.includes('/nc_nesting')) {
            return 'nc_nesting';
        }

        // Generic fallback
        return fileName
            .replace(/\.html$/i, '') ||
            pathParts[pathParts.length - 1] ||
            'page';
    }

    function deriveCampaignName(pageId) {
        const path = window.location.pathname || '';

        if (path.includes('/BIMBlog/posts/')) {
            return `bimblog-${pageId}`;
        }

        if (path.includes('/nc_nesting')) {
            return 'nc_nesting';
        }

        return `campaign-${pageId}`;
    }

    const recipientId = readRecipientId();
    const pageId = derivePageId();

    if (recipientId) {
        clearVisibleHash();
    }

    window.dataLayer = window.dataLayer || [];

    window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
    };

    window.gtag('js', new Date());

    const config = {
        send_page_view: false
    };

    if (recipientId) {
        config.user_id = recipientId;
        config.campaign_source = 'email';
        config.campaign_medium = 'email';
        config.campaign_name = deriveCampaignName(pageId);
        config.campaign_content = pageId;
    }

    window.gtag('config', measurementId, config);

    window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path:
            `${window.location.pathname}${window.location.search}`
    });
})();