const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const labs=require('../learning-labs.js');
const examples=require('../interactive-examples.json');
const r=(model,options,choice)=>labs.result({...labs.create(model,options),choice:choice??null});
function renderExample(id) {
  const output={focus(){}},handlers={};
  const element={dataset:{},querySelector:()=>output,addEventListener:(type,handler)=>{handlers[type]=handler;}};
  labs.mount(element,examples[id]);
  return {output,handlers};
}

test('initial diagrams place server roles, pages and the same product rows in space',()=>{
  const server=renderExample('d3-layers').output.innerHTML;
  assert.match(server,/graph-group.*MySQL服务器/s);
  assert.match(server,/取编号2/);assert.match(server,/返回记录/);
  const cache=renderExample('d3-pages').output.innerHTML;
  for(const label of ['磁盘：页P','内存：InnoDB缓冲池','查询前：没有P','执行时：读入整页P','id=2，name=面包'])assert.ok(cache.includes(label),label);
  const fanout=examples['d4-fanout'].cards;
  assert.equal(fanout[0].diagram.edges.filter(e=>e.from==='R').length,4);
  assert.equal(fanout[1].diagram.edges.filter(e=>e.from==='R').length,2);
  assert.deepEqual(fanout.map(card=>card.diagram.nodes.filter(n=>n.id.startsWith('L')).map(n=>n.id)),[['L1','L2','L3','L4'],['L1','L2','L3','L4']]);
});

test('prefix displays actual candidates and exclusions before any answer',()=>{
  assert.deepEqual(r('prefix').candidateEntries,[['水',3,1],['水',4,4]]);
  assert.deepEqual(r('prefix',{query:'both'}).candidateEntries,[['水',4,4]]);
  assert.equal(r('prefix',{query:'price'}).inspected.filter(row=>row[3]==='进入候选').length,4);
  const html=renderExample('d6-prefix').output.innerHTML;
  for(const label of ['定位阶段','定位时跳过','最终结果','水'])assert.ok(html.includes(label),label);
});

test('plan initially shows inputs and follows the selected path even when not recommended',()=>{
  const {output,handlers}=renderExample('d6-plan');
  assert.match(output.innerHTML,/stock输入与条件判断/);
  assert.match(output.innerHTML,/当前展示路径的手写EXPLAIN/);
  handlers.click({type:'click',target:{closest:()=>({dataset:{labAction:'choose',labValue:'scan'}})}});
  for(const label of ['展示你选的','扫描主键叶子中的行','不访问stock二级树','ALL'])assert.ok(output.innerHTML.includes(label),label);
  assert.equal(r('plan',{query:'one'},'scan').plan[3],null);
  assert.deepEqual(r('plan',{query:'one'},'scan').selectedRows,[[2,'面包',0]]);
});

test('read and version views share writer-first chronology and show both checks without choices',()=>{
  const read=r('read');
  assert.equal(read.timeline[0][0],'T2');assert.match(read.timeline[0][1],/改|stock=8/);
  assert.equal(read.timeline[1][0],'T1');assert.match(read.timeline[1][1],/首次|第一次/);
  const version=r('versions');
  assert.match(version.timeline[0][1],/改8未提交/);
  assert.match(version.timeline[1][2],/首次SELECT建V旧/);
  assert.match(version.timeline[2][1],/COMMIT/);
  assert.deepEqual(version.oldChecks.map(row=>row[0]),[8,10]);
  assert.match(version.oldChecks[0][2],/跳过/);
  assert.match(version.freshChecks[0][2],/返回8/);
  const html=renderExample('d9-mvcc').output.innerHTML;
  for(const label of ['首次SELECT建V旧','V旧：首次读时T2活跃','V新：T2已提交','跳过，沿undo重建10','返回8，停止','当前记录'])assert.ok(html.includes(label),label);
});

test('lock examples connect SQL requests to holdings, waits and transaction release',()=>{
  const html=renderExample('d10-locks').output.innerHTML;
  for(const label of ['FOR SHARE','UPDATE请求X','A释放S','取得X','B释放X','普通MVCC SELECT不自动对应S'])assert.ok(html.includes(label),label);
  const ranges=renderExample('d10-ranges').output.innerHTML;
  assert.match(ranges,/A尚未结束/);assert.match(ranges,/B尝试/);
  let s=labs.create('deadlock');s=labs.transition(labs.transition(s,'run'),'run');
  assert.deepEqual(labs.result(s).requests,[['A',2],['B',1]]);
  const source=fs.readFileSync(`${__dirname}/../lessons/lesson-10.html`,'utf8');
  assert.match(source,/应用为商品表额外增加/);assert.match(source,/不是MVCC的内置事务标识/);
});

test('day seven and nine checks do not require future or folded log modules',()=>{
  const d7=fs.readFileSync(`${__dirname}/../lessons/lesson-07.html`,'utf8');
  const q4=d7.match(/data-quiz="d7-q4"[\s\S]*?<\/article>/)[0];
  assert.match(q4,/各自写9并提交/);assert.doesNotMatch(q4,/stock=stock-1|影响行数/);
  const d9=fs.readFileSync(`${__dirname}/../lessons/lesson-09.html`,'utf8');
  assert.doesNotMatch(d9.match(/data-quiz="d9-q5"[\s\S]*?<\/article>/)[0],/binlog/);
  assert.doesNotMatch(d9.match(/class="checklist"[\s\S]*?<\/div>/)[0],/binlog/);
});

test('JOIN initial view displays every matched pair and explicit unmatched action',()=>{
  const inner=r('join');
  assert.deepEqual(inner.pairings.slice(0,3).map(pair=>pair.slice(0,2)),[[1,101],[1,102],[2,103]]);
  assert.match(inner.pairings[3][3],/INNER不输出/);
  assert.match(r('join',{type:'left'}).pairings[3][3],/LEFT补NULL/);
  const {output,handlers}=renderExample('d11-joins');
  for(const label of ['商品id=1','订单id=101','订单id=102','逐对判断','INNER不输出'])assert.ok(output.innerHTML.includes(label),label);
  handlers.change({type:'change',target:{closest:()=>({dataset:{labOption:'type'},value:'left'})}});
  assert.match(output.innerHTML,/LEFT补NULL结果/);assert.match(output.innerHTML,/不是原订单表的一行/);
});

test('shards derive local sums from rows and distinguish one user from the whole shard',()=>{
  assert.deepEqual(r('shard').localResults,[['A','user_id=3',20]]);
  assert.deepEqual(r('shard',{query:'total'}).localResults,[['A','SUM(amount)',30],['B','SUM(amount)',20]]);
  const {output,handlers}=renderExample('d12-horizontal');
  assert.match(output.innerHTML,/本次仅取user3：20/);assert.match(output.innerHTML,/本轮未访问/);
  assert.match(output.innerHTML,/返回金额20/);assert.doesNotMatch(output.innerHTML,/取用户20/);
  handlers.change({type:'change',target:{closest:()=>({dataset:{labOption:'query'},value:'total'})}});
  for(const label of ['10+20=30','8+12=20','30+20=50','本次各片实际返回'])assert.ok(output.innerHTML.includes(label),label);
});

test('range messages follow the same selected task for both inserted positions',()=>{
  const {output,handlers}=renderExample('d10-ranges');
  assert.match(output.innerHTML,/新行不满足A的id=20条件/);
  assert.doesNotMatch(output.innerHTML,/15将成为范围内的新成员/);
  assert.match(r('range',{lock:'record',operation:'insert25'}).why,/只保护已有id=20.*插入25不修改20/);
  assert.doesNotMatch(r('range',{lock:'record',operation:'insert25'}).why,/10,20/);
  handlers.change({type:'change',target:{closest:()=>({dataset:{labOption:'lock'},value:'nextkey'})}});
  assert.match(output.innerHTML,/若插入成功，15会满足A的\(10,20\]范围条件/);
  assert.match(r('range',{lock:'nextkey',operation:'insert25'}).why,/25不在.*\(10,20\]/);
});

test('later examples and assessments keep concrete tasks instead of folded-module recall',()=>{
  const cursor=examples['d11-cursor'].cards[1].table.rows;
  assert.match(cursor[1][3],/无需补货/);assert.match(cursor[2][3],/缺3件/);
  const vertical=examples['d12-vertical'];
  assert.match(vertical.intro,/每页容量8格.*整行4格、核心行2格/);
  assert.equal(vertical.cards[0].diagram.nodes.length,2);
  assert.match(vertical.cards[1].diagram.nodes[0].lines.at(-1),/一页/);
  const d11=fs.readFileSync(`${__dirname}/../lessons/lesson-11.html`,'utf8');
  assert.doesNotMatch(d11.match(/data-quiz="d11-q3"[\s\S]*?<\/article>/)[0],/FULL OUTER/);
  const d12=fs.readFileSync(`${__dirname}/../lessons/lesson-12.html`,'utf8');
  assert.doesNotMatch(d12.match(/data-quiz="d12-q1"[\s\S]*?<\/article>/)[0],/5475|QPS|三年/);
  assert.match(d12,/商品1有订单101、102.*保留商品1一次/s);
  const d10=fs.readFileSync(`${__dirname}/../lessons/lesson-10.html`,'utf8');
  assert.match(d10,/按商品id、name、order_id得到五行：\(1,水,101\)、\(1,水,102\)、\(2,面包,103\)、\(3,牛奶,NULL\)、\(4,水,NULL\)/);
});

test('first two lessons retain learning-record IDs and five-phase structure during content repairs',()=>{
  const contracts={
    1:{topics:['tables','models','keys','types','sql'],saves:['warm-database','warm-key','warm-sql','warm-answer','exit-table','exit-key','exit-type','exit-note']},
    2:{topics:['constraints','1nf','2nf','3nf','delete','sql'],saves:['warm-key','warm-candidate','warm-where','warm-answer','exit-constraints','exit-normal','exit-delete','exit-note']}
  };
  for(const n of [1,2]){
    const html=fs.readFileSync(`${__dirname}/../lessons/lesson-0${n}.html`,'utf8');
    const values=attribute=>[...html.matchAll(new RegExp(`${attribute}="([^"]+)"`,'g'))].map(match=>match[1]);
    const topics=contracts[n].topics.map(slug=>`d${n}-${slug}`);
    assert.deepEqual(values('data-topic-rating'),topics);
    assert.deepEqual(values('data-note'),topics);
    assert.deepEqual(values('data-quiz'),[1,2,3,4,5].map(q=>`d${n}-q${q}`));
    assert.deepEqual(values('data-save'),contracts[n].saves.map(slug=>`d${n}-${slug}`));
    assert.deepEqual(values('data-phase'),['recall','main','sql','quiz','close']);
    assert.equal((html.match(/id="mark-complete"/g)||[]).length,1);
  }
});

test('cache changes only disk page work, keeps service/engine and returned record',()=>{
  assert.equal(r('cache').diskReads,1);
  assert.equal(r('cache',{cached:'yes'}).diskReads,0);
  for(const options of [{},{cached:'yes'}]){
    const out=r('cache',options);assert.equal(out.name,'面包');assert.ok(out.route.some(v=>v.includes('服务层')));assert.ok(out.route.some(v=>v.includes('InnoDB')));
  }
});
test('tree branches derive equality and range paths, not pre-labeled answers',()=>{
  assert.equal(r('path',{target:'8'},'left').correct,false);
  assert.equal(r('path',{target:'8'},'right').correct,true);
  assert.equal(r('path',{target:'3'},'left').correct,true);
  let s=labs.transition(labs.create('path',{target:'range'}),'choose','left');
  assert.deepEqual(labs.result(s).keys,[3]);
  s=labs.transition(s,'run');assert.deepEqual(labs.result(s).keys,[3,5,8]);
  assert.match(labs.result(s).why,/沿叶子连接/);
  assert.equal(labs.transition(s,'run'),s);
});
test('covering is decided by requested columns in fixed secondary index',()=>{
  assert.equal(r('cover').fetches,0);
  assert.equal(r('cover',{columns:'id,name,stock'}).fetches,2);
  assert.deepEqual(r('cover',{columns:'id,name,stock'}).rows,[[1,'水',10],[4,'水',6]]);
});
test('prefix varies exactly index order and predicates; plan counts candidate and row fetch work',()=>{
  assert.equal(r('prefix').candidates,2);
  assert.equal(r('prefix',{query:'price'}).candidates,4);
  assert.equal(r('prefix',{query:'both'}).candidates,1);
  assert.equal(r('prefix',{index:'price,name',query:'price'}).candidates,1);
  assert.match(r('prefix',{index:'price,name',query:'price'}).why,/只使用首列price=4.*没有使用name条件/);
  assert.equal(r('plan',{query:'one'},'index').correct,true);
  assert.equal(r('plan',{query:'all'},'scan').correct,true);
  assert.equal(r('plan',{query:'all'},'index').indexWork,8);
  assert.equal(r('plan',{query:'all'},'scan').scanWork,4);
});
test('fixed timeline separates RC/RR snapshot reads from locked current reads',()=>{
  assert.equal(r('read',{mode:'rr'}).second,10);
  assert.equal(r('read',{mode:'rc'}).second,8);
  assert.equal(r('read',{mode:'locked'}).second,8);
  assert.deepEqual(r('read',{mode:'rc'}).timeline.slice(0,2),r('read',{mode:'rr'}).timeline.slice(0,2));
});
test('view timing chooses versions even though writer is committed now',()=>{
  assert.equal(r('versions',{view:'before'},'8').correct,false);
  assert.equal(r('versions',{view:'before'},'10').correct,true);
  assert.equal(r('versions',{view:'after'},'8').correct,true);
});
test('same crash clears memory, durable recovery information determines recoverability',()=>{
  for(const log of ['durable','volatile']){
    let s=labs.create('recovery',{log});assert.equal(labs.result(s).memory,8);assert.equal(labs.result(s).disk,10);
    s=labs.transition(s,'run');assert.equal(labs.result(s).memory,null);assert.equal(labs.result(s).disk,10);
    s=labs.transition(s,'run');assert.equal(labs.result(s).disk,log==='durable'?8:10);
    assert.equal(labs.result(s).recoverable,log==='durable');
  }
});
test('explicit interval protects only described record and gap',()=>{
  assert.equal(r('range',{lock:'record',operation:'insert15'}).blocked,false);
  assert.equal(r('range',{lock:'nextkey',operation:'insert15'}).blocked,true);
  for(const lock of ['record','nextkey']){
    assert.equal(r('range',{lock,operation:'modify20'}).blocked,true);
    assert.equal(r('range',{lock,operation:'insert25'}).blocked,false);
  }
});
test('deadlock follows owners and requests; same order yields a one-way wait',()=>{
  let s=labs.create('deadlock');s=labs.transition(s,'run');assert.equal(labs.result(s).cycle,false);
  s=labs.transition(s,'run');assert.deepEqual(labs.result(s).edges,[['A','B'],['B','A']]);assert.equal(labs.result(s).cycle,true);
  s=labs.transition(s,'run');assert.equal(labs.result(s).cycle,false);assert.deepEqual(labs.result(s).owners,[['A',1],['A',2]]);
  s=labs.create('deadlock',{order:'same'});s=labs.transition(labs.transition(s,'run'),'run');assert.deepEqual(labs.result(s).edges,[['B','A']]);assert.equal(labs.result(s).cycle,false);
  s=labs.transition(s,'run');assert.deepEqual(labs.result(s).owners,[['B',1],['B',2]]);assert.deepEqual(labs.result(s).edges,[]);
});
test('JOIN derives multiplicity and unmatched NULL, shards derive fanout and sums',()=>{
  assert.deepEqual(r('join').rows,[[1,'水',101],[1,'水',102],[2,'面包',103]]);
  assert.deepEqual(r('join',{type:'left'}).rows.at(-1),[3,'奶',null]);
  assert.equal(r('join',{type:'left'}).rows.length,4);
  assert.deepEqual(r('shard').shards,['A']);assert.equal(r('shard').value,20);
  assert.deepEqual(r('shard',{query:'total'}).shards,['A','B']);assert.equal(r('shard',{query:'total'}).value,50);
});
test('diagnosis rejects unrelated remedies, including adding index for lock waiting',()=>{
  assert.equal(r('diagnose',{scene:'wait'},'index').correct,false);
  assert.equal(r('diagnose',{scene:'wait'},'shorten').correct,true);
  assert.equal(r('diagnose',{scene:'scan'},'index').correct,true);
  assert.equal(r('diagnose',{scene:'stale'},'primary').correct,true);
});
test('reset and changing a condition discard transient actions without persistent records',()=>{
  let s=labs.transition(labs.create('deadlock'),'run');
  assert.equal(labs.transition(s,'choose','nonsense'),s);
  assert.equal(labs.transition(s,'option',{key:'order',value:'nonsense'}),s);
  s=labs.transition(s,'option',{key:'order',value:'same'});assert.equal(s.phase,0);assert.equal(s.choice,null);
  assert.deepEqual(labs.transition(s,'reset'),labs.create('deadlock',{order:'same'}));
  const model=fs.readFileSync(require.resolve('../learning-labs.js'),'utf8');assert.doesNotMatch(model,/localStorage|CourseState|data-save/);
});
test('source order encodes causal dependencies and preserves no more than two labs per day',()=>{
  const html=n=>fs.readFileSync(`${__dirname}/../lessons/lesson-${String(n).padStart(2,'0')}.html`,'utf8');
  for(const [n,a,b] of [[3,'pages','engines'],[4,'fanout','alternatives'],[9,'mvcc','redo'],[10,'deadlock','optimistic']])assert.ok(html(n).indexOf(`id="d${n}-${a}"`)<html(n).indexOf(`id="d${n}-${b}"`));
  for(let n=3;n<=12;n++){
    const es=Object.entries(examples).filter(([id])=>id.startsWith(`d${n}-`));assert.equal(es.filter(([,e])=>e.kind==='lab').length>=1,true);assert.ok(es.filter(([,e])=>e.kind==='lab').length<=2);
  }
  for(const [id,e] of Object.entries(examples).filter(([,e])=>e.kind==='lab'||e.kind==='static')){const text=labs.textFor(e);assert.ok(text.includes(e.limit),id);assert.ok(text.includes(e.references[0]),id);assert.ok(text.length>100,id);}
});
test('SQL contrast fixtures include a real LIKE suffix and a NULL COUNT difference',()=>{
  const sql=require('../sql-exercises.json');
  assert.ok(sql.fixtures[5].tables[0].rows.some(r=>r[1]==='水果'));
  assert.deepEqual(sql.days[6][0].expected.values,[[4,3]]);
});
