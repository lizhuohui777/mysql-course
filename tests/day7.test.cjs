const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lab = require('../learning-labs.js');
const examples = require('../interactive-examples.json');
const root = path.resolve(__dirname, '..');

test('parallel transfer starts with identical balances, differs only at confirmation boundary', () => {
  let s=lab.create('transfer');
  assert.deepEqual(lab.result(s).separate,[100,50]);
  s=lab.transition(s,'run');
  assert.deepEqual(lab.result(s).separate,lab.result(s).together);
  s=lab.transition(s,'run');
  assert.deepEqual(lab.result(s).together,[90,50],'Failure does not silently roll back');
  assert.match(lab.result(s).why,/还需要明确处理/);
  s=lab.transition(s,'run');
  assert.deepEqual(lab.result(s).separate,[90,50]);
  assert.deepEqual(lab.result(s).together,[100,50]);
  assert.equal(lab.transition(s,'run'),s,'Cannot repeat a charge after ending');
  assert.deepEqual(lab.transition(s,'reset'),lab.create('transfer'));
});

test('atomic wrong program still violates transfer total rule', () => {
  assert.equal(lab.result(lab.create('acid')).total,150);
  const wrong=lab.result(lab.create('acid',{credit:'20'}));
  assert.deepEqual(wrong.balances,[90,70]);
  assert.equal(wrong.total,160);
  assert.equal(wrong.valid,false);
  assert.match(wrong.why,/两步也整体提交/);
});

test('day seven retains failure, boundary, business rule and architecture, without prediction gates', () => {
  const html=fs.readFileSync(path.join(root,'lessons/lesson-07.html'),'utf8');
  assert.deepEqual([...html.matchAll(/id="(d7-(?:unit|boundary|acid|failures))"/g)].map(m=>m[1]),['d7-unit','d7-boundary','d7-acid','d7-failures']);
  assert.equal(examples['d7-unit'].model,'transfer');
  assert.equal(examples['d7-acid'].model,'acid');
  assert.equal(examples['d7-boundary'].kind,'static');
  assert.equal(examples['d7-failures'].kind,'static');
  assert.match(examples['d7-boundary'].cards[1].text,/后来ROLLBACK仍是A90/);
  assert.match(html,/最终A90、B60/);
  assert.match(html,/事务不是执行完SQL才额外经过的一站/);
  assert.match(html,/InnoDB在存取记录时管理本事务的修改与状态/);
  for(const n of [8,9,10])assert.ok(html.includes(`第${n}天`));
  assert.doesNotMatch(examples['d7-unit'].intro,/预测/);
});

test('day-seven exit checks understanding rather than completing every SQL exercise', () => {
  const html=fs.readFileSync(path.join(root,'lessons/lesson-07.html'),'utf8');
  const label=html.match(/<label><input type="checkbox" data-save="d7-exit-3">([^<]+)<\/label>/)[1];
  assert.match(label,/解释提交和回滚后的.*值/);
  assert.doesNotMatch(label,/完成.*题|4道|全部/);
});

test('all reasoning and conditions remain in feedback handoff and offline bundles', () => {
  const doc={addEventListener(){},getElementById(){return {textContent:JSON.stringify(examples)};}};
  const ctx=vm.createContext({window:{document:doc},document:doc});
  for(const file of ['learning-labs.js','diagrams.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
  const text=ctx.window.CourseDiagrams.textFor('d7-unit');
  assert.match(text,/右栏撤销未提交扣款/);
  assert.match(ctx.window.CourseDiagrams.textFor('d7-acid'),/总额变160/);
  for(const file of ['index.html','study.html','review.html']){
    const html=fs.readFileSync(path.join(root,file),'utf8');
    assert.match(html,/root.CourseLabs/);
    assert.match(html,/data-lab-action/);
    assert.doesNotMatch(html,/CourseReasoning|data-reason-action|\/\* LABS \*\//);
  }
});
