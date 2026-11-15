const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const lesson = fs.readFileSync(path.join(root, 'lessons/lesson-02.html'), 'utf8');
const course = require('../curriculum.json');
const examples = require('../interactive-examples.json');
const model = require('../state.js');
const vm = require('node:vm');

test('day two is a complete five-phase lesson with exact source mappings', () => {
  assert.ok(course.published_days.includes(1) && course.published_days.includes(2));
  assert.equal(course.days[1].status, 'ready');
  assert.deepEqual([...lesson.matchAll(/data-phase="([^"]+)"/g)].map(m => m[1]), ['recall', 'main', 'sql', 'quiz', 'close']);
  assert.equal([...lesson.matchAll(/data-quiz=/g)].length, 5);
  assert.equal([...lesson.matchAll(/type="checkbox" data-save=/g)].length, 3);
  assert.deepEqual([...lesson.matchAll(/data-sources="(\d+)"/g)].map(m => m[1]).sort(), ['28', '29', '8']);
  assert.equal([...lesson.matchAll(/<!-- EXAMPLE:/g)].length, 5);
  assert.ok(lesson.includes('<!-- SQL_PRACTICE:2 -->'));
  assert.equal(fs.existsSync(path.join(root, 'lessons/lesson-03.html')), course.published_days.includes(3));
});

test('day two defines dependencies before normalization and states rollback conditions', () => {
  for (const parts of [
    ['约束是数据库检查', 'CREATE TABLE products'],
    ['范式是关系表设计', '第一范式（1NF）要求'],
    ['函数依赖</strong>描述', '组合键</strong>', '非主属性</strong>', '部分依赖</strong>', '第二范式（2NF）'],
    ['传递依赖</strong>', '第三范式（3NF）', '更新异常', '插入异常', '删除异常'],
    ['表结构</strong>', '事务</strong>是一组', '隐式提交</strong>表示']
  ]) {
    let previous = -1;
    for (const text of parts) {
      const pos = lesson.indexOf(text);
      assert.ok(pos > previous, text);
      previous = pos;
    }
  }
  assert.match(lesson, /每一个候选键/);
  assert.match(lesson, /默认开启自动提交/);
  assert.match(lesson, /不能用用户ROLLBACK撤销/);
  assert.doesNotMatch(lesson, /先定义：|先认识.*再看|今天的路线：|图示会一步步展示/);
});

test('normalization diagrams show preserved linkage and before/after states', () => {
  for (const id of ['d2-constraints', 'd2-1nf', 'd2-2nf', 'd2-3nf', 'd2-delete']) {
    assert.equal(examples[id].cases.length, 2);
    assert.ok(examples[id].cases.every(c => c.steps.length >= 3));
  }
  const split = examples['d2-2nf'].cases[1].diagram.tables;
  assert.ok(split.every(t => t.columns.includes('product_id')));
  const category = examples['d2-3nf'].cases[1].steps[2].diagram.tables;
  assert.equal(category[0].rows.length, 0);
  assert.equal(category[1].rows.length, 1);
  assert.equal(examples['d2-delete'].cases[1].steps[2].diagram.tables.length, 0);
});

test('two-day records retain separate SQL drafts, notes and timers on revisits', () => {
  const fieldKeys = ['d1-sql-e1', 'd2-sql-e1', 'd1-keys-note', 'd2-2nf-note'];
  const catalog = { courseId: course.id, fieldKeys: new Set(fieldKeys), fieldTypes: new Map(fieldKeys.map(id => [id, 'string'])), ratingKeys: new Set(['d1-keys', 'd2-2nf']), topicIds: new Set(['d1-keys', 'd2-2nf']) };
  const record = model.create(course.id);
  model.complete(1, record);
  record.day = 2;
  record.fields = { 'd1-sql-e1': 'SELECT * FROM products;', 'd2-sql-e1': "INSERT INTO products VALUES (5,'茶',6,3);", 'd1-keys-note': '主键识别商品', 'd2-2nf-note': '名称依赖商品编号' };
  record.timing[1].sql = 1234;
  record.timing[2].sql = 5678;
  const restored = model.normalize(JSON.parse(JSON.stringify(record)), catalog, 'study');
  assert.deepEqual(restored, record);
  assert.equal(model.canOpen(1, restored), true);
  assert.equal(model.canOpen(2, restored), true);
  assert.equal(model.canOpen(3, restored), false);
});

test('SQL handoff uses the requested day, not hardcoded day-one questions', () => {
  const sqlData = fs.readFileSync(path.join(root, 'sql-exercises.json'), 'utf8');
  const context = vm.createContext({ document: { getElementById: id => ({ textContent: sqlData }) }, window: {} });
  vm.runInContext(fs.readFileSync(path.join(root, 'sql-ui.js'), 'utf8'), context);
  const text = context.window.CourseSQL.textFor('d2-sql');
  assert.ok(text.includes('INSERT INTO products'));
  assert.ok(text.includes('DELETE FROM products'));
  assert.ok(!text.includes('查询stock等于0'));
  assert.equal(context.window.CourseSQL.textFor('d2-2nf'), '');
});
