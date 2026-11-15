const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const labs = require('../learning-labs.js');
const examples = require('../interactive-examples.json');
const result = (model, options, choice) => labs.result({...labs.create(model, options), choice});
const read = n => fs.readFileSync(`${__dirname}/../lessons/lesson-${String(n).padStart(2, '0')}.html`, 'utf8');

test('assessed auto-increment gaps are explained outside folded supplements', () => {
  const topic = read(5).match(/<article class="topic" id="d5-primary"[\s\S]*?<\/article>/)[0];
  const visible = topic.replace(/<details>[\s\S]*?<\/details>/g, '');
  assert.match(visible, /自增值可以跳号，回滚或删除不保证连续。/);
  assert.equal(topic.split('自增值可以跳号').length - 1, 1);
  assert.match(topic, /<details><summary>编号边界<\/summary><p>最大id不是订单总数/);
});

test('EXPLAIN definition and fields precede the figure that uses them', () => {
  const topic = read(6).match(/<article class="topic" id="d6-plan"[\s\S]*?<\/article>/)[0];
  const figure = topic.indexOf('<!-- EXAMPLE:d6-plan -->');
  assert.ok(figure > 0);
  for (const phrase of ['EXPLAIN展示数据库准备怎样执行SQL', 'type、key：', 'rows：', 'possible_keys：', 'Extra：']) {
    const at = topic.indexOf(phrase);
    assert.ok(at >= 0 && at < figure, `${phrase} must be explained before the figure`);
  }
  assert.match(topic.slice(0, figure), /不是测出的时间.*不是实际MySQL输出/s);
});

test('day-two general 3NF definition states the nontrivial dependency condition clearly', () => {
  assert.match(read(2), /X → A<\/code>，即A尚未包含在X中/);
  assert.doesNotMatch(read(2), /A不已包含/);
});

test('Hash defines calculation, bucket and collision before the mapping figure', () => {
  const topic = read(4).match(/<article class="topic" id="d4-alternatives"[\s\S]*?<\/article>/)[0];
  const visible = topic.split('<!-- EXAMPLE:d4-alternatives -->')[0].replace(/<[^>]+>/g, '');
  assert.match(visible, /Hash.*按规则从键.*散列计算.*桶.*一组存放位置/);
  assert.match(visible, /3、5.*同.*桶A.*碰撞.*核对原键/);
  assert.deepEqual(examples['d4-alternatives'].cards[1].table.rows, [[3, 'A'], [5, 'A'], [8, 'B']]);
});

test('first locking-read explanation gives the lock purpose without blocking ordinary reads', () => {
  const topic = read(8).match(/<article class="topic" id="d8-readtypes"[\s\S]*?<\/article>/)[0];
  const before = topic.split('<!-- EXAMPLE:d8-readtypes -->')[0].replace(/<[^>]+>/g, '');
  assert.match(before, /FOR UPDATE.*锁.*协调同一记录.*冲突操作/);
  assert.match(before, /其他事务修改.*等锁释放.*不阻止普通一致性读按快照读取/);
  assert.doesNotMatch(before, /阻止所有读取/);
});

test('day-eleven exit asks for UNION and view result explanations, not completed exercises', () => {
  const label = read(11).match(/<label><input type="checkbox" data-save="d11-exit-3">([^<]+)<\/label>/)[1];
  assert.match(label, /认识游标用途.*说明UNION和视图查询结果/);
  assert.doesNotMatch(label, /完成|全部/);
});

test('later warmups recall previously taught concepts rather than only the immediately preceding day', () => {
  for (let day = 3; day <= 12; day++) {
    const warmup = read(day).match(new RegExp(`<section class="lesson-section" id="d${day}-warmup"[\\s\\S]*?</section>`))[0];
    assert.match(warmup, /不查正文，回想前面学过的概念。/);
    assert.doesNotMatch(warmup, /回想上一课/);
    assert.match(warmup, new RegExp(`data-save="d${day}-warm-answer"`));
  }
  assert.match(read(2), /不查正文，回想第1天的三个概念。/);
});

test('MVCC feedback explains the selected view for both wrong answers', () => {
  const old = result('versions', {view: 'before'}, '8');
  const fresh = result('versions', {view: 'after'}, '10');
  assert.equal(old.correct, false);
  assert.equal(fresh.correct, false);
  assert.match(old.why, /仍活跃.*跳过8/);
  assert.match(fresh.why, /新视图建立前已经提交.*8可见/);
  assert.notEqual(old.why, fresh.why);
  assert.deepEqual(old.checks.map(row => row[0]), [8, 10]);
  assert.match(old.checks[0][2], /跳过/);
  assert.match(fresh.checks[0][2], /返回8/);
  assert.match(fresh.checks[1][2], /停止/);
});

test('cost paths have matching hand-authored EXPLAIN fields, not only counts', () => {
  const one = result('plan', {query: 'one'}, 'index');
  const all = result('plan', {query: 'all'}, 'scan');
  assert.deepEqual(one.plan, ['products', 'ref', 'idx_stock', 'idx_stock', 1, null]);
  assert.deepEqual(all.plan, ['products', 'ALL', 'idx_stock', null, 4, 'Using where']);
  assert.match(result('plan', {query: 'one'}, 'scan').why, /推荐索引.*你选的扫描/);
  assert.match(result('plan', {query: 'all'}, 'index').why, /推荐扫描.*你选的索引/);
  assert.deepEqual(result('plan', {query:'one'}, 'scan').plan, ['products','ALL','idx_stock',null,4,'Using where']);
  assert.deepEqual(result('plan', {query:'all'}, 'index').plan, ['products','range','idx_stock','idx_stock',4,null]);
  assert.match(examples['d6-plan'].limit, /手写教学模型.*不是实际/);
  const rendered = {focus() {}};
  const handlers = {};
  const element = {dataset: {}, querySelector: () => rendered, addEventListener: (type, handler) => { handlers[type] = handler; }};
  labs.mount(element, examples['d6-plan']);
  handlers.click({type: 'click', target: {closest: () => ({dataset: {labAction: 'choose', labValue: 'index'}})}});
  assert.match(rendered.innerHTML, /class="data-table lab-wide-table"/);
  assert.match(fs.readFileSync(`${__dirname}/../style.css`, 'utf8'), /\.lab-table \.lab-wide-table\{min-width:560px;white-space:nowrap\}/);
});

test('small-table diagnosis keeps insufficient evidence as a valid outcome', () => {
  assert.equal(result('diagnose', {scene: 'small'}, 'index').correct, false);
  assert.equal(result('diagnose', {scene: 'small'}, 'inspect').correct, true);
  assert.match(result('diagnose', {scene: 'small'}, 'inspect').why, /证据不足.*小表扫描可能更划算/);
  assert.match(result('diagnose', {scene: 'scan'}, 'index').evidence, /百万行.*高频.*耗时主要在读取/);
  assert.match(result('diagnose', {scene: 'scan'}, 'index').why, /测试.*比较/);
});

test('range protection starts with a query need and identifies its limited interval', () => {
  const record = result('range', {lock: 'record', operation: 'insert15'});
  const range = result('range', {lock: 'nextkey', operation: 'insert15'});
  assert.match(record.query, /WHERE id=20/);
  assert.match(range.query, /id>10 AND id<=20/);
  assert.match(range.purpose, /15也满足条件/);
  assert.equal(record.blocked, false);
  assert.equal(range.blocked, true);
  assert.match(read(10), /RR普通读沿用快照，别人仍可插入/);
});

test('static examples retain starting conditions and visible changes', () => {
  const fanout = examples['d4-fanout'];
  assert.match(fanout.intro, /固定L1至L4/);
  assert.match(fanout.cards[0].flow.at(-1), /共2页/);
  assert.match(fanout.cards[1].flow.at(-1), /共3页/);
  const primary = examples['d5-primary'];
  assert.equal(primary.cards[0].table.rows.length, 3);
  assert.match(primary.cards[1].flow.at(-1), /1片/);
  assert.match(primary.cards[2].flow.at(-1), /3片/);
  for (const card of examples['d12-scaling'].cards) {
    const rows = card.table.rows;
    assert.deepEqual(rows[0].slice(1), ['水', '水']);
    assert.deepEqual(rows[1].slice(1), ['饮用水', '水']);
    assert.deepEqual(rows[2].slice(1), ['饮用水', '饮用水']);
  }
  assert.match(examples['d11-self'].cards[0].flow[0], /manager_id=2.*id=2/);
  assert.match(examples['d11-views'].cards[0].table.rows[0][2], /^1$/);
  assert.match(examples['d11-views'].cards[0].table.rows[2][2], /1、2/);
});

test('inventory chain and complex mechanisms retain their concrete reasoning', () => {
  assert.match(read(7), /第9天比较原地条件扣减，第10天再看锁定或版本检查/);
  assert.match(read(9), /当前库存9，得到8/);
  assert.match(read(10), /旧读数算出的9不能静默覆盖/);
  assert.doesNotMatch(read(11), /逐行往返与循环开销|连接按每一对满足ON/);
  const topicText = (n, slug) => read(n).match(new RegExp(`<article class="topic" id="d${n}-${slug}"[\\s\\S]*?</article>`))[0].replace(/<[^>]+>/g, '');
  assert.match(topicText(9, 'mvcc'), /T2 BEGIN并改8未提交.*T1第一次普通SELECT.*T2随后COMMIT/s);
  assert.match(topicText(9, 'mvcc'), /沿undo重建10.*直接返回8并停止/s);
  assert.match(topicText(11, 'cursor'), /库存10记录“无需补货”.*库存2记录“缺3件”/s);
  assert.match(topicText(4, 'fanout'), /L1至L4.*四个子指针.*两个中间节点/s);
  assert.match(topicText(5, 'names'), /唯一.*约束.*联合.*多列.*二级.*覆盖/s);
  assert.ok(read(6).includes('<details>') && read(10).includes('<details>'));
});
