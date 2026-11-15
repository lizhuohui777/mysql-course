const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CourseState = require('../state.js');

const source = fs.readFileSync(`${__dirname}/../app.js`, 'utf8');
const html = fs.readFileSync(`${__dirname}/../index.html`, 'utf8');
const course = JSON.parse(html.match(/<script id="course-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const templates = [...html.matchAll(/<template\b[^>]*\bdata-day="(\d+)"[^>]*>([\s\S]*?)<\/template>/g)]
  .map(match => ({day: Number(match[1]), html: match[2]}));
const key = `${course.id}:study:v2`;
const importLimit = 32 * 1024 * 1024;

function element(id = '') {
  return {
    id, dataset: {}, value: '', textContent: '', innerHTML: '', hidden: false,
    classList: {toggle() {}, add() {}, remove() {}},
    listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; },
    setAttribute() {}, removeAttribute() {}, focus() {}, showModal() {},
    querySelector() { return element(); }, querySelectorAll() { return []; },
    getBoundingClientRect() { return {top: 0, bottom: 0}; }
  };
}

// The app builds its own catalog from the actual bundled lesson attributes.
function templateNodes(text) {
  return [...text.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)].map(match => {
    const node = element();
    const attributes = Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(attr => [attr[1], attr[2]]));
    node.id = attributes.id || '';
    node.type = attributes.type || match[1];
    node.topic = (attributes.class || '').split(/\s+/).includes('topic');
    for (const [name, value] of Object.entries(attributes)) {
      if (name.startsWith('data-')) node.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    return node;
  });
}

function harness(seed = CourseState.create(course.id), confirm = true) {
  let activeDay = 1, catalog, confirmations = 0;
  const stored = new Map([[key, JSON.stringify(seed)]]);
  const elements = new Map(), documentEvents = {};
  const get = id => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const lessons = templates.map(template => {
    const nodes = templateNodes(template.html);
    const select = selector => selector === '.topic' ? nodes.filter(node => node.topic)
      : selector === '[data-save]' ? nodes.filter(node => node.dataset.save)
      : selector === '[data-quiz]' ? nodes.filter(node => node.dataset.quiz)
      : selector === '[data-topic-rating]' ? nodes.filter(node => node.dataset.topicRating) : [];
    return {day: template.day, select, template: {dataset: {day: String(template.day)}, innerHTML: `day=${template.day}`, content: {querySelectorAll: select}}};
  });
  get('course-data').textContent = JSON.stringify(course);
  Object.defineProperty(get('day-content'), 'innerHTML', {set(value) { activeDay = Number(value.split('=')[1]); }});
  const current = () => lessons.find(lesson => lesson.day === activeDay);
  const document = {
    body: {dataset: {courseMode: 'study'}, classList: element().classList},
    getElementById: get, querySelector: () => element(),
    querySelectorAll(selector) {
      if (selector === 'template[data-day]') return lessons.map(lesson => lesson.template);
      if (selector === '[data-quiz]') return current().select(selector);
      if (selector === '[data-topic-rating]') return current().select(selector);
      if (selector === '#day-content [data-save]') return current().select('[data-save]');
      if (selector === '#day-content .topic') return current().select('.topic');
      if (selector === '#day-content input[type="checkbox"][data-save]') return current().select('[data-save]').filter(field => field.type === 'checkbox');
      return [];
    },
    addEventListener(type, callback) { documentEvents[type] = callback; }
  };
  const window = {
    CourseState: {...CourseState, normalize(raw, actualCatalog, mode) { catalog = actualCatalog; return CourseState.normalize(raw, actualCatalog, mode); }},
    CourseDiagrams: {mount() {}}, CourseSQL: {mount() {}}, scrollTo() {}, addEventListener() {},
    confirm() { confirmations++; return confirm; }
  };
  vm.runInNewContext(source, {
    window, document, Blob, URL: {createObjectURL() { return 'blob:synthetic-record'; }, revokeObjectURL() {}},
    localStorage: {getItem: name => stored.get(name) || null, setItem: (name, value) => stored.set(name, value)},
    Date: class extends Date { static now() { return 100000; } },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, requestAnimationFrame(callback) { callback(); }
  });
  return {
    catalog, get, stored, record: () => JSON.parse(stored.get(key)), confirmations: () => confirmations,
    click(id) { const target = {id, dataset: {}}; target.closest = () => target; documentEvents.click({target}); },
    async import(file) { const target = get('import-data'); target.files = [file]; target.value = 'synthetic.json'; await target.listeners.change({target}); }
  };
}

function maximalRecord(catalog, text) {
  const record = CourseState.create(course.id);
  record.completed = Array.from({length: 12}, (_, index) => index + 1);
  record.day = 12;
  for (const [name, type] of catalog.fieldTypes) record.fields[name] = type === 'string' ? text : false;
  for (const name of catalog.ratingKeys) record.ratings[name] = 'understood';
  for (const timing of Object.values(record.timing)) for (const phase of CourseState.PHASES) timing[phase] = 0.0000010000000000000002;
  record.ui.noteTopic = [...catalog.topicIds].sort((left, right) => right.length - left.length)[0];
  return record;
}

function assertSameRecord(actual, expected) {
  const {fields: actualFields, ...actualState} = actual;
  const {fields: expectedFields, ...expectedState} = expected;
  assert.deepEqual(actualState, expectedState);
  assert.deepEqual(Object.keys(actualFields).sort(), Object.keys(expectedFields).sort());
  for (const [name, value] of Object.entries(expectedFields)) assert.equal(actualFields[name] === value, true, `preserved field: ${name}`);
}

test('32MiB covers every legal catalog field at its maximum including JSON escape expansion', async t => {
  assert.equal(templates.length, 12);
  const catalog = harness().catalog;
  assert.equal(catalog.topicIds.size, 61);
  assert.equal([...catalog.fieldTypes.values()].filter(type => type === 'string').length, 230);
  assert.equal([...catalog.fieldTypes.values()].filter(type => type === 'boolean').length, 36);
  for (const character of ['汉', '\u0000']) {
    const record = maximalRecord(catalog, character.repeat(20000));
    assertSameRecord(CourseState.normalize(record, catalog, 'study'), record);
    const exporting = harness(record);
    exporting.click('export-data');
    const exportedRecord = exporting.record();
    const exported = exporting.get('export-output').value;
    const size = Buffer.byteLength(exported);
    t.diagnostic(`${character === '\u0000' ? 'JSON-escaped controls' : 'Chinese text'}: ${size} exported bytes from the complete legal catalog`);
    assert.ok(size > 10 * 1024 * 1024, 'the old guard rejects this legal export');
    assert.ok(size < importLimit);
    if (character === '\u0000') {
      const overhead = size - 230 * 20000 * 6;
      assert.ok(overhead > 0);
      const upperBound = 230 * 20000 * 6 + overhead + 60 * 32 + 32;
      assert.ok(upperBound < importLimit, 'numeric metadata headroom also fits');
      t.diagnostic(`Conservative bound including 32 bytes per timing number: ${upperBound} < ${importLimit}`);
    }
    const restoring = harness();
    let reads = 0;
    await restoring.import({size, async text() { reads++; return exported; }});
    assert.equal(reads, 1);
    assert.equal(restoring.confirmations(), 1);
    assertSameRecord(restoring.record(), exportedRecord);
    assert.match(restoring.get('toast').textContent, /记录已恢复，计时保持暂停/);
    assert.notEqual(restoring.get('timer-toggle').textContent, '暂停计时');
    assert.equal(restoring.get('import-data').value, '');
  }
});

test('oversize imports are rejected before reading or confirmation and keep the current record', async () => {
  const seed = CourseState.create(course.id);
  seed.fields['d1-tables-note'] = '保留当前笔记';
  const app = harness(seed);
  app.click('timer-toggle');
  const baseline = app.stored.get(key);
  let reads = 0;
  await app.import({size: importLimit + 1, async text() { reads++; throw Error('must not read'); }});
  assert.equal(reads, 0);
  assert.equal(app.confirmations(), 0);
  assert.equal(app.stored.get(key), baseline);
  assert.match(app.get('toast').textContent, /超过32MiB/);
  assert.equal(app.get('timer-toggle').textContent, '暂停计时');
  assert.equal(app.get('import-data').value, '');
});

test('a recognized field longer than 20000 is still rejected without replacing current text', async () => {
  const seed = CourseState.create(course.id);
  seed.fields['d1-tables-note'] = '原笔记';
  const app = harness(seed);
  const baseline = app.stored.get(key);
  const invalid = JSON.stringify({...seed, fields: {'d1-tables-note': '汉'.repeat(20001)}});
  await app.import({size: Buffer.byteLength(invalid), async text() { return invalid; }});
  assert.equal(app.stored.get(key), baseline);
  assert.equal(app.confirmations(), 0);
  assert.match(app.get('toast').textContent, /20000/);
});

test('declining replacement keeps the current record and running timer unchanged', async () => {
  const seed = CourseState.create(course.id);
  seed.fields['d1-tables-note'] = '继续保留';
  const app = harness(seed, false);
  app.click('timer-toggle');
  const baseline = app.stored.get(key);
  const exported = JSON.stringify({...seed, fields: {'d1-tables-note': '另一个合成记录'}});
  await app.import({size: Buffer.byteLength(exported), async text() { return exported; }});
  assert.equal(app.confirmations(), 1);
  assert.equal(app.stored.get(key), baseline);
  assert.equal(app.get('timer-toggle').textContent, '暂停计时');
});
