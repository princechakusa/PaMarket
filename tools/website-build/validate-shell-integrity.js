'use strict';
const fs = require('fs');
const path = require('path');
const { DIST } = require('./file-utils');
const { PARTIALS, markerState } = require('./shell');

const REPRESENTATIVE_PAGES = ['profile.html', 'business.html', 'rentals.html', 'privacy.html'];
// Pages deliberately migrated (2026-09-21+) off the shared partials/header.html
// and partials/footer.html onto their own standalone Tailwind design, as part
// of a founder-led page-by-page redesign -- they intentionally no longer carry
// the HEADER:START/FOOTER:START marker pairs or byte-identical partial content,
// so the strict check above does not apply to them. They still get a real
// (lighter) check below: every one of them must contain the same critical
// destination links the shared partial protects, just tolerant of either link
// style in use across this migration (extensionless, matching the original
// partial convention, or a `.html` suffix, used by some of the newer pages).
const MIGRATED_PAGES = ['index.html', 'browse.html', 'jobs.html', 'institutions.html', 'institution.html'];
const REQUIRED_LINKS = {
  HEADER: ['href="browse"', 'href="post-ad"', 'href="auth"', 'href="dashboard"'],
  FOOTER: ['href="terms"', 'href="privacy"', 'href="cookie-policy"'],
};

// A migrated page may legitimately satisfy a required link with a more
// specific real equivalent -- e.g. jobs.html's "Post a Job" flow
// (post-job.html) is the correct create-content entry point for that page,
// not a generic post-ad.html link, which would be a confusing duplicate.
const LINK_ALTERNATES = { 'post-ad': ['post-job'] };

function hasLink(content, bareHref) {
  // bareHref is e.g. `href="browse"` -- also accept `href="browse.html"` and
  // `href="browse.html?...`/`href="browse?...` (query-string variants).
  const name = bareHref.slice(6, -1); // strip href=" and trailing "
  const names = [name, ...(LINK_ALTERNATES[name] || [])];
  return names.some((n) => new RegExp(`href="${n}(\\.html)?(\\?[^"]*)?"`).test(content));
}

function validateShellIntegrity() {
  const partials = Object.fromEntries(Object.entries(PARTIALS).map(([name, file]) => [name, fs.readFileSync(file, 'utf8').trim()]));
  const errors = [];
  for (const relative of REPRESENTATIVE_PAGES) {
    const file = path.join(DIST, relative);
    const content = fs.readFileSync(file, 'utf8');
    for (const name of Object.keys(PARTIALS)) {
      try {
        const state = markerState(content, name, file);
        if (!state.present) throw new Error(`missing ${name} marker pair`);
        const embedded = content.slice(state.startIndex + state.start.length, state.endIndex).trim();
        if (embedded !== partials[name]) throw new Error(`embedded ${name} does not match authoritative partial`);
        for (const link of REQUIRED_LINKS[name]) if (!embedded.includes(link)) throw new Error(`${name} is missing critical link ${link}`);
      } catch (error) {
        errors.push(`${relative}: ${error.message}`);
      }
    }
  }
  // Some migrated pages inject their footer at runtime from a shared JS
  // component (js/components/site-footer.js) instead of static markup --
  // the raw HTML alone won't show those links, so fall back to checking
  // that real, shared source file too when a page defers to it.
  const sharedFooterFile = path.join(DIST, 'js/components/site-footer.js');
  const sharedFooterContent = fs.existsSync(sharedFooterFile) ? fs.readFileSync(sharedFooterFile, 'utf8') : '';
  for (const relative of MIGRATED_PAGES) {
    const file = path.join(DIST, relative);
    const content = fs.readFileSync(file, 'utf8');
    const usesSharedFooter = /id="site-footer"/.test(content);
    for (const name of Object.keys(PARTIALS)) {
      for (const link of REQUIRED_LINKS[name]) {
        const inline = hasLink(content, link);
        const viaSharedFooter = name === 'FOOTER' && usesSharedFooter && hasLink(sharedFooterContent, link);
        if (!inline && !viaSharedFooter) errors.push(`${relative}: standalone design is missing critical link ${link}`);
      }
    }
  }
  if (errors.length) throw new Error(errors.join('\n'));
  return { pages: REPRESENTATIVE_PAGES.length + MIGRATED_PAGES.length, headerShells: REPRESENTATIVE_PAGES.length, footerShells: REPRESENTATIVE_PAGES.length };
}

module.exports = { REPRESENTATIVE_PAGES, MIGRATED_PAGES, validateShellIntegrity };
