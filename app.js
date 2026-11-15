(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const course = JSON.parse($('course-data').textContent);
  const mode = document.body.dataset.courseMode;
  const review = mode === 'review';
  const model = window.CourseState;
  const templates = new Map([...document.querySelectorAll('template[data-day]')].map(template => [Number(template.dataset.day), template]));
  const topicSources = topic => [...new Set([topic.dataset.sources, topic.dataset.relatedSources].filter(Boolean).join(',').split(',').filter(Boolean))];
  const topicCatalog = [...templates].flatMap(([day, template]) => [...template.content.querySelectorAll('.topic')].map(topic => ({ day, id: topic.id, title: topic.dataset.topic, sources: topicSources(topic) })));
  const noteKey = id => `${id}-note`;
  const catalog = { courseId: course.id, fieldKeys: new Set(['feedback-draft']), ratingKeys: new Set(), topicIds: new Set(topicCatalog.map(topic => topic.id)), fieldTypes: new Map([['feedback-draft', 'string']]) };
  for (const template of templates.values()) {
    template.content.querySelectorAll('[data-save]').forEach(el => { catalog.fieldKeys.add(el.dataset.save); catalog.fieldTypes.set(el.dataset.save, el.type === 'checkbox' ? 'boolean' : 'string'); });
    template.content.querySelectorAll('[data-quiz]').forEach(el => { catalog.fieldKeys.add(`${el.dataset.quiz}-answer`); catalog.fieldTypes.set(`${el.dataset.quiz}-answer`, 'string'); catalog.ratingKeys.add(el.dataset.quiz); });
    template.content.querySelectorAll('[data-topic-rating]').forEach(el => catalog.ratingKeys.add(el.dataset.topicRating));
  }
  topicCatalog.forEach(topic => { catalog.fieldKeys.add(noteKey(topic.id)); catalog.fieldTypes.set(noteKey(topic.id), 'string'); catalog.ratingKeys.add(topic.id); });
  const KEY = `${course.id}:${mode}:v2`;
  const phases = { recall: '回忆', main: '主线', sql: 'SQL', quiz: '自测', close: '收尾' };
  let persistent = true, state = model.create(course.id, mode);
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) state = model.normalize(JSON.parse(saved), catalog, mode);
  } catch { persistent = false; }
  if (!templates.has(state.day)) state.day = course.published_days[0];
  let day = state.day, view = 'lesson', running = false, startedAt = 0, phase = state.ui.phase;
  let notesOpen = false, selectedTopic = state.ui.noteTopic, lastNotesTrigger = null, feedbackTopic = '', toastTimeout;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clock = ms => { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; };
  const dayInfo = () => course.days.find(item => item.day === day);
  const topics = () => topicCatalog.filter(topic => topic.day === day);
  const elapsed = () => Object.values(state.timing[day]).reduce((a, b) => a + b, 0);
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); persistent = true; } catch { persistent = false; }
    $('storage-warning').hidden = persistent;
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 4300); }
  function sourceItems(ids, compact = false) {
    return ids.map(id => { const item = course.questions[id]; return `<a class="source-chip" href="${esc(item.url)}" title="${esc(item.source_heading || item.label)}" target="_blank" rel="noopener noreferrer">${id === 'S1' ? '补充题' : '#' + id}${compact ? '' : ' ' + esc(item.label)}</a>`; }).join('');
  }
  function nav() {
    const unlocked = model.unlocked(state);
    $('day-nav').innerHTML = course.days.filter(item => templates.has(item.day) && (review || item.day <= unlocked)).map(item => `${item.day === 1 || item.day === 7 ? `<div class="week-label">第${item.week}周</div>` : ''}<button class="day-button ${day === item.day && view === 'lesson' ? 'active' : ''}" data-day="${item.day}" ${day === item.day && view === 'lesson' ? 'aria-current="page"' : ''}><span class="day-number">${state.completed.includes(item.day) ? '✓' : String(item.day).padStart(2, '0')}</span><span class="day-copy">${esc(item.title)}</span></button>${item.day === 6 || item.day === 12 ? '<div class="rest-label">休息日</div>' : ''}`).join('');
    $('progress-label').textContent = `${state.completed.length} / 12`;
    $('course-progress').value = state.completed.length;
    $('unlock-status').textContent = course.published_days.length < 12 ? `当前已制作第${course.published_days.join('、')}天；其余天数保留路线。${!review && templates.has(unlocked + 1) ? `完成第${unlocked}天后开放下一天。` : ''}` : !review && unlocked < 12 ? `完成第${unlocked}天后，开放下一天` : '';
  }
  function planCard(item) {
    const available = templates.has(item.day);
    if (!available || !model.canOpen(item.day, state)) return `<article class="card plan-card unavailable-day"><div class="plan-top"><small class="eyebrow">第${item.day}天</small><h2>${esc(item.title)}</h2></div><p>${esc(item.sql)}</p><details><summary>关联网站知识点</summary><div class="source-items">${sourceItems(item.ids)}</div></details><span class="chip">${available ? '尚未解锁' : '尚未制作'}</span></article>`;
    return `<article class="card plan-card"><div class="plan-top"><small class="eyebrow">第${item.day}天</small><h2>${esc(item.title)}</h2></div><p class="plan-sql">SQL：${esc(item.sql)}</p><ul>${item.goals.map(goal => `<li>${esc(goal)}</li>`).join('')}</ul><details><summary>关联网站知识点</summary><div class="source-items">${sourceItems(item.ids)}</div></details><button data-day="${item.day}">打开课件 →</button></article>`;
  }
  function roadmap() {
    const overview = `<details class="card"><summary>按天核对原理、SQL和原站条目</summary><div class="table-wrap"><table class="data-table roadmap-table"><thead><tr><th>天数</th><th>原理主线</th><th>SQL练手</th><th>原站条目</th></tr></thead><tbody>${course.days.map(item => `<tr><td>${item.day}</td><td>${esc(item.title)}</td><td>${esc(item.sql)}</td><td>${sourceItems(item.ids, true)}</td></tr>`).join('')}</tbody></table></div></details>`;
    $('roadmap-view').innerHTML = `<div class="roadmap-intro"><h1>12天路线</h1></div>${overview}${course.days.map(item => `${item.day === 1 || item.day === 7 ? `<h2 class="week-banner">第${item.week}周</h2>` : ''}${planCard(item)}${item.day === 6 || item.day === 12 ? '<p class="week-banner">休息日</p>' : ''}`).join('')}`;
  }
  function guide() {
    const progressGuide = review ? `可自由检查${course.published_days.length}天完整课件，检查记录与正式学习记录分开。` : '正式学习按天解锁：完成5道自测并自评、勾选3项收尾后，可标记本日完成。SQL短题不增加解锁门槛，已解锁课程可随时回看。';
    $('guide-view').innerHTML = `<div class="roadmap-intro"><h1>使用说明</h1></div><section class="card"><h2>每天怎样学习</h2><p>每天75分钟：回忆3分钟，原理主线45分钟，SQL讲解与4道短题15分钟，自测与收尾合计12分钟。每周六个学习日，留一天休息。</p><p>计时归类需手动选择；它只记录用时，不会判断掌握程度。切换浏览器标签页、到后台查资料或与GPT交流时继续计时，休息时请手动暂停。</p><p>正常刷新或关闭页面前会结算保存，重新打开保持暂停，点击继续才恢复计时。切换学习日、完成课程或进入本站路线与说明页时仍暂停，避免记错课程。后台计时可能不实时刷新显示，返回时按实际经过时间补齐。</p><p>${progressGuide}</p></section><section class="card"><h2>学习模式与笔记</h2><p>学习模式收起两侧栏。每个知识点的“笔记”打开独立记录，支持复制粘贴，输入后自动保存。按Esc先收起笔记，再退出学习模式。</p></section><section class="card"><h2>换电脑继续</h2><ol><li>把整个mysql-course文件夹带到另一台电脑，打开index.html。当前开发版本尚未发布。</li><li>在当前电脑“导出学习记录”，把JSON文件带过去，再“导入学习记录”。</li><li>在另一台电脑继续同一聊天，或将带过去的项目文件夹关联到新的本地项目。</li></ol><p>课件代码、浏览器学习记录和GPT聊天历史是三件不同的事，不会因同一个账户自动合并。没有文件访问权限时，用“导出本课交接”把当前内容与笔记提供给GPT。</p><p>编写检查记录与正式学习记录分开。</p></section>`;
  }
  function ratingButtons(id, quiz = false) {
    const labels = quiz ? ['能独立解释', '只答对部分', '需要重学'] : ['已理解', '有点模糊', '需要补充'];
    return ['understood', 'partial', 'review'].map((value, i) => `<button data-rate="${id}" data-value="${value}" aria-pressed="${state.ratings[id] === value}">${labels[i]}</button>`).join('');
  }
  function hydrate() {
    document.querySelectorAll('[data-topic-rating]').forEach(el => el.innerHTML = ratingButtons(el.dataset.topicRating));
    document.querySelectorAll('[data-quiz]').forEach(el => {
      const id = el.dataset.quiz;
      el.querySelector('.quiz-input').innerHTML = `<label class="inline-label" for="${id}-answer">我的回答</label><textarea id="${id}-answer" data-save="${id}-answer" maxlength="20000" rows="3" placeholder="写下你的理解"></textarea>`;
      el.querySelector('.quiz-rating').innerHTML = `<div class="rating-group">${ratingButtons(id, true)}</div>`;
    });
    document.querySelectorAll('#day-content [data-save]').forEach(el => { const value = state.fields[el.dataset.save]; if (el.type === 'checkbox') el.checked = value === true; else el.value = typeof value === 'string' ? value : ''; });
    document.querySelectorAll('[data-day-sources]').forEach(el => el.innerHTML = `<span>本课关联网站知识点</span><div class="source-row">${sourceItems(dayInfo().ids, true)}</div>`);
    document.querySelectorAll('#day-content .topic').forEach(topic => {
      topic.querySelector('[data-topic-sources]').innerHTML = `<span>${topicSources(topic).length ? '对应网站知识点' : '基础衔接与使用'}</span><div class="source-row">${sourceItems(topicSources(topic))}${(topic.dataset.references || '').split('|').filter(Boolean).map(url => {
        const label = url.startsWith('https://dev.mysql.com/') ? 'MySQL 官方' : url.startsWith('https://www.w3schools.com/') ? 'W3Schools · ' + (url.match(/(?:mysql|sql)_(\w+)\.asp/)?.[1] || 'SQL').replaceAll('_', ' ').toUpperCase() : '参考资料';
        return `<a class="source-chip" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
      }).join('')}</div>`;
    });
    document.querySelectorAll('[data-day-references]').forEach(el => el.innerHTML = `<div class="source-items">${sourceItems(dayInfo().ids)}</div>`);
    $('section-nav').innerHTML = `<a href="#d${day}-warmup">01 回忆检查</a><a href="#d${day}-main">02 今日主线</a><a href="#d${day}-practice">03 SQL短练习</a><a href="#d${day}-quiz">04 理解自测</a><a href="#d${day}-close">05 收尾记录</a>`;
    window.CourseDiagrams.mount($('day-content'));
    window.CourseSQL.mount($('day-content')); summary(); completion();
  }
  function showView(nextView) {
    if (nextView !== 'lesson') { pause(); setStudyMode(false); }
    view = nextView;
    ['lesson', 'roadmap', 'guide'].forEach(name => $(`${name}-view`).hidden = name !== view);
    document.querySelectorAll('.tab').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    document.querySelector('.study-tools').hidden = view !== 'lesson';
    nav(); studyUI();
  }
  function openDay(nextDay, scroll = true) {
    if (!templates.has(nextDay)) { toast(`第${nextDay}天尚未制作，请查看已完成课件或12天路线。`); return; }
    if (!model.canOpen(nextDay, state)) { toast(`请先完成第${model.unlocked(state)}天。`); return; }
    pause();
    if (nextDay !== day) { phase = 'recall'; state.ui.phase = phase; notesOpen = false; }
    day = nextDay; state.day = day;
    showView('lesson');
    $('day-label').textContent = `第${day}天`;
    $('lesson-title').textContent = dayInfo().title;
    $('day-content').innerHTML = templates.get(day).innerHTML;
    hydrate(); notes(); studyUI(); renderTimer(); save();
    if (scroll) { window.scrollTo(0, 0); $('workspace').focus({ preventScroll: true }); }
  }
  function summary() {
    const scores = [...document.querySelectorAll('[data-quiz]')].map(el => state.ratings[el.dataset.quiz]);
    $('quiz-summary').hidden = !scores.some(Boolean);
    $('quiz-summary').textContent = `自评：${scores.filter(v => v === 'understood').length}题能独立解释，${scores.filter(v => v === 'partial').length}题部分理解，${scores.filter(v => v === 'review').length}题需重学。`;
  }
  function completion() {
    const done = state.completed.includes(day);
    $('mark-complete').disabled = review || done;
    $('mark-complete').textContent = review ? '检查模式' : done ? '本日已完成' : '标记本日完成';
    $('completion-note').textContent = done && !templates.has(day + 1) && day < 12 ? '本日已完成。下一天尚未制作；现在可以复习已解锁课程或查看12天路线。' : day === 12 && done ? '12天课程已完成，可以按笔记和自测结果复习。' : '';
    $('next-lesson').innerHTML = (review || done) && day < 12 && templates.has(day + 1) ? `<button class="primary" data-day="${day + 1}">进入第${day + 1}天 →</button>` : '';
  }
  function markComplete() {
    if (review || state.completed.includes(day)) return;
    const questions = [...document.querySelectorAll('[data-quiz]')];
    const answersReady = questions.every(el => state.fields[`${el.dataset.quiz}-answer`]?.trim() && state.ratings[el.dataset.quiz]);
    const checksReady = [...document.querySelectorAll('#day-content input[type="checkbox"][data-save]')].every(el => el.checked);
    if (!answersReady || !checksReady) { toast('请先完成5题作答与自评，并勾选3项收尾检查。'); return; }
    if (!model.complete(day, state)) return;
    pause(); save(); completion(); nav(); roadmap();
    toast(day === 12 ? '12天课程已完成。' : templates.has(day + 1) ? `已完成第${day}天，第${day + 1}天已解锁。` : `第${day}天已完成。下一天尚未制作。`);
  }
  function tick() { if (running) { const now = Date.now(); state.timing[day][phase] += Math.max(0, now - startedAt); startedAt = now; } }
  function pause() { tick(); running = false; save(); renderTimer(); }
  function toggleTimer() { if (running) pause(); else { running = true; startedAt = Date.now(); renderTimer(); } }
  function changePhase(value) { if (!model.PHASES.includes(value)) return; tick(); phase = value; state.ui.phase = value; save(); renderTimer(); }
  function renderTimer() {
    $('timer-display').textContent = $('study-timer-display').textContent = clock(elapsed());
    $('timer-toggle').textContent = running ? '暂停计时' : elapsed() ? '继续计时' : '开始计时';
    $('study-timer-toggle').textContent = running ? '暂停' : elapsed() ? '继续' : '开始';
    for (const id of ['phase-select', 'study-phase-select']) if ($(id).value !== phase) $(id).value = phase;
    $('phase-times').innerHTML = Object.entries(phases).map(([key, label]) => `<span>${label} ${clock(state.timing[day][key])}</span>`).join('');
  }
  function readingAnchor() {
    const el = [...document.querySelectorAll('.hero, #day-content section[data-phase]:not(.lesson-main):not(.lesson-practice), #day-content .topic')].find(node => node.getBoundingClientRect().bottom > 110);
    return el ? { el, top: el.getBoundingClientRect().top } : null;
  }
  function restoreAnchor(anchor) { if (anchor) requestAnimationFrame(() => { if (anchor.el.isConnected) window.scrollBy(0, anchor.el.getBoundingClientRect().top - anchor.top); }); }
  function studyUI() {
    const lesson = view === 'lesson';
    document.body.classList.toggle('study-mode', lesson && state.ui.studyMode);
    document.body.classList.toggle('notes-open', lesson && notesOpen);
    $('study-toolbar').hidden = !(lesson && state.ui.studyMode);
    $('topic-notes').hidden = !(lesson && notesOpen);
    $('notes-backdrop').hidden = !(lesson && notesOpen);
    $('study-mode-toggle').disabled = !lesson;
    $('study-mode-toggle').setAttribute('aria-pressed', String(state.ui.studyMode));
    $('notes-toggle').setAttribute('aria-expanded', String(notesOpen));
    $('study-day-label').textContent = `第${day}天`;
    document.querySelectorAll('[data-note]').forEach(button => button.setAttribute('aria-expanded', String(notesOpen && button.dataset.note === selectedTopic)));
  }
  function setStudyMode(enabled) { const anchor = readingAnchor(); state.ui.studyMode = enabled; if (!enabled) notesOpen = false; save(); studyUI(); restoreAnchor(anchor); }
  function visibleTopic() { return [...document.querySelectorAll('#day-content .topic')].find(el => { const r = el.getBoundingClientRect(); return r.bottom > 120 && r.top < innerHeight; })?.id || selectedTopic || topics()[0].id; }
  function notes() {
    if (!topics().some(topic => topic.id === selectedTopic)) selectedTopic = topics()[0].id;
    $('notes-topic-select').innerHTML = topics().map((topic, i) => `<option value="${topic.id}">${String(i + 1).padStart(2, '0')} · ${esc(topic.title)}</option>`).join('');
    $('notes-topic-select').value = selectedTopic;
    $('topic-note-editor').value = state.fields[noteKey(selectedTopic)] || '';
    $('topic-note-status').textContent = persistent ? state.fields[noteKey(selectedTopic)] ? '已保存到此浏览器' : '输入后自动保存' : '保存失败，请复制备份';
    state.ui.noteTopic = selectedTopic;
  }
  function openNotes(id, trigger) { const anchor = readingAnchor(); selectedTopic = topics().some(topic => topic.id === id) ? id : visibleTopic(); lastNotesTrigger = trigger; notesOpen = true; notes(); save(); studyUI(); restoreAnchor(anchor); $('topic-note-editor').focus({ preventScroll: true }); }
  function closeNotes() { const anchor = readingAnchor(); notesOpen = false; studyUI(); restoreAnchor(anchor); if (lastNotesTrigger?.isConnected) lastNotesTrigger.focus({ preventScroll: true }); }
  async function copyNote() {
    const text = $('topic-note-editor').value;
    if (!text.trim()) { $('topic-note-status').textContent = '先写下这条笔记'; return; }
    try { await navigator.clipboard.writeText(`第${day}天 · ${topics().find(t => t.id === selectedTopic).title}\n\n${text}`); $('topic-note-status').textContent = '笔记已复制'; }
    catch { $('topic-note-editor').focus(); $('topic-note-editor').select(); $('topic-note-status').textContent = '已选中文字，请手动复制'; }
  }
  function topicText(id) {
    const el = document.getElementById(id)?.cloneNode(true);
    if (!el) return '';
    el.querySelectorAll('button,.rating-group,.topic-source-links,[data-example],[data-sql-practice],input,textarea,select').forEach(node => node.remove());
    return [el.textContent.replace(/\s+/g, ' ').trim(),window.CourseDiagrams.textFor(id),window.CourseSQL.textFor(id)].filter(Boolean).join('\n\n');
  }
  function feedbackText() {
    const topic = topics().find(item => item.id === feedbackTopic);
    const ids = topic ? topic.sources : dayInfo().ids;
    const sections = topic ? [topic] : topics();
    return [`课程：${course.title} v${course.version}`, `位置：第${day}天 · ${topic?.title || dayInfo().title}`, `我的问题：${$('feedback-note').value.trim()}`, '关联网站知识点：', ...ids.map(id => `#${id} ${course.questions[id].label} ${course.questions[id].url}`), ...sections.flatMap(section => [`知识点：${section.title}\n${topicText(section.id)}`, `我的笔记：${state.fields[noteKey(section.id)] || '（未写）'}`]), '请先用适合初学者的解释和例子讲清，再用一道小问题检查我的理解；需要修改课件时，先提出具体建议。'].join('\n\n');
  }
  function openFeedback(id) {
    feedbackTopic = id;
    const topic = topics().find(item => item.id === id);
    $('feedback-context').textContent = `第${day}天 · ${topic?.title || dayInfo().title}`;
    $('feedback-note').value = state.fields['feedback-draft'] || '';
    $('feedback-error').hidden = true; $('feedback-status').textContent = ''; $('feedback-preview').open = false;
    $('feedback-output').value = feedbackText(); $('feedback-dialog').showModal(); $('feedback-note').focus();
  }
  async function copyFeedback() {
    if (!$('feedback-note').value.trim()) { $('feedback-error').hidden = false; $('feedback-note').focus(); return; }
    $('feedback-output').value = feedbackText();
    try { await navigator.clipboard.writeText($('feedback-output').value); $('feedback-status').textContent = '已复制，粘贴到聊天中发送即可。'; }
    catch { $('feedback-preview').open = true; $('feedback-output').focus(); $('feedback-output').select(); $('feedback-status').textContent = '已选中文字，请手动复制到聊天中。'; }
  }
  let exportURL;
  function download(text, filename, type) {
    if (exportURL) URL.revokeObjectURL(exportURL);
    exportURL = URL.createObjectURL(new Blob([text], { type }));
    $('export-download').href = exportURL; $('export-download').download = filename;
    $('export-filename').textContent = filename; $('export-output').value = text;
    $('export-status').textContent = ''; $('export-dialog').showModal();
  }
  async function copyExport() {
    try { await navigator.clipboard.writeText($('export-output').value); $('export-status').textContent = '完整内容已复制。'; }
    catch { $('export-output').focus(); $('export-output').select(); $('export-status').textContent = '已选中完整内容，请手动复制。'; }
  }
  $('export-dialog').addEventListener('close', () => { if (exportURL) URL.revokeObjectURL(exportURL); exportURL = null; $('export-download').removeAttribute('href'); });
  function exportRecord() { tick(); save(); download(JSON.stringify({ ...state, courseVersion: course.version, exportedAt: new Date().toISOString() }, null, 2), `mysql-course-${mode}.json`, 'application/json'); }
  function exportHandoff() {
    const lines = [`# ${course.title}：第${day}天`, `版本 ${course.version}；${dayInfo().title}`, '请作为零基础MySQL与SQL导师，基于下面的课件继续答疑。先解释疑问，再提出是否更新课件。不要因我阅读过内容就认定已掌握。', '## 网站知识点', ...dayInfo().ids.map(id => `- #${id} ${course.questions[id].label}：${course.questions[id].url}`), '## 本课知识'];
    for (const topic of topics()) lines.push(`### ${topic.title}`, topicText(topic.id), `我的笔记：${state.fields[noteKey(topic.id)] || '（未写）'}`);
    lines.push('## 我的作答');
    document.querySelectorAll('[data-quiz]').forEach(el => {
      const prompt = el.cloneNode(true);
      prompt.querySelectorAll('details,.quiz-input,.quiz-rating').forEach(node => node.remove());
      lines.push(prompt.textContent.replace(/\s+/g, ' ').trim(), state.fields[`${el.dataset.quiz}-answer`] || '（未作答）');
    });
    download(lines.join('\n\n'), `mysql-course-day-${day}-handoff.md`, 'text/markdown;charset=utf-8');
  }
  document.addEventListener('click', event => {
    const target = event.target.closest('button,a[data-view]'); if (!target) return;
    if (target.dataset.view) { event.preventDefault(); showView(target.dataset.view); window.scrollTo(0, 0); }
    if (target.dataset.day) openDay(Number(target.dataset.day));
    if (target.dataset.note) openNotes(target.dataset.note, target);
    if (target.dataset.feedback) openFeedback(target.dataset.feedback);
    if (target.dataset.rate) { state.ratings[target.dataset.rate] = target.dataset.value; document.querySelectorAll(`[data-rate="${target.dataset.rate}"]`).forEach(el => el.setAttribute('aria-pressed', String(el.dataset.value === target.dataset.value))); save(); summary(); }
    const actions = { 'timer-toggle': toggleTimer, 'study-timer-toggle': toggleTimer, 'study-mode-toggle': () => setStudyMode(true), 'study-mode-exit': () => setStudyMode(false), 'notes-toggle': () => notesOpen ? closeNotes() : openNotes(visibleTopic(), target), 'notes-close': closeNotes, 'notes-backdrop': closeNotes, 'copy-topic-note': copyNote, 'feedback-open': () => openFeedback(visibleTopic()), 'copy-feedback': copyFeedback, 'mark-complete': markComplete, 'export-data': exportRecord, 'export-handoff': exportHandoff, 'copy-export': copyExport, 'print-page': () => window.print() };
    actions[target.id]?.();
  });
  document.addEventListener('input', event => { const el = event.target; if (el.dataset.save) { state.fields[el.dataset.save] = el.type === 'checkbox' ? el.checked : el.value; save(); } });
  document.addEventListener('change', event => { const el = event.target; if (el.dataset.save) { state.fields[el.dataset.save] = el.type === 'checkbox' ? el.checked : el.value; save(); } });
  for (const id of ['phase-select', 'study-phase-select']) $(id).addEventListener('change', event => changePhase(event.target.value));
  $('notes-topic-select').addEventListener('change', event => { selectedTopic = event.target.value; notes(); save(); studyUI(); });
  $('topic-note-editor').addEventListener('input', () => { state.fields[noteKey(selectedTopic)] = $('topic-note-editor').value; save(); $('topic-note-status').textContent = persistent ? '已保存到此浏览器' : '保存失败，请复制备份'; });
  $('feedback-note').addEventListener('input', () => { state.fields['feedback-draft'] = $('feedback-note').value; save(); $('feedback-error').hidden = true; $('feedback-status').textContent = ''; $('feedback-output').value = feedbackText(); });
  document.addEventListener('keydown', event => { if (event.key !== 'Escape' || $('feedback-dialog').open || $('export-dialog').open) return; if (notesOpen) closeNotes(); else if (state.ui.studyMode) setStudyMode(false); });
  $('import-data').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 32 * 1024 * 1024) throw Error('记录超过32MiB，无法导入。');
      const imported = model.normalize(JSON.parse(await file.text()), catalog, mode);
      if (!templates.has(imported.day)) imported.day = course.published_days[0];
      if (!window.confirm('导入会替换此浏览器中的当前记录。继续吗？')) return;
      pause(); state = imported; phase = state.ui.phase; selectedTopic = state.ui.noteTopic; notesOpen = false; save(); roadmap(); openDay(state.day); toast('记录已恢复，计时保持暂停。');
    } catch (error) { toast(`未导入：${error.message}`); }
    finally { event.target.value = ''; }
  });
  document.addEventListener('visibilitychange', () => { tick(); save(); renderTimer(); });
  window.addEventListener('beforeunload', pause);
  window.addEventListener('pagehide', pause);
  let ticks = 0; setInterval(() => { if (running) { tick(); renderTimer(); if (++ticks % 10 === 0) save(); } }, 1000);
  document.body.classList.toggle('review-mode', review);
  $('review-banner').hidden = !review; $('review-return').hidden = !review || course.default_mode === 'review';
  $('version').textContent = course.version;
  roadmap(); guide(); openDay(day, false);
})();
