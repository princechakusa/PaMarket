'use strict';
/**
 * Structured logger with ANSI colours for the QA console output.
 * Falls back gracefully when stdout is not a TTY.
 */

const COLOURS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
};

const USE_COLOUR = process.stdout.isTTY !== false;
const c = (code, txt) => USE_COLOUR ? `${COLOURS[code]}${txt}${COLOURS.reset}` : txt;

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

const logger = {
  _indent: 0,

  _prefix(level, symbol) {
    const ts  = c('dim', `[${timestamp()}]`);
    const ind = '  '.repeat(this._indent);
    return `${ts} ${ind}${symbol} `;
  },

  agent(name) {
    const bar = '═'.repeat(60 - name.length - 3);
    console.log('\n' + c('bold', c('blue', `╔══ ${name} ${bar}╗`)));
  },

  section(title) {
    console.log(c('cyan', `\n  ┌─ ${title}`));
    this._indent = 1;
  },

  pass(msg, detail = '') {
    console.log(this._prefix('pass', c('green', '✔')) + c('green', msg) + (detail ? c('dim', '  ' + detail) : ''));
  },

  fail(msg, detail = '') {
    console.log(this._prefix('fail', c('red', '✖')) + c('red', msg) + (detail ? c('dim', '  ' + detail) : ''));
  },

  warn(msg, detail = '') {
    console.log(this._prefix('warn', c('yellow', '⚠')) + c('yellow', msg) + (detail ? c('dim', '  ' + detail) : ''));
  },

  info(msg, detail = '') {
    console.log(this._prefix('info', c('blue', 'ℹ')) + msg + (detail ? c('dim', '  ' + detail) : ''));
  },

  debug(msg) {
    if (process.env.QA_DEBUG) {
      console.log(this._prefix('debug', c('dim', '·')) + c('dim', msg));
    }
  },

  issue(severity, id, summary) {
    const icons = { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵' };
    const cols  = { critical: 'red', high: 'yellow', medium: 'yellow', low: 'blue' };
    const sev   = `[${severity.toUpperCase()}]`;
    console.log(`\n  ${icons[severity] || '⚪'} ${c(cols[severity] || 'white', sev)} ${c('bold', id)}: ${summary}`);
  },

  fix(id, type, description) {
    console.log(`\n  🔧 ${c('magenta', `FIX-${id}`)} (${type.toUpperCase()}): ${description}`);
  },

  decision(fixId, status) {
    const icons = { APPROVED: '✅', REJECTED: '❌', NEEDS_REVISION: '🔄' };
    const cols  = { APPROVED: 'green', REJECTED: 'red', NEEDS_REVISION: 'yellow' };
    console.log(`\n  ${icons[status] || '?'} ${c(cols[status] || 'white', status)}: ${fixId}`);
  },

  summary(results) {
    const total  = results.length;
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warned = results.filter(r => r.status === 'warn').length;
    console.log('\n' + c('bold', '╔══ QA SUMMARY ' + '═'.repeat(47) + '╗'));
    console.log(c('green',  `  ✔ PASSED:  ${passed}/${total}`));
    if (warned) console.log(c('yellow', `  ⚠ WARNING: ${warned}/${total}`));
    if (failed) console.log(c('red',    `  ✖ FAILED:  ${failed}/${total}`));
    console.log(c('bold', '╚' + '═'.repeat(62) + '╝\n'));
  },

  divider() {
    console.log(c('dim', '  ' + '─'.repeat(58)));
    this._indent = 0;
  },
};

module.exports = logger;
