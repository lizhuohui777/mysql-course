const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
const root = css.match(/:root\{([^}]+)\}/)[1];
const colors = Object.fromEntries([...root.matchAll(/--([a-z-]+):(#[0-9a-f]+);/g)].map(match => [match[1], match[2]]));

function luminance(hex) {
  const digits = hex.slice(1);
  const full = digits.length === 3 ? [...digits].map(digit => digit + digit).join('') : digits;
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

test('theme text and primary controls retain readable color contrast', () => {
  for (const [foreground, background] of [
    ['ink', 'paper'], ['ink', 'bg'], ['ink', 'highlight'],
    ['muted', 'paper'], ['muted', 'soft'], ['accent', 'paper'],
    ['accent', 'soft'], ['paper', 'accent'], ['paper', 'accent-hover']
  ]) {
    const values = [luminance(colors[foreground]), luminance(colors[background])];
    const ratio = (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
    assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}`);
  }
});

test('theme accents are shared by navigation, examples and hover states', () => {
  assert.match(css, /\.day-button\.active\{background:var\(--highlight\)/);
  assert.match(css, /\.primary:hover\{background:var\(--accent-hover\)/);
  assert.match(css, /\.source-chip\{[^}]*background:var\(--soft\)/);
  assert.match(css, /\.guided-example\{background:var\(--soft\)/);
  assert.match(css, /\.db-highlight[^}]*background:var\(--highlight\)/);
  assert.match(css, /\.string-slots>\.length-prefix\{background:var\(--warm\)/);
  assert.match(css, /\.sql-status\[data-tone="error"\]\{color:#9a3d36/);
});

test('reading fills stay near-white while purple controls remain distinct', () => {
  assert.equal(colors.soft, '#f8f5fc');
  assert.equal(colors.accent, '#7c60ab');
  assert.ok(luminance(colors.soft) > luminance('#f3ecfb'));
  for (const selector of ['pre code', 'code', '.notice,.callout', '.model-table th,.data-table th']) {
    const block = css.slice(css.indexOf(selector + '{')).split('}')[0];
    assert.ok(block.includes('background:var(--soft)'), selector);
  }
});

test('overall palette is lighter without changing accepted reading fills', () => {
  for (const [token, previous] of [
    ['bg', '#f7f4fc'], ['highlight', '#ebdff8'], ['line', '#e3dbee'],
    ['line-strong', '#d3c3e8'], ['accent-line', '#baa0da'], ['accent', '#7554ad']
  ]) {
    assert.ok(luminance(colors[token]) > luminance(previous), token);
  }
  assert.equal(colors.soft, '#f8f5fc');
  assert.equal(colors.ink, '#29213b');
  assert.match(css, /body\{background:linear-gradient\([^}]*#f7f2fc 100%\)/);
});
