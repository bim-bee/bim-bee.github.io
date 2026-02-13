(function(){
  const postsContainer = document.getElementById('posts');
  const searchInput = document.getElementById('search');
  const tagFilter = document.getElementById('tag-filter');
  const sortOrder = document.getElementById('sort-order');
  // Date filters removed
  const yearSpan = document.getElementById('year');
  if (yearSpan) yearSpan.textContent = new Date().getFullYear();

  let allPosts = [];
  // Initialize from navbar's persisted language if available
  let currentLang = (window.currentLang || window.defaultLang || (function(){
    try { return localStorage.getItem('bimbee_lang') || 'en'; } catch { return 'en'; }
  })());

  // Wrap setLanguage to detect language changes from the shared navbar script
  const originalSetLanguage = typeof window.setLanguage === 'function' ? window.setLanguage.bind(window) : null;
  if (originalSetLanguage) {
    window.setLanguage = function(lang){
      originalSetLanguage(lang);
      currentLang = lang;
      updateUITexts();
      applyFilters();
    };
  }

  // Also listen to global language change events so we react regardless of load order
  window.addEventListener('bimbee:languagechange', (ev) => {
    const lang = ev && ev.detail && ev.detail.lang ? ev.detail.lang : null;
    if (lang && lang !== currentLang) {
      currentLang = lang;
      updateUITexts();
      applyFilters();
    }
  });

  function getLang(){
    return currentLang || 'en';
  }

  function formatDate(iso){
    try {
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch { return iso; }
  }

  function renderTags(tags){
    if (!tags || !tags.length) return '';
    return tags.map(t => `<span class="tag">${t}</span>`).join('');
  }

  function renderPosts(list){
    postsContainer.innerHTML = '';
    if (!list.length){
      postsContainer.innerHTML = '<p class="muted">No posts match your filters yet.</p>';
      return;
    }

    const frag = document.createDocumentFragment();
    const lang = getLang();
    list.forEach(p => {
      const card = document.createElement('article');
      card.className = 'post-card';
      const thumbnailSrc = p.thumbnail || '../images/play-placeholder.jpg';
      const rawTitle = (lang === 'he' ? (p.title_he || p.title) : (p.title_en || p.title || ''));
      const rawExcerpt = (lang === 'he' ? (p.excerpt_he || p.excerpt) : (p.excerpt_en || p.excerpt || ''));
      const readTime = (lang === 'he' ? (p.readTime_he || p.readTime) : (p.readTime_en || p.readTime || ''));
      const plainTitle = (rawTitle || '').replace(/<[^>]*>/g,'').trim();
      const plainExcerpt = (rawExcerpt || '').replace(/<[^>]*>/g,'').trim();
      const thumb = `<a class="post-link" href="${p.url}"><img class="thumb" src="${thumbnailSrc}" alt="${plainTitle}" loading="lazy" /></a>`;
      card.innerHTML = `
        ${thumb}
        <div class="post-body">
          <h2 class="post-title"></h2>
          <div class="post-meta">${formatDate(p.date)} • ${readTime}</div>
          <p class="post-excerpt"></p>
          <div class="post-tags">${renderTags(lang === 'he' ? (p.tags_he || p.tags) : (p.tags || p.tags_he))}</div>
        </div>
      `;

      // Inject the title safely after structure creation
      const titleEl = card.querySelector('h2.post-title');
      const linkEl = document.createElement('a');
      linkEl.href = p.url;
      if (lang === 'he') {
        linkEl.innerHTML = rawTitle; // allow embedded spans
        titleEl.dir = 'rtl';
        titleEl.style.unicodeBidi = 'bidi-override';
      } else {
        linkEl.textContent = plainTitle;
      }
      titleEl.appendChild(linkEl);

      // Inject excerpt safely (Hebrew may contain spans)
      const excerptEl = card.querySelector('p.post-excerpt');
      if (excerptEl) {
        if (lang === 'he') {
          excerptEl.innerHTML = rawExcerpt;
          excerptEl.dir = 'rtl';
          excerptEl.style.unicodeBidi = 'bidi-override';
        } else {
          excerptEl.textContent = plainExcerpt;
        }
      }

      // Accessibility labels (use plain text only)
      const thumbLink = card.querySelector('a.post-link');
      if (thumbLink) thumbLink.setAttribute('aria-label', plainTitle);
      // Make the entire card clickable for easier navigation
      const cover = document.createElement('a');
      cover.href = p.url;
      cover.className = 'stretched-link';
      cover.setAttribute('aria-label', plainTitle);
      card.appendChild(cover);
      frag.appendChild(card);
    });
    postsContainer.appendChild(frag);
  }

  function applyFilters(){
    const q = (searchInput.value || '').toLowerCase();
    const tag = tagFilter.value;
    // Date filters removed
    const lang = getLang();
    let filtered = allPosts;
    if (q){
      filtered = filtered.filter(p => {
        const titleStr = (lang === 'he' ? (p.title_he || p.title) : (p.title_en || p.title) || '').replace(/<[^>]*>/g,'');
        const excerptStr = (lang === 'he' ? (p.excerpt_he || p.excerpt) : (p.excerpt_en || p.excerpt) || '').replace(/<[^>]*>/g,'');
        const tagsArr = (lang === 'he' ? (p.tags_he || p.tags) : (p.tags || p.tags_he)) || [];
        return titleStr.toLowerCase().includes(q) ||
               excerptStr.toLowerCase().includes(q) ||
               tagsArr.some(t => (t||'').toLowerCase().includes(q));
      });
    }
    if (tag){
      const tagList = (p) => (lang === 'he' ? (p.tags_he || p.tags) : (p.tags || p.tags_he)) || [];
      filtered = filtered.filter(p => tagList(p).includes(tag));
    }
    // Date filtering removed

    // Sort order
    const order = sortOrder ? sortOrder.value : 'newest';
    filtered = filtered.slice().sort((a,b) => {
      const da = new Date(a.date), db = new Date(b.date);
      const diff = db - da; // newest first by default
      return order === 'oldest' ? -diff : diff;
    });
    renderPosts(filtered);
  }

  function populateTags(){
    const set = new Set();
    const lang = getLang();
    allPosts.forEach(p => ((lang === 'he' ? (p.tags_he || p.tags) : (p.tags || p.tags_he))||[]).forEach(t => set.add(t)));
    const options = [`<option value="">${lang === 'he' ? 'כל הנושאים' : 'All topics'}</option>`];
    [...set].sort((a,b)=>a.localeCompare(b)).forEach(t => {
      options.push(`<option value="${t}">${t}</option>`);
    });
    tagFilter.innerHTML = options.join('');
  }

  function initEvents(){
    searchInput.addEventListener('input', applyFilters);
    tagFilter.addEventListener('change', applyFilters);
    if (sortOrder) sortOrder.addEventListener('change', applyFilters);
    // Date filter event listeners removed
  }

  function updateUITexts(){
    const lang = getLang();
    if (searchInput) searchInput.placeholder = lang === 'he' ? 'חיפוש פוסטים…' : 'Search posts...';
    if (sortOrder) {
      // Rebuild options with localized labels but preserve value
      const cur = sortOrder.value || 'newest';
      sortOrder.innerHTML = '';
      const opt1 = document.createElement('option'); opt1.value = 'newest'; opt1.textContent = lang === 'he' ? 'חדשים תחילה' : 'Newest first';
      const opt2 = document.createElement('option'); opt2.value = 'oldest'; opt2.textContent = lang === 'he' ? 'ישנים תחילה' : 'Oldest first';
      sortOrder.append(opt1, opt2);
      sortOrder.value = cur;
    }
    // Rebuild tag options to localize the first label and reflect language-specific tags
    populateTags();
  }

  async function loadPosts(){
    // 1) JS global fallback (works on file:// and http)
    if (window.BIM_POSTS && Array.isArray(window.BIM_POSTS.posts)){
      allPosts = window.BIM_POSTS.posts.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
      updateUITexts();
      if (sortOrder) sortOrder.value = 'oldest';
      applyFilters();
      return;
    }

    // 2) Try network (works on http/https)
    try {
      const res = await fetch('posts.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to load posts.json');
      const data = await res.json();
      allPosts = (data.posts || []).sort((a,b) => new Date(b.date) - new Date(a.date));
      updateUITexts();
      if (sortOrder) sortOrder.value = 'oldest';
      applyFilters();
      return;
    } catch (err){
      console.warn('posts.json fetch failed, trying inline fallback...', err);
    }

    // 3) Inline JSON embedded in the page
    try {
      const el = document.getElementById('posts-data');
      if (el && el.textContent) {
        const data = JSON.parse(el.textContent);
        allPosts = (data.posts || []).sort((a,b) => new Date(b.date) - new Date(a.date));
        updateUITexts();
        if (sortOrder) sortOrder.value = 'oldest';
        applyFilters();
        return;
      }
    } catch (err2){
      console.error('Failed to parse inline posts data', err2);
    }

    postsContainer.innerHTML = '<p class="error">Could not load posts. Please try again later.</p>';
  }

  // Bootstrap
  initEvents();
  loadPosts();
})();
