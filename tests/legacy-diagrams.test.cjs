const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const examples = require('../interactive-examples.json');

function mountLegacy(id) {
  const fields = Object.fromEntries([
    '[data-example-previous]', '[data-example-next]', '.ex-count',
    '.ex-assumption', '.ex-canvas', '.ex-step-title', '.ex-step-text', '.ex-all-steps'
  ].map(selector => [selector, {}]));
  const element = {
    dataset: {example: id},
    querySelector: selector => fields[selector],
    querySelectorAll: () => cases
  };
  function button(attribute, value) {
    return {
      dataset: attribute === 'data-example-case' ? {exampleCase: String(value)} : {},
      setAttribute() {},
      hasAttribute: name => name === attribute,
      closest: selector => selector === '[data-example]' ? element : null
    };
  }
  const cases = examples[id].cases.map((_, index) => button('data-example-case', index));
  const next = button('data-example-next');
  let click;
  const document = {
    getElementById: () => ({textContent: JSON.stringify(examples)}),
    addEventListener: (type, handler) => { if (type === 'click') click = handler; }
  };
  const context = vm.createContext({window: {}, document});
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../diagrams.js'), 'utf8'), context);
  context.window.CourseDiagrams.mount({querySelectorAll: () => [element]});
  const press = target => click({target: {closest: () => target}});
  return {fields, select: index => press(cases[index]), next: () => press(next)};
}

test('rejected foreign-key update keeps stored product 4 in every rendered step', () => {
  assert.equal(['d1-tables', 'd1-models', 'd1-keys', 'd1-types']
    .reduce((count, id) => count + examples[id].cases.length, 0), 8);
  assert.equal(examples['d1-keys'].cases.length, 2);
  const view = mountLegacy('d1-keys');
  view.select(1);
  assert.match(view.fields['.ex-assumption'].textContent, /尝试.*改为9/);
  for (let step = 0; step < examples['d1-keys'].cases[1].steps.length; step++) {
    const canvas = view.fields['.ex-canvas'].innerHTML;
    const orders = canvas.match(/<strong>orders<\/strong>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)[1];
    const stored = [...orders.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map(row => [...row[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(cell => cell[1]));
    assert.deepEqual(stored.at(-1), ['104', '4', '1'], `stored order at step ${step + 1}`);
    if (step === 0) {
      assert.match(view.fields['.ex-step-text'].textContent, /尝试.*9.*仍.*4/);
      assert.match(canvas, /db-result-line[\s\S]*尝试.*9/);
    }
    if (step < examples['d1-keys'].cases[1].steps.length - 1) view.next();
  }
  assert.equal(view.fields['[data-example-next]'].disabled, true);
  assert.match(view.fields['.ex-step-text'].textContent, /拒绝.*仍.*4/);
  assert.match(view.fields['.ex-canvas'].innerHTML, /db-result-line[\s\S]*拒绝.*仍.*4/);
});
