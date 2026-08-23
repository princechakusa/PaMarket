'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./file-utils');

const SOCIAL_IMAGE_PATH = 'img/pamarket-social-share.png';
const SOCIAL_IMAGE_URL = `https://pamarketzw.com/${SOCIAL_IMAGE_PATH}`;

function read(relative) {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

function metaContent(html, attribute, value) {
  const match = html.match(new RegExp(`<meta[^>]+${attribute}=["']${value}["'][^>]+content=["']([^"']+)["']`, 'i'));
  assert.ok(match, `missing ${value} metadata`);
  return match[1];
}

function characterizeSocialPreview() {
  const home = read('index.html');
  const image = path.join(ROOT, SOCIAL_IMAGE_PATH);
  assert.ok(fs.existsSync(image), 'social preview image must exist');
  assert.ok(fs.statSync(image).isFile(), 'social preview image must be a file');
  assert.equal(metaContent(home, 'property', 'og:image'), SOCIAL_IMAGE_URL);
  assert.equal(metaContent(home, 'property', 'og:image:secure_url'), SOCIAL_IMAGE_URL);
  assert.equal(metaContent(home, 'property', 'og:image:type'), 'image/png');
  assert.equal(metaContent(home, 'property', 'og:image:width'), '1536');
  assert.equal(metaContent(home, 'property', 'og:image:height'), '1024');
  assert.ok(metaContent(home, 'property', 'og:image:alt').length > 0);
  assert.equal(metaContent(home, 'name', 'twitter:card'), 'summary_large_image');
  assert.equal(metaContent(home, 'name', 'twitter:image'), SOCIAL_IMAGE_URL);
  assert.ok(metaContent(home, 'name', 'twitter:image:alt').length > 0);
  assert.match(home, /<link rel="canonical" href="https:\/\/pamarketzw\.com\/">/);
  assert.equal((home.match(/property=["']og:image["']/g) || []).length, 1, 'homepage must have one primary og:image');

  const dynamicPages = [
    'detail.html',
    'business.html',
    'rental-detail.html',
    'profile.html',
    'l/iphones-and-androids-for-sell-1cce0cbf-bb10-4d02-8f75-b1fa660c3f7d.html',
    'b/hellaboss-93115929-f7ca-4ee0-9a7b-d7bf9d9e2e07.html',
    'r/land-rover-range-rover-2026-4d010f8b-02b3-4a55-8171-b4cc71a9d78d.html',
  ];
  for (const relative of dynamicPages) {
    const html = read(relative);
    assert.ok(!html.includes(SOCIAL_IMAGE_URL), `${relative} must retain its own metadata authority`);
  }

  return { assertions: 19, image: SOCIAL_IMAGE_PATH, dynamicPages: dynamicPages.length };
}

if (require.main === module) {
  console.log(JSON.stringify({ ok: true, ...characterizeSocialPreview() }, null, 2));
}

module.exports = { characterizeSocialPreview };
