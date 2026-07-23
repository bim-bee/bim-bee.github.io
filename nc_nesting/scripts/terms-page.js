(function renderTermsPage() {
  "use strict";

  const I18N = window.NCNestingI18n;
  const t = (key, params = {}, language) => I18N.t(key, params, language);
  const content = document.getElementById("termsContent");
  let loadSequence = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inlineMarkdown(value) {
    let output = escapeHtml(value).replace(/\bBIMbee\b/g, '<bdi dir="ltr">BIMbee</bdi>');
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
      const decodedTarget = target.replaceAll("&amp;", "&");
      const safe = /^(https?:|mailto:)/i.test(decodedTarget) ? decodedTarget : "#";
      const external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : "";
      const direction = /@|^https?:|^www\./i.test(label) ? ' dir="ltr"' : ' dir="auto"';
      return `<a href="${escapeHtml(safe)}"${external}${direction}>${label}</a>`;
    });
    output = output.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    return output;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replaceAll("\r\n", "\n").split("\n");
    const blocks = [];
    let paragraph = [];
    let list = [];

    const flushParagraph = () => {
      if (!paragraph.length) return;
      blocks.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const flushList = () => {
      if (!list.length) return;
      blocks.push(`<ul>${list.map(item => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
      list = [];
    };

    lines.forEach(line => {
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      const item = /^\s*[*-]\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        const level = heading[1].length;
        blocks.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      } else if (item) {
        flushParagraph();
        list.push(item[1]);
      } else if (!line.trim()) {
        flushParagraph();
        flushList();
      } else {
        flushList();
        paragraph.push(line.trim());
      }
    });

    flushParagraph();
    flushList();
    return blocks.join("\n");
  }

  function formattedVersion(language) {
    const raw = String(window.NcNestingConfig?.termsVersion || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) throw new Error("terms.versionInvalid");
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return I18N.formatDate(date, { month: "long", year: "numeric", timeZone: "UTC" }, language);
  }

  async function readMarkdown(language) {
    const bundled = String(window.NcNestingTermsDocuments?.[language] || window.NcNestingTermsDocument?.markdown || "");

    if (window.location.protocol === "file:") {
      if (bundled) return bundled;
      throw new Error("terms.bundleUnavailable");
    }

    try {
      const fileName = language === "he" ? "TERMS%20OF%20USE.he.md" : "TERMS%20OF%20USE.md";
      const sourceUrl = new URL(`./${fileName}`, document.baseURI);
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("terms.documentUnavailable");
      const markdown = await response.text();
      if (!markdown.trim()) throw new Error("terms.documentEmpty");
      return markdown;
    } catch (error) {
      if (bundled) return bundled;
      throw error;
    }
  }

  async function loadTerms(language = I18N.getLanguage()) {
    const sequence = ++loadSequence;
    I18N.apply(document, language);
    document.title = t("page.terms.title", {}, language);
    content.innerHTML = `<p class="terms-loading">${escapeHtml(t("terms.loading", {}, language))}</p>`;
    try {
      const markdown = await readMarkdown(language);
      if (sequence !== loadSequence) return;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = markdownToHtml(markdown);
      const heading = wrapper.querySelector("h1");
      const updated = document.createElement("p");
      updated.className = "terms-updated";
      updated.textContent = t("terms.lastUpdated", { date: formattedVersion(language) }, language);
      if (heading) heading.insertAdjacentElement("afterend", updated);
      else wrapper.prepend(updated);
      content.replaceChildren(...wrapper.childNodes);
      content.setAttribute("dir", I18N.direction(language));
    } catch {
      if (sequence !== loadSequence) return;
      content.innerHTML = `<h1>${escapeHtml(t("action.terms", {}, language))}</h1><div class="terms-error" role="alert"><strong>${escapeHtml(t("terms.loadFailed", {}, language))}</strong><p>${escapeHtml(t("terms.documentUnavailable", {}, language))}</p></div>`;
    }
  }

  I18N.listen(language => loadTerms(language));
  window.addEventListener("site-navbar:ready", () => loadTerms(), { once: true });
  loadTerms();
})();
