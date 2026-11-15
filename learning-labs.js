/* Small conceptual models, independent of the SQLite SQL executor. */
(function (root) {
  'use strict';
  const defaults = {
    cache: {cached: 'no'}, path: {target: '3'}, cover: {columns: 'id,name'},
    prefix: {index: 'name,price', query: 'name'}, plan: {query: 'one'},
    read: {mode: 'rr'}, versions: {view: 'before'}, recovery: {log: 'durable'},
    range: {lock: 'record', operation: 'insert15'}, deadlock: {order: 'opposite'},
    join: {type: 'inner'}, diagnose: {scene: 'scan'}, shard: {query: 'user'},
    transfer: {}, acid: {credit: '10'}
  };
  const products = [[1,'水',10],[2,'面包',0],[3,'奶',8],[4,'水',6]];
  const indexEntries = [['奶',8,3],['水',3,1],['水',4,4],['面包',5,2]];
  const optionValues = {cache:{cached:['no','yes']},path:{target:['3','8','range']},cover:{columns:['id,name','id,name,stock']},prefix:{index:['name,price','price,name'],query:['name','price','both']},plan:{query:['one','all']},read:{mode:['rr','rc','locked']},versions:{view:['before','after']},recovery:{log:['durable','volatile']},range:{lock:['record','nextkey'],operation:['insert15','insert25','modify20']},deadlock:{order:['opposite','same']},join:{type:['inner','left']},diagnose:{scene:['scan','wait','stale','small']},shard:{query:['user','total']},acid:{credit:['10','20']}};
  const choices = {path:['left','right'],plan:['index','scan'],versions:['8','10'],diagnose:['index','shorten','primary','inspect']};
  function create(model, options = {}) {
    if (!defaults[model]) throw Error('Unknown learning model');
    const clean={...defaults[model]};
    for(const [key,value] of Object.entries(options))if(optionValues[model]?.[key]?.includes(value))clean[key]=value;
    return {model, options: clean, phase: 0, choice: null};
  }
  function transition(state, action, value) {
    if (action === 'reset') return create(state.model, state.options);
    if (action === 'option') {
      if (!value || !optionValues[state.model]?.[value.key]?.includes(value.value)) return state;
      return create(state.model, {...state.options, [value.key]: value.value});
    }
    const s = {...state};
    if (choices[s.model]?.includes(value) && action === 'choose') {s.choice = value;s.phase=0;}
    else if(action==='run'&&s.model==='path'&&s.options.target==='range'&&s.choice==='left'&&s.phase===0)s.phase=1;
    else if (action === 'run' && ['transfer','deadlock','recovery'].includes(s.model)) {
      const max = {transfer: 3, deadlock: 3, recovery: 2}[s.model];
      if(s.phase===max)return state;
      s.phase = Math.min(max, s.phase + 1);
    } else return state;
    return s;
  }
  function result(s) {
    const o = s.options;
    switch (s.model) {
      case 'cache': return {diskReads: o.cached === 'yes' ? 0 : 1, name: '面包',
        route: ['客户端：SELECT name WHERE id=2','服务层：分析 → 计划 → 执行','InnoDB：定位含商品2的页P',o.cached === 'yes' ? '缓冲池：命中P，不读磁盘' : '缓冲池：未命中 → 从磁盘读P','页P中取name → 返回面包'],
        why: '改变的是取页是否需要磁盘读取。页中还有商品1，但这次返回商品2；缓存页不等于缓存整条SQL的结果。'};
      case 'path': {
        const expected = o.target === '8' ? 'right' : 'left', correct = s.choice === expected;
        return {expected, correct, leaves: [[1,3],[5,8]], keys: o.target === 'range' ? (s.phase===1?[3,5,8]:[3]) : [Number(o.target)],
          why: s.choice === null ? '根用5划分范围。你需要选择目标或范围起点所在的叶子。' : !correct ? '这片叶子不包含目标或范围起点。根据分隔键5重新选择，不必扫描另一片叶子猜答案。' : o.target === 'range' ? (s.phase===0?'起点3在左叶，但查询要到8，范围还没取完。沿有序叶子连接继续，不必重新从根找每一个键。':'沿叶子连接到右叶取5、8，范围结果为3、5、8。导航起点与继续范围是两种动作。') : `目标${o.target}在${expected === 'left' ? '左' : '右'}叶。根到叶的路径跳过了另一片叶子。`};
      }
      case 'cover': {
        const back = o.columns.includes('stock');
        return {back, fetches: back ? 2 : 0, columns: o.columns.split(','),
          rows: products.filter(p=>p[1]==='水').map(p=> back ? p : p.slice(0,2)),
          why: back ? 'name索引项只有name和主键id，没有stock。两项都要用id再访问主键树，才能补齐stock。' : '所需name和id都在name二级索引项里，可以直接产生结果；本例不需为其他列回表。'};
      }
      case 'prefix': {
        const leading = o.index.startsWith('price'), both = o.query === 'both', byName = o.query === 'name';
        const ordered = [...indexEntries].sort((a,b)=> leading ? a[1]-b[1] : ['奶','水','面包'].indexOf(a[0])-['奶','水','面包'].indexOf(b[0]) || a[1]-b[1]);
        const matches = row => byName ? row[0]==='水' : both ? row[0]==='水' && row[1]===4 : row[1]===4;
        const candidates = ordered.filter(row => leading ? byName || row[1]===4 : o.query==='price' || row[0]==='水' && (!both || row[1]===4));
        const matched = candidates.filter(matches);
        return {entries: ordered, candidates: candidates.length, candidateEntries: candidates, matched,
          inspected: ordered.map(row=>[...row,candidates.includes(row) ? '进入候选' : '定位时跳过',matches(row) ? '符合' : '不符合']),
          why: (!leading && o.query==='price') || (leading && byName) ? '缺少首列约束，本例不能沿普通最左前缀直接定位该组，要检查四项再过滤。表中把候选与最终符合分开标出；不模拟其他访问计划。' : byName ? '首列name定位水组，跳过奶与面包，只检查(水,3,1)、(水,4,4)两项。再加price=4，可在水组内继续缩到一项。' : leading && o.query==='price' ? '只使用首列price=4定位价格组，本数据中该组恰好只有(水,4,4)一项；没有使用name条件，不表示使用了第二列等值定位。' : '首列和后续连续等值条件给出定位依据，本例缩到(水,4,4)一个索引项。'};
      }
      case 'plan': {
        const candidates = o.query === 'one' ? 1 : 4, indexWork = candidates*2, scanWork = 4;
        const recommended = indexWork < scanWork ? 'index' : 'scan';
        const selected = s.choice || recommended;
        const plan = selected === 'index' ? ['products',o.query==='one'?'ref':'range','idx_stock','idx_stock',candidates,null] : ['products','ALL','idx_stock',null,4,'Using where'];
        const selectedRows = products.filter(row=>o.query==='all' || row[2]===0);
        return {candidates, indexWork, scanWork, recommended, selected, plan, selectedRows,
          inspected:products.map(row=>[...row,o.query==='all'||row[2]===0?'符合条件':'不符合']), correct: s.choice === recommended,
          why: `本例推荐${recommended==='index'?'索引':'扫描'}：索引项${candidates}次+回表${candidates}次=${indexWork}，扫描4行=4。${s.choice===null?'下方先展示推荐，选择按钮可换成你指定的路径。':`下方展示你选的${selected==='index'?'索引':'扫描'}，${selected===recommended?'符合':'不同于'}本例推荐，不会偷换为另一条路径。`}真实优化器还估计页、缓存和统计，不机械数四行。`};
      }
      case 'read': {
        const second = o.mode === 'rr' ? 10 : 8;
        return {second, timeline: [['T2','BEGIN → UPDATE stock=8，未提交'],['T1','BEGIN → 第一次普通SELECT：10，建立旧视角'],['T2','COMMIT确认8'],['T1',o.mode === 'locked' ? '第二次SELECT … FOR UPDATE：当前8' : `第二次普通SELECT：${second}`]],
          why: o.mode === 'rr' ? 'RR中的普通一致性读沿用第一次读建立的快照，因此仍见10。这里T1没有自己的写入。' : o.mode === 'rc' ? 'RC的第二次普通一致性读建立新快照，此时T2已提交，所以见8。' : '锁定读不是沿用旧快照的普通读；本例T2已经提交、没有冲突锁，读到当前8，并取得所需锁。'};
      }
      case 'versions': {
        const visible = o.view === 'before' ? 10 : 8;
        const checks = visible === 10 ? [[8,'T2在视图建立时仍活跃','跳过，沿undo找旧版'],[10,'先前已提交','可见，返回10']] : [[8,'T2在视图建立前已提交','可见，返回8'],[10,'不必继续检查','已在8处停止']];
        const reason = visible === 10 ? '视图建立时T2仍活跃，因此跳过8，沿undo取先前已提交的10；T2后来提交不改变旧视图。' : 'T2在这个新视图建立前已经提交，因此8可见，在这里停止；不需要退回旧10。';
        const oldChecks=[[8,'T2在V旧建立时仍活跃','跳过，沿undo重建10'],[10,'更早已提交，本例可见','返回10，停止']];
        const freshChecks=[[8,'T2在V新建立前已提交','返回8，停止'],[10,'最新8已经可见','不必继续检查']];
        return {visible, checks, oldChecks, freshChecks, correct: Number(s.choice) === visible,
          timeline:[['1','BEGIN；UPDATE改8未提交','尚未首次读','当前8，旧10可重建'],['2','仍未提交','BEGIN；首次SELECT建V旧 → 10','T2当时活跃'],['3','COMMIT确认8','仍在同一事务','现在8已提交'],['4','已结束','RR复用V旧；RC第二次建V新','同一链，不同视图']],
          why: (s.choice===null?'两栏逐版检查一直可见。当前标记的视图：':Number(s.choice)===visible?'自检符合该视图。':'自检需重看该视图的依据。')+reason};
      }
      case 'recovery': return {memory: s.phase === 0 ? 8 : null, disk: s.phase === 2 && o.log==='durable' ? 8 : 10,
        recoverable: o.log === 'durable',
        why: s.phase === 0 ? '两种条件都保持内存页8、磁盘页10。只改变：是否已有持久恢复信息。' : s.phase===1 ? '进程崩溃后内存丢失。查看磁盘页和留下的日志，再判断有没有依据恢复8。' : o.log==='durable' ? '持久redo提供足够恢复信息，可把本例已确认修改恢复为8，不要求确认前每个数据页都已写回。' : '只剩磁盘页10，没有持久恢复依据，不能承诺找回8。这是错误确认策略的反例，不是正常安全配置下的MySQL提交。'};
      case 'range': {
        const blocked = o.operation === 'modify20' || (o.lock==='nextkey' && o.operation==='insert15');
        return {blocked, query:o.lock==='record' ? 'SELECT id FROM products WHERE id=20 FOR UPDATE;' : 'SELECT id FROM products WHERE id>10 AND id<=20 FOR UPDATE;',
          purpose:o.lock==='record' ? '唯一id等值查已有20：保护这一行。插入15不满足id=20。' : '锁定范围当前匹配20，但15也满足条件；仅锁已有20会漏掉新成员。本例观察(10,20]的next-key保护。',
          why: o.operation==='modify20' ? '20是已有记录，两种任务都保护它，因此修改20需等待。' : o.operation==='insert25' ? o.lock==='record' ? 'A只保护已有id=20。插入25不修改20，也不满足id=20，这把记录锁本身不阻止它；其他锁与约束仍可能影响真实执行。' : '25不在本例观察的(10,20]中。这段锁本身不阻止它；SQL可能还有其他锁或约束，不能据此断定真实执行不等。' : o.lock==='record' ? '15既不是已有20，也不满足id=20。仅保护20的记录锁不阻止这次插入。' : '15满足范围条件并落在前间隙，next-key阻止它插入，避免锁定范围新增匹配成员。'};
      }
      case 'deadlock': {
        const opposite = o.order==='opposite';
        const owners = s.phase===0 ? [] : s.phase===3 ? [[opposite?'A':'B',1],[opposite?'A':'B',2]] : opposite ? [['A',1],['B',2]] : [['A',1],...(s.phase>=2 ? [['A',2]] : [])];
        const edges = s.phase===0 || s.phase===3 ? [] : opposite ? (s.phase===2 ? [['A','B'],['B','A']] : []) : [['B','A']];
        const requests=s.phase===0||s.phase===3?[]:opposite?(s.phase===2?[['A',2],['B',1]]:[]):[['B',1]];
        return {owners, edges, requests, cycle: edges.length===2,
          why: s.phase===0 ? 'A、B都需要记录1和2。访问顺序决定谁先持有哪些锁。' : s.phase===1 ? opposite ? 'A持有1，B持有2。目前只是各持一把锁，尚未形成等待环。' : 'A持有1；B先请求1时就等待，不能先去占2。只有B → A。' : s.phase===2 ? opposite ? 'A要2，需等B；B要1，需等A。两条等待边闭合成环，双方都无法正常走到结束释放锁。' : 'A取得2后可以完成事务，B只单向等待；这个访问模式没有等待环。' : opposite ? '为演示选择回滚B：释放它的2，A取得2继续。真实InnoDB不固定选择B，应用须处理被回滚事务。' : 'A提交并释放锁后，B才能依次取得1、2。统一顺序消除了本例的环。'};
      }
      case 'join': {
        const p = [[1,'水'],[2,'面包'],[3,'奶']], orders = [[101,1],[102,1],[103,2]], rows=[];
        for (const product of p) {
          const matches=orders.filter(order=>order[1]===product[0]);
          if(matches.length) for(const order of matches) rows.push([...product,order[0]]);
          else if(o.type==='left') rows.push([...product,null]);
        }
        const pairings=[[1,101,'1 = product_id 1','输出匹配对'],[1,102,'1 = product_id 1','输出匹配对'],[2,103,'2 = product_id 2','输出匹配对'],[3,null,'没有product_id=3的订单',o.type==='left'?'LEFT补NULL输出':'INNER不输出']];
        return {products:p, orders, rows, pairings, why: o.type==='inner' ? '商品1匹配两个订单，所以产生两行；商品3无匹配，不保留。JOIN不是每个商品只取一个订单。' : '先保留所有匹配，商品1仍产生两行；商品3没有订单，补一行右侧NULL。因此3件商品产生4行。'};
      }
      case 'diagnose': {
        const remedies={scan:'index', wait:'shorten', stale:'primary', small:'inspect'}, good=s.choice===remedies[o.scene];
        const evidence={scan:'百万行表，高频按商品编号查1行；实际每次全扫描，耗时主要在读取，无锁等待、无定位索引。',wait:'只扫描1行，却持续等另一个事务的记录锁。',stale:'请求需读自己刚写的库存8，副本还为10；读取很快，但值旧。',small:'仅有四行表，扫描4行、返回1行；尚无频率、延迟和资源成本证据。'};
        return {evidence:evidence[o.scene], correct:good, expected:remedies[o.scene],
          why: s.choice===null ? '选择最有依据的下一步，不是仅凭扫描行数永久加一种方案。' : good ? ({scan:'大量无关扫描与高频定位对应，应测试合适索引；比较计划、实际读取与写入成本后再决定保留。',wait:'先检查阻塞事务为什么没结束，再缩短持锁步骤；扫描一行不代表等待成本小。',stale:'这次请求要求读到刚写结果，按策略读主库直接对应需求；索引不能让副本追上。',small:'证据不足。小表扫描可能更划算，先核对计划、频率与实际成本，再决定是否优化。'}[o.scene]) : o.scene==='small' ? '仅扫描四行不能证明索引值得增加，也没有锁等待或旧值证据。应先检查计划与实际成本。' : '这个选择没有首先针对已知瓶颈；索引不能释放他人的锁，缩短事务不能让副本追上。按当前证据选下一步。'};
      }
      case 'shard': {
        const a=[[1,10],[3,20]],b=[[2,8],[4,12]];
        const sum=rows=>rows.reduce((total,row)=>total+row[1],0);
        const locals=o.query==='user'?[['A','user_id=3',a.find(row=>row[0]===3)[1]]]:[['A','SUM(amount)',sum(a)],['B','SUM(amount)',sum(b)]];
        return {shards:o.query==='user' ? ['A'] : ['A','B'],a,b,localResults:locals,value:locals.reduce((total,row)=>total+row[2],0),
          why:o.query==='user' ? '奇数user_id在A，偶数在B。user_id=3路由到A，只取该用户amount=20，不是A全片合计30。' : '全体SUM没有限定分片键，路由到两片。A由10+20得到30，B由8+12得到20，再合并30+20=50；访问两片与合并都是额外工作。'};
      }
      case 'transfer': return {separate: s.phase===0 ? [100,50] : [90,50], together:s.phase===0 || s.phase===3 ? [100,50] : [90,50],
        operations:[['起点','两栏A100、B50','右栏BEGIN，左栏默认自动提交'],['扣10','A余额减10','左栏已提交；右栏未提交'],['加款失败','B的加款未成功','B仍50；右栏事务仍进行'],['主动回滚','程序执行ROLLBACK','左栏仍90/50；右栏恢复100/50']],
        why:['A100、B50，总额150。下面两栏执行同样的操作，只改变两步是否共用提交边界。','扣款后两栏都看到A90、B50。左栏扣款已自动提交；右栏扣款尚未提交。相同余额，不同撤销边界。','第二步加款失败，没有修改B。报错本身不保证右栏整笔事务自动回滚；程序还需要明确处理。','执行ROLLBACK：左栏扣款已提交，仍90/50；右栏撤销未提交扣款，恢复100/50。'][s.phase]};
      case 'acid': return {balances:[90,50+Number(o.credit)], total:140+Number(o.credit), valid:o.credit==='10',
        why:o.credit==='10' ? '两步整体提交，扣加金额对应，总额仍150。原子性与本例业务规则都满足。' : '两步也整体提交，但加款写成20，总额变160。数据库不知道所有业务规则，不会凭事务边界猜出正确金额。'};
      default: throw Error('Unknown learning model');
    }
  }
  const esc=v=>String(v??'NULL').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tbl=(name,cols,rows)=>`<div class="lab-table"><strong>${esc(name)}</strong><div class="table-wrap"><table class="data-table${cols.length>4?' lab-wide-table':''}"><thead><tr>${cols.map(c=>`<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const button=(action,value,label,selected=false)=>`<button type="button" data-lab-action="${action}" data-lab-value="${esc(value)}"${action==='choose' ? ` aria-pressed="${selected}"` : ''}>${esc(label)}</button>`;
  const select=(s,key,label,items)=>`<label>${esc(label)}<select data-lab-option="${key}">${items.map(([v,t])=>`<option value="${v}"${s.options[key]===v?' selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  const flow=items=>`<ol class="lab-flow">${items.map(v=>`<li>${esc(v)}</li>`).join('')}</ol>`;
  const ledger=(name,values,status)=>`<section class="lab-ledger"><h5>${esc(name)}</h5><dl><div><dt>A</dt><dd>${values[0]}元</dd></div><div><dt>B</dt><dd>${values[1]}元</dd></div><div><dt>总额</dt><dd>${values[0]+values[1]}元</dd></div></dl><p>${esc(status)}</p></section>`;
  let graphId=0;
  const box=(id,x,y,width,height,title,...lines)=>({id,x,y,width,height,title,lines});
  function graphVisual(config) {
    const marker=`lab-graph-arrow-${++graphId}`, nodes=new Map(config.nodes.map(n=>[n.id,n]));
    function anchor(n,side,offset=.5) {
      if(side==='left'||side==='right')return [n.x+(side==='right'?n.width:0),n.y+n.height*offset];
      return [n.x+n.width*offset,n.y+(side==='bottom'?n.height:0)];
    }
    const links=config.edges.map(e=>{
      const a=anchor(nodes.get(e.from),e.from_side||'bottom',e.from_offset??e.offset??.5);
      const b=anchor(nodes.get(e.to),e.to_side||'top',e.to_offset??e.offset??.5);
      const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2-7;
      return `<path class="${e.active?'active-route':''}" d="M${a[0]} ${a[1]} L${b[0]} ${b[1]}" marker-end="url(#${marker})"/>${e.label?`<text class="graph-edge-label" x="${x}" y="${y}">${esc(e.label)}</text>`:''}`;
    }).join('');
    const groups=(config.groups||[]).map(g=>`<rect class="graph-group" x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}"/><text class="graph-group-title" x="${g.x+14}" y="${g.y+24}">${esc(g.title)}</text>`).join('');
    const cells=config.nodes.map(n=>`<g><rect class="${n.active?'chosen':''}" x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"/><text class="graph-node-title" x="${n.x+n.width/2}" y="${n.y+24}">${esc(n.title)}</text>${n.lines.map((line,i)=>`<text x="${n.x+n.width/2}" y="${n.y+48+i*21}">${esc(line)}</text>`).join('')}</g>`).join('');
    return `<p class="lab-scroll-hint">宽图可左右滑动查看完整连线。</p><div class="lab-graph-wrap" tabindex="0" aria-label="可左右滚动的机制图"><svg class="lab-graph" style="min-width:${config.width}px" viewBox="0 0 ${config.width} ${config.height}" role="img" aria-label="${esc(config.nodes.map(n=>n.title+': '+n.lines.join('，')).join('；'))}"><defs><marker id="${marker}" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7"/></marker></defs>${groups}${links}${cells}</svg></div>`;
  }
  const tree=(s,r)=>graphVisual({width:520,height:280,nodes:[box('root',180,10,160,80,'根所在的页R','分隔键5','两条子页引用'),box('left',10,170,185,95,'左叶所在的页L','id=1 → 商品1行','id=3 → 商品3行'),box('right',325,170,185,95,'右叶所在的页H','id=5 → 商品5行','id=8 → 商品8行')],edges:[{from:'root',to:'left',label:'目标小于5',active:r.correct&&s.choice==='left'},{from:'root',to:'right',label:'目标至少5',active:r.correct&&s.choice==='right'},{from:'left',to:'right',from_side:'right',to_side:'left',label:'叶子相连',active:s.phase===1}]});
  function surface(s) {
    const r=result(s), o=s.options; let controls='', visual='', actions='';
    const sel=(key,label,items)=>select(s,key,label,items), choose=(value,label)=>button('choose',value,label,s.choice===value);
    switch(s.model) {
      case 'cache': controls=sel('cached','查询前页P是否在缓冲池',[['no','不在'],['yes','已在']]); visual=`<p class="lab-box">同一请求：服务层处理SELECT → InnoDB定位页P → 从P取编号2 → 返回name</p>`+graphVisual({width:780,height:250,nodes:[box('disk',10,45,215,155,'磁盘：页P','id=1，name=水','id=2，name=面包','磁盘内容不因查询改变'),box('memory',310,45,245,155,'内存：InnoDB缓冲池',o.cached==='yes'?'查询前：已有P':'查询前：没有P',o.cached==='yes'?'直接复用内存P':'执行时：读入整页P','从P取id=2的name'),box('result',620,80,150,80,'返回结果','面包')],edges:[...(o.cached==='no'?[{from:'disk',to:'memory',from_side:'right',to_side:'left',label:'读入整页P',active:true}]:[]),{from:'memory',to:'result',from_side:'right',to_side:'left',label:'取name',active:true}]})+`<p class="lab-metric">本次磁盘取页：${r.diskReads}次；返回仍是面包</p>`; break;
      case 'path': controls=sel('target','查询目标',[['3','id=3'],['8','id=8'],['range','id从3到8']]); visual=tree(s,r); actions=choose('left','走左叶')+choose('right','走右叶'); if(r.correct) {visual+=tbl('找到的键',['id'],r.keys.map(v=>[v]));if(o.target==='range'&&s.phase===0)actions+=button('run','','沿叶子连接到右叶');} break;
      case 'cover': controls=sel('columns','SELECT哪些列',[['id,name','id、name'],['id,name,stock','id、name、stock']]); visual=`<p class="lab-box">SELECT ${esc(o.columns)} FROM products WHERE name='水'</p>`+graphVisual({width:740,height:230,nodes:[box('secondary',10,30,245,170,'name二级叶子','水 / id=1','水 / id=4','没有stock列'),box('primary',420,30,310,170,'主键叶子里的同批商品','id=1 / 水 / stock=10','id=2 / 面包 / stock=0','id=3 / 奶 / stock=8','id=4 / 水 / stock=6')],edges:r.back?[{from:'secondary',to:'primary',from_side:'right',to_side:'left',from_offset:.28,to_offset:.28,label:'id=1补stock',active:true},{from:'secondary',to:'primary',from_side:'right',to_side:'left',from_offset:.40,to_offset:.65,label:'id=4补stock',active:true}]:[]})+`<p class="lab-metric">${r.back?'stock缺失，按两件商品的id分别补取':'id、name已经齐全，直接由二级项组成结果'}；为补列回表：${r.fetches}次</p>${tbl('查询结果',r.columns,r.rows)}`; break;
      case 'prefix': controls=sel('index','索引列顺序',[['name,price','(name, price)'],['price,name','(price, name)']])+sel('query','查询条件',[['name',"name='水'"],['both',"name='水' AND price=4"],['price','只给price=4']]); visual=tbl('同四项：位置由索引声明决定',['name','price','id','定位阶段','完整条件'],r.inspected)+`<p class="lab-metric">定位后候选：${r.candidates}项；最终符合：${r.matched.length}项</p>`+tbl('最终结果：本次条件全部成立',['name','price','id'],r.matched); break;
      case 'plan': controls=sel('query','SELECT name的条件',[['one','stock=0：1行'],['all','stock>=0：4行']]); visual=tbl('同一批商品：stock输入与条件判断',['id','name','stock','判断'],r.inspected)+tbl('抽象工作量：不是时间测量',['方案','索引项','回表/扫描','合计'],[['stock索引再取name',r.candidates,r.candidates,r.indexWork],['全表扫描',0,4,r.scanWork]]); actions=choose('index','展示我选的索引路径')+choose('scan','展示我选的扫描路径'); visual+=`<p class="lab-metric">模型推荐：${r.recommended==='index'?'索引':'扫描'}；下图${s.choice===null?'默认展示推荐':'展示你选的'}：${r.selected==='index'?'索引':'扫描'}</p>`+graphVisual({width:740,height:160,nodes:r.selected==='index'?[box('start',10,35,205,95,'stock二级索引',`找到${r.candidates}项stock候选`,`取得id：${r.selectedRows.map(row=>row[0]).join('、')}`),box('fetch',275,35,200,95,'按id回到主键树',`补取name：${r.candidates}次`),box('result',540,35,190,95,'产生结果',`${r.selectedRows.length}行`,'保留符合条件的name')]:[box('start',10,35,220,95,'扫描主键叶子中的行','依次检查id：1、2、3、4'),box('fetch',290,35,185,95,'判断stock条件',`保留id：${r.selectedRows.map(row=>row[0]).join('、')}`),box('result',540,35,190,95,'产生结果',`${r.selectedRows.length}行`,'不访问stock二级树')],edges:[{from:'start',to:'fetch',from_side:'right',to_side:'left',active:true},{from:'fetch',to:'result',from_side:'right',to_side:'left',active:true}]})+tbl('当前展示路径的手写EXPLAIN',['table','type','possible_keys','key','rows','Extra'],[r.plan])+tbl('两条合法路径产生相同结果',['name'],r.selectedRows.map(row=>[row[1]])); break;
      case 'read': controls=sel('mode','本轮隔离级别与第二次读法',[['rr','RR：两次普通SELECT'],['rc','RC：两次普通SELECT'],['locked','RR：第二次FOR UPDATE']]); visual=tbl('同一轮操作，时间向下',['时刻','连接T2','连接T1','当前记录'],[['1','BEGIN；UPDATE改8未提交','尚未首次读','8，未确认'],['2','仍未提交','BEGIN；首次普通SELECT → 10','8，T1不读未确认值'],['3','COMMIT确认8','事务仍进行','8，已确认'],['4','已结束',o.mode==='locked'?'SELECT…FOR UPDATE → 8':`再次普通SELECT → ${r.second}`,'当前仍是8']])+tbl('相同第二次读取时刻，规则决定所读值',['本轮规则','当前记录','T1第二次结果','选择依据'],[['RR普通读',8,10,'复用首次视角，排除当时T2修改'],['RC普通读',8,8,'建新视角，纳入T2已提交修改'],['RR锁定读',8,8,'读当前记录并取得锁；此时无冲突']])+`<div class="lab-read-result">本轮T1第一次10 → 第二次<strong>${r.second}</strong>；当前记录仍8</div>`; break;
      case 'versions': controls=sel('view','可选自检：标记哪份视图',[['before','V旧：T1首次SELECT时建立'],['after','V新：T2提交后重新建立']]); visual=tbl('与第8天相同的时间线',['时刻','连接T2','连接T1','记录与视图'],r.timeline)+graphVisual({width:760,height:170,nodes:[box('current',10,25,215,120,'products当前记录','stock=8，T2产生','现在T2已提交'),box('undo',310,25,190,120,'undo历史关联','可重建旧stock=10','不是products中的另一行'),box('old',580,25,170,120,'重建的旧版本','stock=10','更早已提交')],edges:[{from:'current',to:'undo',from_side:'right',to_side:'left',label:'不可见才沿历史',active:true},{from:'undo',to:'old',from_side:'right',to_side:'left',label:'重建',active:true}]})+`<div class="lab-pair">${tbl('V旧：首次读时T2活跃，RR随后复用',['检查版本','视图建立时的依据','本次动作'],r.oldChecks)}${tbl('V新：T2已提交，RC第二次读重建',['检查版本','视图建立时的依据','本次动作'],r.freshChecks)}</div><p class="lab-metric">同一当前8：V旧返回10，V新返回8；逐版检查不改变当前记录。</p>`; actions=choose('8','自检：标记视图读8')+choose('10','自检：标记视图读10'); break;
      case 'recovery': controls=sel('log','确认前留下的恢复依据',[['durable','redo已持久保存'],['volatile','没有持久redo（错误策略）']]); visual=graphVisual({width:760,height:170,nodes:[box('memory',10,25,205,120,'缓冲池：内存页',r.memory===null?'崩溃后丢失':'stock=8','进程内存不持久'),box('log',300,25,205,120,'磁盘：redo',o.log==='durable'?'已持久：足以恢复8':'没有持久恢复依据',o.log==='durable'?'提交前已保留':'错误策略却报告成功'),box('disk',550,25,200,120,'磁盘：商品页',`stock=${r.disk}`,s.phase===2&&o.log==='durable'?'已按日志重做':'提交时尚未写回8')],edges:s.phase===2&&o.log==='durable'?[{from:'log',to:'disk',from_side:'right',to_side:'left',label:'恢复重做',active:true}]:[]})+tbl('相同页状态，改变恢复信息',['内存页','磁盘页','持久redo'],[[r.memory===null?'崩溃后丢失':r.memory,r.disk,o.log==='durable'?'有：足够恢复8':'无']]); actions=s.phase<2 ? button('run','',s.phase===0?'模拟进程崩溃':'按剩余信息恢复') : ''; break;
      case 'range': controls=sel('lock','A的查询任务',[['record','按唯一id查已有20'],['nextkey','RR锁定(10,20]范围']])+sel('operation','B的操作',[['insert15','插入15'],['insert25','插入25'],['modify20','修改20']]); visual=`<p class="lab-box">A：BEGIN → ${esc(r.query)}<br>A尚未结束，持有本例所示的锁。</p><p>${esc(r.purpose)}</p><div class="lab-interval"><span>${o.lock==='nextkey'?'(10':'10'}</span><span class="${o.lock==='nextkey'?'protected':''}">间隙：目前没有15</span><strong class="protected">${o.lock==='nextkey'?'20]':'20'}</strong><span>25</span></div><p class="lab-box">B尝试：${o.operation==='modify20'?'UPDATE修改id=20':`INSERT插入id=${o.operation==='insert15'?15:25}`}；${o.operation==='modify20'?'修改A已经保护的20':o.lock==='record'?'新行不满足A的id=20条件':o.operation==='insert15'?'若插入成功，15会满足A的(10,20]范围条件':'25不满足A的(10,20]范围条件'}。</p><p class="lab-metric">A观察范围内的锁${r.blocked?'阻止B操作，需要等待A结束释放':'本身不阻止B操作'}</p>`; break;
      case 'deadlock': controls=sel('order','两事务访问顺序',[['opposite','A：1→2；B：2→1'],['same','A、B都：1→2']]); visual=graphVisual({width:760,height:225,nodes:[box('A',10,65,190,95,'事务A','BEGIN后的锁定操作'),box('R1',285,10,190,85,'商品记录1','FOR UPDATE请求X'),box('R2',285,125,190,85,'商品记录2','FOR UPDATE请求X'),box('B',560,65,190,95,'事务B','BEGIN后的锁定操作')],edges:[...r.owners.map(([who,id])=>({from:who,to:'R'+id,from_side:who==='A'?'right':'left',to_side:who==='A'?'left':'right',label:'已持有X'})),...r.requests.map(([who,id])=>({from:who,to:'R'+id,from_side:who==='A'?'right':'left',to_side:who==='A'?'left':'right',label:'申请X：等待',active:true}))]})+`<div class="lab-pair">${tbl('持有的X锁',['事务','商品记录'],r.owners)}<div class="lab-waits"><strong>等待箭头：等待者 → 持有者</strong>${r.edges.length ? r.edges.map(([a,b])=>`<p>${a} → ${b}</p>`).join('') : '<p>没有等待边</p>'}<p>${r.cycle?'形成环：A ⇄ B':'尚无等待环'}</p></div></div>`; actions=s.phase<3 ? button('run','',['取得第一把锁','请求第二把锁',o.order==='opposite'?'选择回滚B，释放锁':'A提交，释放锁'][s.phase]) : ''; break;
      case 'join': controls=sel('type','连接规则',[['inner','INNER JOIN'],['left','LEFT JOIN']]); visual=`<p class="lab-box">ON products.id = orders.product_id；每条线对应一对匹配。</p>`+graphVisual({width:760,height:405,nodes:[...r.products.map((row,i)=>box('p'+row[0],10,10+i*115,245,90,`商品id=${row[0]}`,`name=${row[1]}`,row[0]===3?'没有匹配订单':'')),...r.orders.map((row,i)=>box('o'+row[0],500,10+i*115,250,90,`订单id=${row[0]}`,`product_id=${row[1]}`)),...(o.type==='left'?[box('null',500,335,250,65,'LEFT补NULL结果','不是原订单表的一行')]:[])],edges:[...r.pairings.filter(pair=>pair[1]!==null).map(([pid,oid])=>({from:'p'+pid,to:'o'+oid,from_side:'right',to_side:'left',label:`${pid} = product_id`,active:true})),...(o.type==='left'?[{from:'p3',to:'null',from_side:'right',to_side:'left',label:'无匹配仍保留',active:true}]:[])]})+tbl('逐对判断与无匹配处理',['商品id','订单id','ON依据','动作'],r.pairings)+tbl('连接结果',['商品id','name','订单id'],r.rows)+`<p class="lab-metric">结果${r.rows.length}行</p>`; break;
      case 'diagnose': controls=sel('scene','请求证据',[['scan','大量扫描'],['wait','等待记录锁'],['stale','副本旧值'],['small','小表，证据不足']]); visual=`<p class="lab-box">${esc(r.evidence)}</p>`; actions=choose('index','测试定位索引')+choose('shorten','检查并缩短持锁步骤')+choose('primary','这次读取走主库')+choose('inspect','先查计划与实际成本'); break;
      case 'shard': controls=sel('query','查询范围',[['user','查user_id=3的金额'],['total','全体金额SUM']]); visual=graphVisual({width:890,height:355,nodes:[box('query',10,125,180,100,'请求',o.query==='user'?'user_id=3':'全体SUM(amount)'),box('route',245,125,155,100,'路由规则','奇数→A，偶数→B',o.query==='user'?'只访问A':'不限定用户：访问两片'),box('A',460,10,195,140,'分片A','user1=10，user3=20',o.query==='user'?'本次仅取user3：20':'本片SUM：10+20=30','本次访问'),box('B',460,205,195,140,'分片B','user2=8，user4=12',o.query==='user'?'本轮未访问':'本片SUM：8+12=20'),box('result',720,125,160,100,o.query==='user'?'局部查询结果':'合并结果',o.query==='user'?'user3金额20':'30+20=50')],edges:[{from:'query',to:'route',from_side:'right',to_side:'left',active:true},{from:'route',to:'A',from_side:'right',to_side:'left',active:true},...(o.query==='total'?[{from:'route',to:'B',from_side:'right',to_side:'left',active:true},{from:'B',to:'result',from_side:'right',to_side:'left',label:'本片20',active:true}]:[]),{from:'A',to:'result',from_side:'right',to_side:'left',label:o.query==='user'?'返回金额20':'本片30',active:true}]})+tbl('本次各片实际返回',['分片','片内操作','返回'],r.localResults)+`<p class="lab-metric">访问${r.shards.length}片 → ${o.query==='total'?'合并局部合计':'无跨片合并'} → 结果${r.value}</p>`; break;
      case 'transfer': visual=`<div class="lab-pair">${ledger('每条语句自动提交',r.separate,s.phase===0?'尚未扣款':'扣款已提交；不能靠回滚撤销')}${ledger('BEGIN：两步共用事务',r.together,s.phase===0?'事务开始':s.phase===3?'已回滚，事务结束':'扣款未提交，事务仍进行中')}</div>`+tbl('已执行的同一组操作',['阶段','操作','提交状态'],r.operations.slice(0,s.phase+1)); actions=s.phase<3?button('run','',['两栏同时：A扣10','两栏同时：加款失败','两栏同时：执行ROLLBACK'][s.phase]):''; break;
      case 'acid': controls=sel('credit','程序中的加款金额',[['10','A扣10，B加10'],['20','A扣10，B加20']]); visual=ledger('两步在同一事务中COMMIT',r.balances,'整体提交：是；总额150的规则：'+(r.valid?'成立':'被破坏')); break;
    }
    return `<div class="lab-options">${controls}</div><div class="lab-visual">${visual}</div><div class="lab-actions">${actions}${button('reset','','重置本例')}</div><div class="lab-feedback" role="status" aria-live="polite"><p>${esc(r.why)}</p></div>`;
  }
  const instances=new WeakMap();
  function mount(el,example) {
    if(example.kind==='static') {
      el.querySelector('.learning-surface').innerHTML=`<div class="lab-static-grid">${example.cards.map(c=>`<section class="lab-static-card"><h5>${esc(c.title)}</h5><p>${esc(c.text)}</p>${c.diagram?graphVisual(c.diagram):''}${c.table?tbl(c.table.name,c.table.columns,c.table.rows):''}${c.flow?flow(c.flow):''}</section>`).join('')}</div>`;
      return;
    }
    instances.set(el,{example,state:create(example.model)});
    el.querySelector('.learning-surface').innerHTML=surface(instances.get(el).state);
    function update(event) {
      const target=event.type==='change'?event.target.closest('[data-lab-option]'):event.target.closest('[data-lab-action]');
      if(!target) return;
      const instance=instances.get(el);
      instance.state=transition(instance.state,event.type==='change'?'option':target.dataset.labAction,event.type==='change'?{key:target.dataset.labOption,value:target.value}:target.dataset.labValue);
      const focusKey=event.type==='change'?`[data-lab-option="${target.dataset.labOption}"]`:`[data-lab-action="${target.dataset.labAction}"][data-lab-value="${target.dataset.labValue}"]`;
      el.querySelector('.learning-surface').innerHTML=surface(instance.state);
      (el.querySelector(focusKey)||el.querySelector('[data-lab-action="reset"]'))?.focus({preventScroll:true});
    }
    if(!el.dataset.labBound) {el.addEventListener('click',update);el.addEventListener('change',update);el.dataset.labBound='true';}
  }
  function textFor(e) {
    const parts=[e.title,e.intro];
    if(e.kind==='static') for(const c of e.cards) {parts.push(c.title+': '+c.text);if(c.flow)parts.push(...c.flow);if(c.table)parts.push(c.table.name+': '+c.table.columns.join('|'),...c.table.rows.map(r=>r.join('|')));if(c.diagram)parts.push(...c.diagram.nodes.map(n=>n.title+': '+n.lines.join('；')),...c.diagram.edges.map(link=>link.from+' → '+link.to+' '+link.label));}
    else {
      parts.push('概念演示：'+e.model,...(e.context||[]));
      const states=[create(e.model)];
      const options=optionValues[e.model]||{};
      let configs=[{}];for(const [key,values] of Object.entries(options))configs=configs.flatMap(c=>values.map(value=>({...c,[key]:value})));
      for(const config of configs)for(let phase=0;phase<=({transfer:3,deadlock:3,recovery:2,path:1}[e.model]||0);phase++) {
        const s={...create(e.model,config),phase};
        for(const choice of choices[e.model]||[null])states.push({...s,choice});
      }
      for(const s of states)parts.push('条件 '+JSON.stringify(s.options)+'；阶段 '+s.phase+'；选择 '+s.choice+'；结果 '+JSON.stringify(result(s)));
    }
    return [...new Set(parts),'演示边界：'+e.limit,...e.references].join('\n');
  }
  const api=Object.freeze({create,transition,result,mount,textFor});
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.CourseLabs=api;
})(typeof window==='undefined'?globalThis:window);
