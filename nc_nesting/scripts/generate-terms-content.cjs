const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const sources = {
  en: path.join(root, "TERMS OF USE.md"),
  he: path.join(root, "TERMS OF USE.he.md")
};
const outputPath = path.join(__dirname, "terms-content.js");
const documents = {};
const hashes = {};

for (const [language, sourcePath] of Object.entries(sources)) {
  const markdown = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
  documents[language] = markdown;
  hashes[language] = crypto.createHash("sha256").update(markdown).digest("hex");
}

const output = `/* GENERATED from the English and Hebrew Terms sources. Do not edit directly.\n   Source SHA-256: en=${hashes.en}; he=${hashes.he} */\n(function exposeNcNestingTermsDocuments() {\n  "use strict";\n  window.NcNestingTermsDocuments = Object.freeze(${JSON.stringify(documents)});\n  window.NcNestingTermsDocument = Object.freeze({ markdown: window.NcNestingTermsDocuments.en });\n})();\n`;

fs.writeFileSync(outputPath, output, "utf8");
console.log(`Wrote ${path.relative(root, outputPath)}`);
