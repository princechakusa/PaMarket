'use strict';
const fs = require('fs');
const path = require('path');
const { DIST } = require('./file-utils');
const { PARTIALS, markerState } = require('./shell');

const REPRESENTATIVE_PAGES = ['index.html', 'browse.html', 'profile.html', 'business.html', 'rentals.html', 'privacy.html'];
const REQUIRED_LINKS = {
  HEADER: ['href="browse"', 'href="post-ad"', 'href="auth"', 'href="dashboard"'],
  FOOTER: ['href="terms"', 'href="privacy"', 'href="cookie-policy"'],
};

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
  if (errors.length) throw new Error(errors.join('\n'));
  return { pages: REPRESENTATIVE_PAGES.length, headerShells: REPRESENTATIVE_PAGES.length, footerShells: REPRESENTATIVE_PAGES.length };
}

module.exports = { REPRESENTATIVE_PAGES, validateShellIntegrity };
