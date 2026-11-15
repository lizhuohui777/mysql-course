(() => {
  'use strict';
  const examples = JSON.parse(document.getElementById('diagram-data').textContent), instances = new WeakMap();
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function tables(config, step) {
    return `<div class="db-diagram-tables">${config.tables.map(t => `<div class="db-diagram-table"><strong>${esc(t.name)}</strong><div class="table-wrap"><table class="data-table"><thead><tr>${t.columns.map(c => `<th scope="col" class="${(step.columns || []).includes(t.name + '.' + c) ? 'db-highlight' : ''}">${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map((row,i) => `<tr class="${(step.rows || []).includes(t.name + ':' + i) ? 'db-highlight' : ''}">${row.map((v,j) => `<td class="${(step.columns || []).includes(t.name + '.' + t.columns[j]) ? 'db-highlight' : ''}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('')}</div>${step.result ? `<div class="db-result-line"><strong>得到的信息</strong><span>${esc(step.result)}</span></div>` : ''}`;
  }
  function documents(config, step) {
    if (step.show === 'table') return tables(config, step);
    return `<div class="document-pair">${config.documents.map((doc,i) => `<div class="mini-card ${step.active === i ? 'db-highlight' : ''}"><strong>记录 ${i + 1}</strong><pre><code>${esc(JSON.stringify(doc,null,2))}</code></pre></div>`).join('')}</div>${step.result ? `<div class="db-result-line"><strong>观察</strong><span>${esc(step.result)}</span></div>` : ''}`;
  }
  function textSlots(config, step) {
    const value = step.value || config.value;
    return `<div class="db-text-input ${step.focus === 'input' ? 'db-highlight' : ''}">写入的值：<code>${esc(value)}</code><span>${[...value].length} 个字符</span></div><div class="db-string-model"><div class="${step.focus === 'char' ? 'db-highlight' : ''}"><strong>CHAR(4)</strong><div class="string-slots">${Array.from({length:4},(_,i) => `<span class="${i < [...value].length ? 'filled' : ''}">${esc([...value][i] || '空格')}</span>`).join('')}</div><small>固定长度的概念示意</small></div><div class="${step.focus === 'varchar' ? 'db-highlight' : ''}"><strong>VARCHAR(4)</strong><div class="string-slots"><span class="length-prefix">长度</span>${[...value].map(c => `<span class="filled">${esc(c)}</span>`).join('')}</div><small>长度信息＋实际内容；最多4个字符</small></div></div>${step.result ? `<div class="db-result-line ${step.focus === 'result' ? 'db-highlight' : ''}"><strong>观察</strong><span>${esc(step.result)}</span></div>` : ''}`;
  }
  function tree(config, step) {
    return `<div class="index-tree">${config.levels.map((level,i) => `<div class="index-tree-level">${level.map((label,j) => `<div class="mini-card ${step.nodes?.includes(i + ':' + j) ? 'db-highlight' : ''}">${esc(label)}</div>`).join('')}</div>${i < config.levels.length - 1 ? '<div class="tree-arrow">↓ 按键值范围选择子节点 ↓</div>' : ''}`).join('')}<p class="micro">${esc(config.caption || '叶子按键值顺序相连：左 → 右')}</p></div>${step.result ? `<div class="db-result-line"><strong>观察</strong><span>${esc(step.result)}</span></div>` : ''}`;
  }
  function render(el) {
    const state = instances.get(el), example = examples[el.dataset.example], current = example.cases[state.case], step = current.steps[state.step];
    const config = step.diagram || current.diagram || example.diagram;
    el.querySelectorAll('[data-example-case]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.exampleCase) === state.case)));
    el.querySelector('[data-example-previous]').disabled = state.step === 0;
    el.querySelector('[data-example-next]').disabled = state.step === current.steps.length - 1;
    el.querySelector('.ex-count').textContent = `${state.step + 1} / ${current.steps.length}`;
    el.querySelector('.ex-assumption').textContent = current.assumption;
    el.querySelector('.ex-canvas').innerHTML = (config.kind === 'tree' ? tree : config.kind === 'text' ? textSlots : config.kind === 'documents' ? documents : tables)(config,step);
    el.querySelector('.ex-step-title').textContent = step.title;
    el.querySelector('.ex-step-text').textContent = step.text;
    el.querySelector('.ex-all-steps').innerHTML = current.steps.map(s => `<li><strong>${esc(s.title)}</strong><p>${esc(s.text)}</p></li>`).join('');
  }
  function mount(root) { root.querySelectorAll('[data-example]').forEach(el => {
    const example = examples[el.dataset.example];
    if (['lab','static'].includes(example.kind)) window.CourseLabs.mount(el,example);
    else { instances.set(el,{case:0,step:0}); render(el); }
  }); }
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-example-case],[data-example-previous],[data-example-next],[data-example-reset]');
    if (!button) return;
    const el = button.closest('[data-example]'), state = instances.get(el);
    if (!state) return;
    if (button.hasAttribute('data-example-case')) { state.case = Number(button.dataset.exampleCase); state.step = 0; }
    if (button.hasAttribute('data-example-reset')) state.step = 0;
    if (button.hasAttribute('data-example-previous')) state.step = Math.max(0,state.step - 1);
    if (button.hasAttribute('data-example-next')) state.step = Math.min(examples[el.dataset.example].cases[state.case].steps.length - 1,state.step + 1);
    render(el);
  });
  function textFor(id) {
    const e = examples[id];
    if (e && ['lab','static'].includes(e.kind)) return window.CourseLabs.textFor(e);
    return e ? [e.title,e.intro,...e.cases.flatMap(c => ['情形：' + c.label + '；' + c.assumption,...c.steps.map(s => s.title + '：' + s.text)]), '图示边界：' + e.limit,...e.references].join('\n') : '';
  }
  window.CourseDiagrams = Object.freeze({ mount, textFor });
})();
