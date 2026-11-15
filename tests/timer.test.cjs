const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const CourseState = require('../state.js');

const source = fs.readFileSync(`${__dirname}/../app.js`, 'utf8');
const courseId = 'mysql-foundations-12';
const key = `${courseId}:study:v2`;

// Run the application with an isolated record and a clock that can skip callbacks.
function harness(seed) {
  let now = 100000, activeDay = 1;
  const stored = new Map(seed ? [[key, JSON.stringify(seed)]] : []);
  const elements = new Map(), documentEvents = {}, windowEvents = {}, intervals = [];
  function element(id = '') {
    return {
      id, dataset: {}, value: '', textContent: '', innerHTML: '', hidden: false,
      classList: {toggle() {}, add() {}, remove() {}},
      listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute() {}, focus() {}, querySelector() { return element(); },
      querySelectorAll() { return []; }, getBoundingClientRect() { return {top: 0, bottom: 0}; }
    };
  }
  const get = id => {
    if (!elements.has(id)) elements.set(id, element(id));
    return elements.get(id);
  };
  const days = [1, 2].map(day => {
    const topic = element(`d${day}-topic`);
    topic.dataset = {topic: `topic ${day}`, sources: '1', references: ''};
    const quizzes = Array.from({length: 5}, (_, i) => {
      const quiz = element();
      quiz.dataset.quiz = `d${day}-q${i + 1}`;
      return quiz;
    });
    const fields = [`d${day}-exit-check`, `d${day}-sql-e1`, ...quizzes.map(q => `${q.dataset.quiz}-answer`)].map(id => {
      const field = element(id);
      field.dataset.save = id;
      field.type = id.endsWith('exit-check') ? 'checkbox' : 'textarea';
      return field;
    });
    const template = {dataset: {day: String(day)}, innerHTML: `day=${day}`, content: {
      querySelectorAll(selector) {
        return selector === '.topic' ? [topic] : selector === '[data-quiz]' ? quizzes : selector === '[data-save]' ? fields : [];
      }
    }};
    return {day, template, topic, quizzes, fields};
  });
  get('course-data').textContent = JSON.stringify({id: courseId, title: 'MySQL', version: 'test', published_days: [1, 2], days: days.map(d => ({day: d.day, title: `day ${d.day}`, week: 1, ids: ['1'], goals: [], sql: ''})), questions: {'1': {url: 'https://example.com', label: 'source'}}});
  Object.defineProperty(get('day-content'), 'innerHTML', {set(value) { activeDay = Number(value.split('=')[1]); }});
  const current = () => days[activeDay - 1];
  const document = {
    body: {dataset: {courseMode: 'study'}, classList: element().classList},
    hidden: false, getElementById: get, querySelector: () => element(),
    querySelectorAll(selector) {
      if (selector === 'template[data-day]') return days.map(d => d.template);
      if (selector === '[data-quiz]') return current().quizzes;
      if (selector === '#day-content [data-save]') return current().fields;
      if (selector === '#day-content .topic') return [current().topic];
      if (selector === '#day-content input[type="checkbox"][data-save]') return current().fields.filter(f => f.type === 'checkbox');
      return [];
    },
    addEventListener(type, callback) { documentEvents[type] = callback; }
  };
  const window = {
    CourseState, CourseDiagrams: {mount() {}}, CourseSQL: {mount() {}}, scrollTo() {},
    addEventListener(type, callback) { windowEvents[type] = callback; }
  };
  vm.runInNewContext(source, {
    window, document, localStorage: {getItem: k => stored.get(k) || null, setItem: (k, value) => stored.set(k, value)},
    Date: class extends Date { static now() { return now; } },
    setInterval(callback) { intervals.push(callback); }, setTimeout() {}, clearTimeout() {},
    requestAnimationFrame(callback) { callback(); }
  });
  return {
    get, stored, windowEvents,
    record: () => JSON.parse(stored.get(key)),
    advance(ms, callback = true) { now += ms; if (callback) intervals.forEach(fn => fn()); },
    visibility(hidden) { document.hidden = hidden; documentEvents.visibilitychange(); },
    event(type) { windowEvents[type](); },
    click(id, dataset = {}) { const target = {id, dataset}; target.closest = () => target; documentEvents.click({target}); },
    phase(value) { get('phase-select').listeners.change({target: {value}}); }
  };
}

test('background time includes throttled intervals and visibility never pauses', () => {
  const app = harness();
  app.click('timer-toggle');
  app.advance(1000);
  app.visibility(true);
  assert.equal(app.get('timer-toggle').textContent, '暂停计时');
  app.advance(120000, false);
  app.visibility(false);
  assert.equal(app.record().timing[1].recall, 121000);
  assert.equal(app.get('timer-display').textContent, '02:01');
  app.visibility(true);
  app.visibility(false);
  assert.equal(app.record().timing[1].recall, 121000);
  app.click('study-timer-toggle');
  app.advance(60000);
  app.visibility(false);
  assert.equal(app.record().timing[1].recall, 121000);
});

test('normal refresh and close settle once; restored records remain paused', () => {
  for (const event of ['beforeunload', 'pagehide']) {
    const app = harness();
    app.click('timer-toggle');
    app.advance(4321, false);
    app.event(event);
    app.event('pagehide');
    const record = app.record();
    assert.equal(record.timing[1].recall, 4321);
    const reopened = harness(record);
    reopened.advance(90000);
    reopened.visibility(false);
    assert.deepEqual(reopened.record(), record);
    assert.equal(reopened.get('timer-toggle').textContent, '继续计时');
  }
});

test('phase changes settle the old phase while day changes and completion pause', () => {
  const seed = CourseState.create(courseId);
  seed.completed = [1];
  const app = harness(seed);
  app.click('timer-toggle');
  app.advance(1000, false);
  app.phase('sql');
  app.advance(2000, false);
  app.click('', {day: '2'});
  assert.equal(app.record().timing[1].recall, 1000);
  assert.equal(app.record().timing[1].sql, 2000);
  app.advance(60000);
  app.visibility(false);
  assert.equal(app.record().timing[2].recall, 0);
  assert.equal(app.get('timer-toggle').textContent, '开始计时');

  const ready = CourseState.create(courseId);
  for (let i = 1; i <= 5; i++) {
    ready.fields[`d1-q${i}-answer`] = '已作答';
    ready.ratings[`d1-q${i}`] = 'understood';
  }
  ready.fields['d1-exit-check'] = true;
  const finishing = harness(ready);
  finishing.click('timer-toggle');
  finishing.advance(7000, false);
  finishing.click('mark-complete');
  finishing.advance(60000);
  finishing.visibility(false);
  assert.equal(finishing.record().timing[1].recall, 7000);
  assert.deepEqual(finishing.record().completed, [1]);
  assert.equal(finishing.get('timer-toggle').textContent, '继续计时');
});

test('timer settlement preserves legacy fields, ratings, progress, timing and storage shape', () => {
  const seed = CourseState.create(courseId);
  seed.completed = [1];
  seed.fields = {'d1-topic-note': '原笔记', 'd1-q1-answer': '原回答', 'd1-exit-check': true, 'd1-sql-e1': 'SELECT * FROM products;'};
  seed.ratings['d1-q1'] = 'partial';
  seed.timing[1].main = 12345;
  seed.timing[2].sql = 6789;
  const app = harness(seed);
  const baseline = app.record();
  app.click('timer-toggle');
  app.advance(4567, false);
  app.event('beforeunload');
  const saved = app.record();
  const expected = structuredClone(baseline);
  expected.timing[1].recall += 4567;
  assert.deepEqual(saved, expected);
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(seed).sort());
  assert.deepEqual([...app.stored.keys()], [key]);
});
