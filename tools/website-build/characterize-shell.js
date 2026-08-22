'use strict';
const assert = require('assert');
const path = require('path');
const { ROOT } = require('./file-utils');
const { PARTIALS, inject, assembleHtml } = require('./shell');

const H_START = '<!-- HEADER:START -->';
const H_END = '<!-- HEADER:END -->';
const F_START = '<!-- FOOTER:START -->';
const F_END = '<!-- FOOTER:END -->';
const source = path.join(ROOT, 'shell-characterization.html');

function denied(content, name) {
  assert.throws(() => inject(content, name, '<nav>shell</nav>', source), error => (
    error.message.includes(`Invalid ${name} markers`)
    && error.message.includes('shell-characterization.html')
  ));
}

function characterizeShell() {
  let assertions = 0;
  assert.equal(inject('<main>plain</main>', 'HEADER', 'header', source), '<main>plain</main>'); assertions++;
  assert.match(inject(`${H_START}old${H_END}`, 'HEADER', 'header', source), /HEADER:START -->\nheader\n<!-- HEADER:END/); assertions++;
  assert.match(inject(`${F_START}old${F_END}`, 'FOOTER', 'footer', source), /FOOTER:START -->\nfooter\n<!-- FOOTER:END/); assertions++;
  assert.match(assembleHtml(`${H_START}old${H_END}${F_START}old${F_END}`, source), /<footer>/); assertions++;

  for (const value of [
    H_START, H_END, `${H_END}${H_START}`,
    `${H_START}${H_START}${H_END}`, `${H_START}${H_END}${H_END}`,
    `${H_START}a${H_END}${H_START}b${H_END}`,
    `${H_START}${H_START}${H_END}${H_END}`,
  ]) { denied(value, 'HEADER'); assertions++; }
  for (const value of [
    F_START, F_END, `${F_END}${F_START}`,
    `${F_START}${F_START}${F_END}`, `${F_START}${F_END}${F_END}`,
    `${F_START}a${F_END}${F_START}b${F_END}`,
    `${F_START}${F_START}${F_END}${F_END}`,
  ]) { denied(value, 'FOOTER'); assertions++; }
  assert.throws(
    () => assembleHtml(`${H_START}${F_START}${H_END}${F_END}`, source),
    /HEADER and FOOTER pairs overlap/
  ); assertions++;

  const missingHeader = { ...PARTIALS, HEADER: path.join(ROOT, 'partials', '__missing-header__.html') };
  const missingFooter = { ...PARTIALS, FOOTER: path.join(ROOT, 'partials', '__missing-footer__.html') };
  assert.throws(() => assembleHtml(`${H_START}old${H_END}`, source, missingHeader), /Cannot read HEADER partial/); assertions++;
  assert.throws(() => assembleHtml(`${F_START}old${F_END}`, source, missingFooter), /Cannot read FOOTER partial/); assertions++;
  return assertions;
}

module.exports = { characterizeShell };
