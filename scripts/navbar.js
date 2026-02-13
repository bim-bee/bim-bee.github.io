// Reusable navbar component to avoid duplicating markup across pages.
// Usage: <site-navbar data-root="../"></site-navbar>
// Set data-root to the relative path from the current page to the site root.
class SiteNavbar extends HTMLElement {
  connectedCallback() {
    const root = this.getAttribute('data-root') || './';
    this.innerHTML = `
    <nav id="navbar">
      <div class="logo">
        <img src="${root}images/bimbee-logo.png" alt="BIMbee Logo">
      </div>
      <ul class="nav-links" id="nav-list">
        <li><a href="${root}index.html" class="nav-link lang lang-en">Home</a></li>
        <li><a href="${root}index.html" class="nav-link lang lang-he" dir="rtl" style="display:none;">דף הבית</a></li>

        <li><a href="${root}index.html#about-us" class="nav-link lang lang-en">About Us</a></li>
        <li><a href="${root}index.html#about-us" class="nav-link lang lang-he" dir="rtl" style="display:none;">אודותינו</a></li>

        <li><a href="${root}index.html#services" class="nav-link lang lang-en">Services</a></li>
        <li><a href="${root}index.html#services" class="nav-link lang lang-he" dir="rtl" style="display:none;">פתרונות לBIM</a></li>

       <!--  <li><a href="${root}index.html#future-roadmap" class="nav-link lang lang-en">And More</a></li>
        <li><a href="${root}index.html#future-roadmap" class="nav-link lang lang-he" dir="rtl" style="display:none;">ועוד</a></li> -->

        <li><a href="${root}index.html#contact" class="nav-link lang lang-en">Contact</a></li>
        <li><a href="${root}index.html#contact" class="nav-link lang lang-he" dir="rtl" style="display:none;">צור קשר</a></li>

        <li><a href="${root}BIMBlog/blog.html" class="nav-link lang lang-en">BIMblog</a></li>
        <li><a href="${root}BIMBlog/blog.html" class="nav-link lang lang-he" dir="rtl" style="display:none;">בימ-בלוג</a></li>
      </ul>

      <div class="language-switcher">
        <a href="#" id="lang-en">English</a>|<a href="#" id="lang-he">עברית</a>
      </div>

      <div class="hamburger" onclick="toggleMenu()">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </nav>`;

    // Notify scripts that navbar is ready
    try { window.dispatchEvent(new CustomEvent('site-navbar:ready')); } catch {}
  }
}

customElements.define('site-navbar', SiteNavbar);
