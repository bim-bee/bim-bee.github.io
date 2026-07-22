(function renderTermsPage() {
  "use strict";

  const content = document.getElementById("termsContent");

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function inlineMarkdown(value) {
    let output = escapeHtml(value);
    output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
      const decodedTarget = target.replaceAll("&amp;", "&");
      const safe = /^(https?:|mailto:)/i.test(decodedTarget) ? decodedTarget : "#";
      const external = /^https?:/i.test(safe) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeHtml(safe)}"${external}>${label}</a>`;
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

  function formattedVersion() {
    const raw = String(window.NcNestingConfig?.termsVersion || "").trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
    if (!match) throw new Error("The Terms of Use version is not configured correctly.");
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  }

  async function readMarkdown() {
    const bundled = String(window.NcNestingTermsDocument?.markdown || "");

    // file:// pages cannot fetch neighboring files in normal browser security mode.
    // The generated local bundle keeps the page usable there, while hosted pages
    // still read the Markdown source directly so deployment mistakes are visible.
    if (window.location.protocol === "file:") {
      if (bundled) return bundled;
      throw new Error("The bundled Terms of Use document is unavailable.");
    }

    try {
      const sourceUrl = new URL("./TERMS%20OF%20USE.md", document.baseURI);
      const response = await fetch(sourceUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("The document is unavailable.");
      const markdown = await response.text();
      if (!markdown.trim()) throw new Error("The document is empty.");
      return markdown;
    } catch (error) {
      if (bundled) return bundled;
      throw new Error("The Terms of Use document could not be loaded.");
    }
  }

  async function loadTerms() {
    const markdown = await readMarkdown();
    const wrapper = document.createElement("div");
    wrapper.innerHTML = markdownToHtml(markdown);
    const heading = wrapper.querySelector("h1");
    const updated = document.createElement("p");
    updated.className = "terms-updated";
    updated.textContent = `Last updated: ${formattedVersion()}`;
    if (heading) heading.insertAdjacentElement("afterend", updated);
    else wrapper.prepend(updated);
    content.replaceChildren(...wrapper.childNodes);
  }

  loadTerms().catch(error => {
    content.innerHTML = `<h1>Terms of Use</h1><div class="terms-error" role="alert"><strong>Unable to load the Terms of Use.</strong><p>The document is unavailable.</p></div>`;
  });
})();
