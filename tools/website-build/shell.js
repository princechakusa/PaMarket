'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PARTIALS = {
  HEADER: path.join(ROOT, 'partials', 'header.html'),
  FOOTER: path.join(ROOT, 'partials', 'footer.html'),
};

function sourceLabel(sourcePath) {
  if (!sourcePath) return 'HTML source';
  const relative = path.relative(ROOT, sourcePath).replace(/\\/g, '/');
  return relative && !relative.startsWith('../') ? relative : path.basename(sourcePath);
}

function markerState(content, name, sourcePath) {
  const start = `<!-- ${name}:START -->`;
  const end = `<!-- ${name}:END -->`;
  const starts = [...content.matchAll(new RegExp(start, 'g'))].map(match => match.index);
  const ends = [...content.matchAll(new RegExp(end, 'g'))].map(match => match.index);
  const validAbsent = starts.length === 0 && ends.length === 0;
  const validPair = starts.length === 1 && ends.length === 1 && starts[0] < ends[0];
  if (!validAbsent && !validPair) {
    let reason = `expected no markers or exactly one ordered START/END pair; found ${starts.length} START and ${ends.length} END`;
    if (starts.length === 1 && ends.length === 1 && ends[0] < starts[0]) reason += ' (END appears before START)';
    throw new Error(`Invalid ${name} markers in ${sourceLabel(sourcePath)}: ${reason}.`);
  }
  return { present: validPair, start, end, startIndex: starts[0], endIndex: ends[0] };
}

function validateShellMarkers(content, sourcePath) {
  const header = markerState(content, 'HEADER', sourcePath);
  const footer = markerState(content, 'FOOTER', sourcePath);
  if (header.present && footer.present) {
    const overlaps = header.startIndex < footer.endIndex && footer.startIndex < header.endIndex;
    if (overlaps) throw new Error(`Invalid shell markers in ${sourceLabel(sourcePath)}: HEADER and FOOTER pairs overlap.`);
  }
}

function inject(content, name, partial, sourcePath) {
  const state = markerState(content, name, sourcePath);
  if (!state.present) return content;
  const afterEnd = state.endIndex + state.end.length;
  return content.slice(0, state.startIndex)
    + state.start + '\n' + partial.trimEnd() + '\n' + state.end
    + content.slice(afterEnd);
}

function assembleHtml(content, sourcePath, partials = PARTIALS) {
  validateShellMarkers(content, sourcePath);
  for (const [name, file] of Object.entries(partials)) {
    let partial;
    try {
      partial = fs.readFileSync(file, 'utf8');
    } catch (error) {
      throw new Error(`Cannot read ${name} partial ${sourceLabel(file)} while assembling ${sourceLabel(sourcePath)}: ${error.code || 'read failed'}.`);
    }
    content = inject(content, name, partial, sourcePath);
  }
  return content;
}

module.exports = { PARTIALS, markerState, validateShellMarkers, inject, assembleHtml };
