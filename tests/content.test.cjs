const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lesson = fs.readFileSync(path.join(__dirname, '../lessons/lesson-01.html'), 'utf8');

function topic(id) {
  const start = lesson.indexOf('id="' + id + '"');
  assert.notEqual(start, -1);
  return lesson.slice(start, lesson.indexOf('</article>', start));
}

function inOrder(text, parts) {
  let previous = -1;
  for (const part of parts) {
    const position = text.indexOf(part);
    assert.ok(position > previous, 'Missing or out of teaching order: ' + part);
    previous = position;
  }
}

test('SQL practice is a separate third phase with stable topic and record IDs', () => {
  const phases = [...lesson.matchAll(/<section[^>]*id="([^"]+)"[^>]*data-phase="([^"]+)"/g)];
  assert.deepEqual(phases.map(match => [match[1], match[2]]), [
    ['d1-warmup', 'recall'], ['d1-main', 'main'], ['d1-practice', 'sql'], ['d1-quiz', 'quiz'], ['d1-close', 'close']
  ]);
  assert.deepEqual([...lesson.matchAll(/<span class="section-number">(\d+)<\/span>/g)].map(match => match[1]), ['01', '02', '03', '04', '05']);
  const practice = phases[2].index;
  assert.ok(lesson.indexOf('id="d1-sql"') > practice);
  assert.match(lesson.slice(0, practice), /<\/section>\s*$/);
  assert.match(topic('d1-sql'), /data-note="d1-sql"/);
  assert.match(topic('d1-sql'), /<!-- SQL_PRACTICE:1 -->/);
});

test('both timers and navigation expose the same five learning phases', () => {
  const template = fs.readFileSync(path.join(__dirname, '../template.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  for (const id of ['phase-select', 'study-phase-select']) {
    const select = template.match(new RegExp('<select id="' + id + '">([\\s\\S]*?)</select>'))[1];
    assert.deepEqual([...select.matchAll(/<option value="([^"]+)"/g)].map(match => match[1]), ['recall', 'main', 'sql', 'quiz', 'close']);
  }
  for (const text of [template, app]) {
    inOrder(text, ['01 回忆检查', '02 今日主线', '03 SQL短练习', '04 理解自测', '05 收尾记录']);
  }
  assert.ok(app.includes('#day-content .topic'));
});

test('all days and learner time labels use the 75-minute budget with a shared closing budget', () => {
  const course = JSON.parse(fs.readFileSync(path.join(__dirname, '../curriculum.json'), 'utf8'));
  const template = fs.readFileSync(path.join(__dirname, '../template.html'), 'utf8');
  const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
  for (const day of course.days) {
    assert.deepEqual(day.budget, [3, 45, 15, 12]);
    assert.equal(day.budget.reduce((sum, minutes) => sum + minutes, 0), 75);
    assert.deepEqual(day.main_budget, { theory: 45, sql: 15 });
  }
  assert.ok(template.includes('本日用时 / 75分钟'));
  assert.ok(template.includes('回忆 / 摸底 · 3分钟'));
  assert.ok(template.includes('今日主线 · 45分钟'));
  assert.ok(template.includes('SQL短练习 · 15分钟'));
  assert.ok(template.includes('理解自测 · 与收尾共12分钟'));
  assert.ok(template.includes('收尾记录 · 与自测共12分钟'));
  assert.ok(app.includes('每天75分钟：回忆3分钟'));
  assert.ok(app.includes('自测与收尾合计12分钟'));
  assert.doesNotMatch(template + app, /90分钟|自测20分钟|收尾5分钟/);
});

test('database model definitions precede examples and capability caveats', () => {
  inOrder(topic('d1-models'), ['数据模型，就是', '关系型数据库</strong>', '非关系型数据库</strong>', '回到<code>products</code>表', '文档</strong>', '键值</strong>', '图</strong>', '<!-- EXAMPLE:d1-models -->', '能灵活表达，不等于没有任何规则']);
});

test('key definitions precede examples without implying mutually exclusive categories', () => {
  const text = topic('d1-keys');
  inOrder(text, ['键是用来', '<table', '能唯一识别一行的列或列组合', '不能再删掉任何一列的超键', '从候选键中选来', '按声明的引用规则', '1. 超键', '2. 候选键', '3. 主键', '4. 外键', '<!-- EXAMPLE:d1-keys -->']);
  assert.ok(text.includes('同一组列可以同时符合多个定义'));
  assert.ok(text.includes('键还有其他称呼'));
  assert.ok(text.includes('不是只允许所有候选键中列数最少的那一个'));
});

test('type overview situates CHAR and VARCHAR before length examples', () => {
  const text = topic('d1-types');
  inOrder(text, ['字段就是表中的列', '<table', '数值</strong>', '字符串</strong>', '日期与时间</strong>', '二进制数据</strong>', 'CHAR和VARCHAR都属于字符串类型', 'CHAR(n)：固定长度字符串', 'VARCHAR(n)：变长字符串', '两者括号里的n都是字符数，不是字节数', '<code>CHAR(4)</code>补两个空格', '<!-- EXAMPLE:d1-types -->']);
  assert.ok(text.includes('不是完整类型清单'));
});

test('learner prose omits explicit authoring narration', () => {
  const text = ['d1-models', 'd1-keys', 'd1-types'].map(topic).join('\n');
  assert.doesNotMatch(text, /先定义：|先认识“键”，再看|先看熟悉的一类|再看另一类|先抓住定义|今天的路线：|再看小例子：|图示会一步步展示|今天只重点比较/);
  assert.ok(!lesson.includes('这里检查解释，不重复增加SQL长题'));
});
