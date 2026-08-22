// Stamps shared partials (partials/header.html, partials/footer.html) into
// every page between marker comments, so there is ONE source of truth for the
// header and footer instead of a hand-copied block in each file.
//
//   Markers (place once per page, around the injected region):
//     <!-- HEADER:START --> ... <!-- HEADER:END -->
//     <!-- FOOTER:START --> ... <!-- FOOTER:END -->
//
// Everything between START and END is replaced with the current partial.
// Pages without the markers are skipped, so this is safe to run repeatedly
// and safe to roll out page-by-page.
//
// Run:  node tools/build-includes.js
//
// Note: the partials are injected as real HTML (not fetched at runtime), so
// crawlers see the full header/footer markup — SEO and internal links are
// preserved.

const fs = require('fs');
const path = require('path');
const { PARTIALS, validateShellMarkers, inject } = require('./website-build/shell');

const ROOT = path.join(__dirname, '..');

const INCLUDES = Object.entries(PARTIALS).map(([name, file]) => ({ name, file }));

// HTML pages at the repo root (the public website).
function pageFiles() {
  return fs
    .readdirSync(ROOT)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(ROOT, f));
}

function loadPartial(file) {
  return fs.readFileSync(file, 'utf8').replace(/\s+$/, '');
}

function stamp(content, name, partial, sourcePath) {
  const next = inject(content, name, partial, sourcePath);
  return { content: next, changed: next !== content, present: next !== content || content.includes(`<!-- ${name}:START -->`) };
}

function main() {
  const partials = INCLUDES.map((i) => ({ name: i.name, html: loadPartial(i.file) }));
  let pagesTouched = 0;
  const summary = [];

  for (const file of pageFiles()) {
    let content = fs.readFileSync(file, 'utf8');
    validateShellMarkers(content, file);
    const before = content;
    const applied = [];
    for (const p of partials) {
      const res = stamp(content, p.name, p.html, file);
      content = res.content;
      if (res.present) applied.push(p.name);
    }
    if (content !== before) {
      fs.writeFileSync(file, content, 'utf8');
      pagesTouched++;
      summary.push('  ' + path.basename(file) + ' → ' + applied.join(', '));
    }
  }

  console.log('build-includes: updated ' + pagesTouched + ' page(s).');
  if (summary.length) console.log(summary.join('\n'));
}

main();
