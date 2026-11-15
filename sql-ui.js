(() => {
  'use strict';
  let current;
  const byId = id => document.getElementById(id);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function table(result) {
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${result.columns.map(c => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${result.values.map(row => `<tr>${row.map(v => `<td>${v === null ? '<span class="muted">NULL</span>' : esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${!result.values.length ? '<p class="micro">0行：当前没有匹配的记录。</p>' : ''}`;
  }
  function mount(root) {
    if (current) current.dispose();
    const area = root.querySelector('[data-sql-practice]');
    if (!area) { current = null; return; }
    const data = JSON.parse(byId('sql-exercises').textContent), exercises = data.days[area.dataset.sqlPractice];
    const panels = [...area.querySelectorAll('[data-sql-panel]')];
    let worker, workerURL, timeout, initTimeout, selected = 0, request = 0, pending, ready = false, disposed = false;
    const engineStatus = area.querySelector('[data-engine-status]');
    function buttons() {
      panels.forEach(panel => panel.querySelector('[data-sql-run]').disabled = !ready || Boolean(pending));
    }
    function stop() {
      clearTimeout(timeout); clearTimeout(initTimeout);
      worker?.terminate();
      if (workerURL) URL.revokeObjectURL(workerURL);
      worker = null; workerURL = null; pending = null; ready = false;
    }
    function start() {
      stop();
      if (disposed) return;
      engineStatus.textContent = '正在准备离线SQL练习…'; buttons();
      try {
        const source = byId('sqlite-library').textContent + '\n' + byId('sql-core-code').textContent + '\n' + byId('sql-worker-code').textContent;
        workerURL = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        worker = new Worker(workerURL);
        const wasm = Uint8Array.from(atob(byId('sqlite-wasm').textContent.trim()), c => c.charCodeAt(0));
        initTimeout = setTimeout(() => failInit('初始化超时。请重试，或换用支持WebAssembly的现代浏览器。'), 15000);
        worker.onerror = () => failInit('练习引擎无法启动。请重试；浏览器需支持WebAssembly和Worker。');
        worker.onmessage = event => {
          if (disposed) return;
          const message = event.data;
          if (message.type === 'ready') { clearTimeout(initTimeout); ready = true; engineStatus.textContent = data.engine + ' · 离线可用'; buttons(); return; }
          if (message.type === 'init-error') { failInit('初始化失败：' + message.error); return; }
          if (!pending || message.id !== pending.id) return;
          const panel = pending.panel;
          clearTimeout(timeout); pending = null;
          if (message.type === 'result') {
            panel.querySelector('[data-sql-result]').innerHTML = (message.beforeResult ? '<h4>回滚前</h4>' + table(message.beforeResult) + '<h4>回滚后</h4>' : '') + table(message.result);
            const status = panel.querySelector('[data-sql-status]');
            const change = message.affected === undefined ? '' : `本次影响${message.affected}行；下表是操作后的数据。`;
            status.textContent = message.result.truncated ? '仅显示前100行，请把查询范围缩小。' : change + (message.correct ? '结果符合题目。可以对照参考写法，或继续下一题。' : '语句已执行，但结果与题目不同。检查目标记录、列和值，以及其他行是否被改动。');
            status.dataset.tone = message.correct ? 'success' : 'notice';
          } else {
            panel.querySelector('[data-sql-result]').innerHTML = '';
            panel.querySelector('[data-sql-status]').textContent = message.error;
            panel.querySelector('[data-sql-status]').dataset.tone = 'error';
          }
          buttons();
        };
        worker.postMessage({ type: 'init', seed: data.seed, exercises, wasm: wasm.buffer }, [wasm.buffer]);
      } catch (error) { failInit('初始化失败：' + error.message); }
    }
    function failInit(message) { stop(); engineStatus.textContent = message; buttons(); }
    function choose(index) {
      selected = index;
      panels.forEach((panel, i) => panel.hidden = i !== index);
      area.querySelectorAll('[data-sql-tab]').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    function run(panel) {
      if (!ready || pending) return;
      const index = panels.indexOf(panel), sql = panel.querySelector('textarea').value;
      const id = ++request;
      pending = { id, panel }; buttons();
      panel.querySelector('[data-sql-status]').textContent = '正在执行…';
      panel.querySelector('[data-sql-status]').dataset.tone = 'notice';
      worker.postMessage({ type: 'run', id, sql, exerciseId: exercises[index].id });
      // A separate Worker keeps costly or accidental queries from freezing reading and notes.
      timeout = setTimeout(() => {
        panel.querySelector('[data-sql-result]').innerHTML = '';
        panel.querySelector('[data-sql-status]').textContent = '执行超过2秒，已停止。请使用本课的简单语句后重试。';
        panel.querySelector('[data-sql-status]').dataset.tone = 'error';
        start();
      }, 2000);
    }
    function onClick(event) {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.hasAttribute('data-sql-tab')) choose(Number(button.dataset.sqlTab));
      if (button.hasAttribute('data-sql-retry')) start();
      const panel = button.closest('[data-sql-panel]');
      if (!panel) return;
      if (button.hasAttribute('data-sql-run')) run(panel);
      if (button.hasAttribute('data-sql-reset')) {
        if (pending) start();
        const input = panel.querySelector('textarea'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true }));
        panel.querySelector('[data-sql-status]').textContent = '本题已重置。每次运行都会使用同一份初始数据。';
        panel.querySelector('[data-sql-status]').dataset.tone = 'notice';
        panel.querySelector('[data-sql-result]').innerHTML = '';
        panel.querySelectorAll('details').forEach(el => el.open = false);
      }
      if (button.hasAttribute('data-sql-next')) choose(Math.min(panels.length - 1, selected + 1));
    }
    function onKey(event) {
      if (event.target.matches('textarea') && event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); run(event.target.closest('[data-sql-panel]')); }
    }
    area.addEventListener('click', onClick); area.addEventListener('keydown', onKey);
    current = { dispose() { disposed = true; stop(); area.removeEventListener('click', onClick); area.removeEventListener('keydown', onKey); } };
    choose(0); start();
  }
  function textFor(id) {
    const match = /^d(\d+)-sql$/.exec(id);
    if (!match) return '';
    const data = JSON.parse(byId('sql-exercises').textContent);
    const seedTables = data.fixtures?.[match[1]]?.tables || [data.table];
    return ['SQL练习引擎：' + data.engine + '，不是MySQL。每次重新使用初始数据。',...seedTables.map(t => '练习表：' + t.name + '\n' + JSON.stringify({columns:t.columns,rows:t.rows})),...data.days[match[1]].flatMap((item,i) => [`第${i + 1}题：${item.prompt}`, '提示：' + item.hint, ...(item.setup ? ['预设前置：' + item.setup] : []), '参考SQL：' + item.answer, ...(item.after ? ['预设后置：' + item.after] : [])])].join('\n');
  }
  window.CourseSQL = Object.freeze({ mount, textFor });
})();
