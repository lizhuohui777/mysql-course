const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const course = require('../curriculum.json');
const examples = require('../interactive-examples.json');
const fixture = require('../sql-exercises.json');
const core = require('../sql-core.js');
const model = require('../state.js');
const root = path.resolve(__dirname, '..');
const read = n => fs.readFileSync(path.join(root, `lessons/lesson-${String(n).padStart(2,'0')}.html`), 'utf8');

test('all twelve days are complete and preserve all 55 exact assignments', () => {
  assert.deepEqual(course.published_days, Array.from({length:12},(_,i)=>i+1));
  for (let n=3;n<=12;n++) {
    const html = read(n);
    assert.deepEqual([...html.matchAll(/data-phase="([^"]+)"/g)].map(m=>m[1]), model.PHASES);
    assert.equal([...html.matchAll(/data-quiz=/g)].length,5);
    assert.equal([...html.matchAll(/type="checkbox" data-save=/g)].length,3);
    assert.equal([...html.matchAll(/<!-- EXAMPLE:/g)].length,4);
    assert.ok(html.includes(`<!-- SQL_PRACTICE:${n} -->`));
    const ids = [...html.matchAll(/data-sources="([^"]*)"/g)].flatMap(m=>m[1].split(',').filter(Boolean));
    assert.deepEqual(ids.sort(), [...course.days[n-1].ids].sort());
    assert.equal(fixture.days[n].length,4);
    assert.ok(fixture.fixtures[n].tables.every(t=>t.rows.length<=4&&t.columns.length<=4));
    assert.doesNotMatch(html,/先定义：|今天的路线：|图示会一步步展示|课件制作|教学意图|按已确认范围延后|按已确认扩展边界延后/);
    for(const entry of fixture.days[n]) assert.ok(entry.prompt.length < 55,entry.id);
  }
});

test('later days use bounded mechanism labs and static comparisons, not a fixed replay', () => {
  for (const [id,e] of Object.entries(examples).filter(([id])=>/^d(?:[3-9]|1[0-2])-/.test(id))) {
    assert.ok(['lab','static'].includes(e.kind),id);
    assert.ok(e.limit && e.references.length,id);
    if(e.kind==='static')assert.ok(e.cards.length>=1&&e.cards.length<=3,id);
    else assert.ok(e.model,id);
  }
  for(let n=3;n<=12;n++)if(n!==7)assert.ok(Object.entries(examples).filter(([id,e])=>id.startsWith(`d${n}-`)&&e.kind==='lab').length<=2);
});

test('new explanations include prerequisites and avoid common MySQL misconceptions', () => {
  for (const [n,words] of [
    [3,['本次查询的操作安排','MySQL 8.0起已移除','缓冲池（Buffer Pool）','脏页']],
    [4,['根节点','多路、平衡的有序查找树','叶子','Hash','碰撞']],
    [5,['把行数据组织在索引叶子','额外查找结构','回表','覆盖索引','自增值可以跳号']],
    [6,['最左前缀','WHERE中两个等值条件','B+树也可包含NULL','也可能不同于实际']],
    [7,['一致性（Consistency）','数据库不知道所有业务规则','COMMIT','不总意味着整个事务自动回滚']],
    [8,['脏读','不可重复读','幻读','可见性时点确定的读取视角','不一定在BEGIN瞬间','自己的写入']],
    [9,['撤销日志','重做日志','Read View','活跃','binlog']],
    [10,['锁模式','锁粒度','自动升级成一把表锁','间隙锁','死锁','幂等性']],
    [11,['没有原生FULL OUTER JOIN','员工e','经理m','查询定义','通常不可更新','存储程序</strong>是','游标是']],
    [12,['5475万行','QPS','垂直拆分','水平拆分','复制延迟','回源']]
  ]) for (const word of words) assert.ok(read(n).includes(word),`${n}: ${word}`);
});

test('sorted results require requested order while other queries retain multiset matching', () => {
  const expected = {columns:['id','name'],values:[[1,'水'],[2,'面包']]};
  const reverse = {columns:['name','id'],values:[['面包',2],['水',1]]};
  assert.equal(core.matches(reverse,expected),true);
  assert.equal(core.matches(reverse,expected,true),false);
  assert.equal(core.matches({columns:['name','id'],values:[['水',1],['面包',2]]},expected,true),true);
});

test('new Workers reject wrong results, order, transaction steps and trusted-fixture overrides', async () => {
  const messages=[];
  const context=vm.createContext({console,setTimeout,clearTimeout,TextDecoder,TextEncoder,Uint8Array,WebAssembly,
    fetch:()=>{throw Error('Must work offline');},self:{postMessage:m=>messages.push(m)}});
  for(const file of ['vendor/sql-wasm.js','sql-core.js','sql-worker.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  await context.self.onmessage({data:{type:'init',seed:fixture.seed,exercises:Object.values(fixture.days).flat(),wasm:fs.readFileSync(path.join(root,'vendor/sql-wasm.wasm'))}});
  assert.equal(messages.pop().type,'ready');
  async function run(n,i,sql,extra={}) {
    const e=fixture.days[n][i];
    await context.self.onmessage({data:{type:'run',id:1,exerciseId:e.id,sql,...extra}});
    return JSON.parse(JSON.stringify(messages.pop()));
  }
  for(let n=3;n<=12;n++) for(let i=0;i<4;i++) {
    const e=fixture.days[n][i];
    assert.equal((await run(n,i,e.answer)).correct,true,e.id);
    assert.equal((await run(n,i,'SELECT FROM products')).type,'error',e.id);
    assert.equal((await run(n,i,e.answer)).correct,true,'Recovery: '+e.id);
  }
  assert.equal((await run(3,2,'SELECT id,name FROM products WHERE stock = NULL;')).correct,false);
  assert.equal((await run(4,0,'SELECT id,name FROM products ORDER BY price DESC;')).correct,false);
  assert.equal((await run(4,2,'SELECT name FROM products;')).correct,false,'DISTINCT retains duplicate semantics');
  assert.equal((await run(7,0,'ROLLBACK;')).type,'error');
  assert.equal((await run(7,1,'COMMIT;')).type,'error');
  assert.equal((await run(7,3,'UPDATE products SET stock=8 WHERE id=2;')).correct,false,'Wrong change cannot pass merely because rollback restores final seed');
  const rollback=await run(7,3,fixture.days[7][3].answer);
  assert.equal(rollback.beforeResult.values[0][3],8);
  assert.equal(rollback.result.values[0][3],10);
  assert.equal((await run(9,0,'SELECT DISTINCT p.name FROM orders o INNER JOIN products p ON o.product_id=p.id;')).correct,false);
  assert.equal((await run(10,0,'SELECT p.id,o.id FROM products p INNER JOIN orders o ON p.id=o.product_id;')).correct,false);
  assert.equal((await run(11,0,fixture.days[11][1].answer)).correct,false,'UNION must not pass UNION ALL');
  assert.equal((await run(12,1,'SELECT p.id,p.name FROM products p JOIN orders o ON o.product_id=p.id;')).correct,false);
  assert.equal((await run(3,2,fixture.days[3][2].answer,{seed:fixture.seed,expected:{columns:[],values:[]},operation:'DROP'})).correct,true,'Only initialized fixtures are trusted');
});

test('all-day notes, drafts and timing migrate without changing accepted record keys', () => {
  const fields=Array.from({length:12},(_,i)=>[`d${i+1}-sql-e1`,`d${i+1}-q1-answer`]).flat();
  const catalog={courseId:course.id,fieldKeys:new Set(fields),fieldTypes:new Map(fields.map(k=>[k,'string'])),ratingKeys:new Set(),topicIds:new Set()};
  const record=model.create(course.id,'study');
  for(let n=1;n<=12;n++) {assert.equal(model.complete(n,record),true);record.fields[`d${n}-sql-e1`]=fixture.days[n][0].answer;record.timing[n].sql=n*1000;}
  record.day=12;
  const restored=model.normalize(JSON.parse(JSON.stringify(record)),catalog,'study');
  assert.deepEqual(restored,record);
  assert.equal(model.canOpen(1,restored),true);
  assert.equal(model.canOpen(12,restored),true);
});

test('SQL handoff contains current tiny tables and preset transaction boundaries', () => {
  const ctx=vm.createContext({document:{getElementById:()=>({textContent:JSON.stringify(fixture)})},window:{}});
  vm.runInContext(fs.readFileSync(path.join(root,'sql-ui.js'),'utf8'),ctx);
  const text=ctx.window.CourseSQL.textFor('d7-sql');
  assert.ok(text.includes('预设前置：BEGIN;'));
  assert.ok(text.includes('预设后置：ROLLBACK;'));
  assert.ok(ctx.window.CourseSQL.textFor('d9-sql').includes('练习表：orders'));
});
