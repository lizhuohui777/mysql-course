"""Render days 3-12; days 1-2 are maintained directly in their lesson files."""
import argparse
import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MYSQL = 'https://dev.mysql.com/doc/refman/8.4/en/'
W3 = 'https://www.w3schools.com/mysql/'
INTROS = {
    'layers':'读与写都需要服务层和引擎协作，但返回的结果不同。',
    'execution':'列名能否解析，决定请求能否进入正常计划与执行。',
    'engines':'订单写入失败时，是否具备事务撤销能力会改变最后库存。',
    'pages':'同一数据页已经在内存时，可以复用其中的其他记录。',
    'purpose':'同样找id=8，扫描与按范围导航经过的记录不同。',
    'bplus':'等值访问只找目标，范围访问还要沿叶子继续取后续项。',
    'alternatives':'散列桶可以定位等值键，却不保留键值的大小顺序。',
    'fanout':'同样八个键，分叉能力会影响所需层级。',
    'clustered':'索引给出的主键值与记录位置，对应不同的取行路径。',
    'covering':'多选一列stock，就可能让原本足够的索引项不再够用。',
    'primary':'新键的插入位置与目标页剩余空间，共同影响维护工作。',
    'names':'约束用途、列数与本次查询覆盖可以同时描述一个索引。',
    'prefix':'先按name分组的序列，不会同时按price独立全局排序。',
    'conditions':'已知字符串开头与开头未知，提供的范围定位信息不同。',
    'cost':'需要一行与需要大部分行，读取收益和回表代价不同。',
    'plan':'索引存在只是候选，key表示计划最终选了什么。',
    'unit':'转账只有一起扣款、加款成功，才算完成一次业务。',
    'acid':'两步完整提交，也可能因金额写错而违反总额规则。',
    'boundary':'相同UPDATE，在COMMIT前后拥有不同的撤销边界。',
    'failures':'写回旧值计算结果，与协调后原地递减，不是相同更新过程。',
    'concurrent':'读取他人未提交值，可能依赖一个随后被撤销的结果。',
    'repeat':'一行的值变化与条件匹配集合变化，关注点不同。',
    'levels':'同一事务两次普通读取，是否换新快照影响可见结果。',
    'readtypes':'旧快照中的库存，不等于锁定后准备修改的当前库存。',
    'undo':'同一历史信息可用于撤销，也可用于构建旧快照版本。',
    'redo':'提交确认与全部数据页写回，不必发生在同一时刻。',
    'mvcc':'视图建立时的活跃状态，比事后一句“已经提交”更具体。',
    'consistency':'影响一行与影响零行，都可能没有语法错误，但业务结果不同。',
    'locks':'请求的锁是否冲突，要同时看资源与锁模式。',
    'ranges':'已有记录与两个键之间的空隙，是不同保护对象。',
    'optimistic':'冲突可以提前等待，也可以在更新时由版本条件检出。',
    'deadlock':'相反访问顺序可能形成等待环，统一顺序可避免本例的环。',
    'joins':'相同输入，保留匹配行与保留全部左行产生不同结果。',
    'self':'同表的两个角色需要配对条件；全组合则保留每一种搭配。',
    'views':'筛选视图仍依赖基表；聚合结果未必能映射为一次行更新。',
    'cursor':'求一个合计与控制逐行处理，是两种不同需求。',
    'diagnose':'检查很多行与等待一把锁，虽然都慢，处理位置不同。',
    'vertical':'把低频长字段另存，会改变常用行宽度和完整读取路径。',
    'horizontal':'查询带不带分片键，会改变需要访问多少个分片。',
    'scaling':'副本与缓存减少部分主库读取，也增加同步与失效责任。',
}


def table(name, columns, rows):
    return {'kind': 'tables', 'tables': [{'name': name, 'columns': columns.split('|'), 'rows': rows}]}


def tree(*levels):
    return {'kind': 'tree', 'levels': list(levels)}


def case(label, assumption, *steps):
    return {'label': label, 'assumption': assumption, 'steps': [
        {'title': title, 'text': text, 'diagram': diagram, **focus}
        for title, text, diagram, focus in steps
    ]}


def step(title, text, diagram, **focus):
    return (title, text, diagram, focus)


def topic(slug, title, ids, body, cases, ref, limit):
    return {'slug': slug, 'title': title, 'ids': ids.split(',') if ids else [],
            'body': body, 'cases': cases, 'ref': MYSQL + ref, 'limit': limit}


def lesson_html(day, course):
    n = day['day']
    goals = ''.join(f'<li>{escape(g)}</li>' for g in day['questions'])
    warm = ''.join(f'<div><strong>{escape(w)}</strong><select data-save="d{n}-warm-{i}" aria-label="{escape(w)}的熟悉程度"><option value="">请选择</option><option>需要重看</option><option>记得部分</option><option>能举例解释</option></select></div>' for i,w in enumerate(day['warm']))
    articles = []
    for i,t in enumerate(day['topics'],1):
        id = f'd{n}-{t["slug"]}'
        body = t['body'].replace('<!-- FIGURE -->', f'<!-- EXAMPLE:{id} -->')
        assert f'<!-- EXAMPLE:{id} -->' in body
        articles.append(f'''<article class="topic" id="{id}" data-topic="{escape(t['title'])}" data-sources="{','.join(t['ids'])}" data-references="{t['ref']}">
<div class="topic-heading"><span class="topic-number">{i:02}</span><h3>{escape(t['title'])}</h3><button class="topic-note-button" data-note="{id}" aria-controls="topic-notes">笔记</button></div><div class="topic-source-links" data-topic-sources></div>
{body}
<div class="topic-actions"><div class="rating-group" data-topic-rating="{id}"></div><button class="text-button" data-feedback="{id}">这里还没懂</button></div></article>''')
    quizzes = ''.join(f'<article class="question" data-quiz="d{n}-q{i}"><h3>{i} / {escape(q)}</h3><div class="quiz-input"></div><details><summary>查看参考答案</summary><div class="answer"><p>{escape(a)}</p></div></details><div class="quiz-rating"></div></article>' for i,(q,a) in enumerate(day['quiz'],1))
    exits = ''.join(f'<label><input type="checkbox" data-save="d{n}-exit-{i}">{escape(g)}</label>' for i,g in enumerate(day['exits'],1))
    refs = '|'.join(day['sql_refs'])
    sql_ids = ','.join(day.get('sql_ids', []))
    return f'''<section class="card lesson-goals"><h2>本课的三个问题</h2><ol class="objectives">{goals}</ol><div class="day-source-links" data-day-sources></div></section>
<section class="lesson-section" id="d{n}-warmup" data-phase="recall"><div class="section-heading"><h2><span class="section-number">01</span>回忆检查</h2></div><p>不查正文，回想前面学过的概念。</p><div class="warmup-grid">{warm}</div><label class="inline-label" for="d{n}-warm-answer">{escape(day['warm_question'])}</label><textarea id="d{n}-warm-answer" data-save="d{n}-warm-answer" rows="3" maxlength="20000" placeholder="写一句自己的解释。"></textarea></section>
<section class="lesson-section lesson-main" id="d{n}-main" data-phase="main"><div class="section-heading"><h2><span class="section-number">02</span>今日主线</h2></div>{('<p class="main-connection">'+escape(day['main_intro'])+'</p>') if day.get('main_intro') else ''}{''.join(articles)}</section>
<section class="lesson-section lesson-practice" id="d{n}-practice" data-phase="sql"><div class="section-heading"><h2><span class="section-number">03</span>SQL短练习</h2></div><article class="topic" id="d{n}-sql" data-topic="{escape(course['sql'])}" data-sources="{sql_ids}" data-references="{refs}"><div class="topic-heading"><h3>{escape(day['sql_title'])}</h3><button class="topic-note-button" data-note="d{n}-sql" aria-controls="topic-notes">笔记</button></div><div class="topic-source-links" data-topic-sources></div><div class="sql-syntax">{day['sql_body']}</div><div class="callout"><strong>SQLite离线练习，不是MySQL机制实验。</strong><p>{escape(day.get('sql_limit', '这里只练通用SQL语法。每次恢复下方小数据，各题互不影响；语句执行成功不代表已理解全部原理。'))}</p></div><!-- SQL_PRACTICE:{n} --><div class="topic-actions"><div class="rating-group" data-topic-rating="d{n}-sql"></div><button class="text-button" data-feedback="d{n}-sql">这里还没懂</button></div></article></section>
<section class="lesson-section" id="d{n}-quiz" data-phase="quiz"><div class="section-heading"><h2><span class="section-number">04</span>理解自测</h2></div><p>用自己的话回答，再对照参考解释。</p>{quizzes}<p id="quiz-summary" class="notice" hidden></p></section>
<section class="lesson-section" id="d{n}-close" data-phase="close"><div class="section-heading"><h2><span class="section-number">05</span>收尾记录</h2></div><p>不看正文，检查自己能否解释这三件事。</p><div class="checklist">{exits}</div><label class="inline-label" for="d{n}-exit-note">今天最清楚的一点，以及仍卡住的一点</label><textarea id="d{n}-exit-note" data-save="d{n}-exit-note" rows="3" maxlength="20000" placeholder="各写一句即可。"></textarea><div class="close-actions"><button id="mark-complete" class="primary">标记本日完成</button><button data-feedback="d{n}-close">整理本日反馈</button><div id="next-lesson"></div></div><p id="completion-note" class="completion-note"></p></section>
<details class="source-map lesson-sources"><summary>网站知识点与参考资料</summary><div data-day-references></div><p>原理补充与版本纠偏见各知识点的参考链接；SQL语法来自W3Schools。</p></details>
'''


def render(check=False):
    from content_index import DAYS
    from content_transactions import MORE_DAYS
    from content_relations import LAST_DAYS
    from content_sql import fixtures
    from content_refinement import refine
    days = refine(DAYS + MORE_DAYS + LAST_DAYS)
    assert [d['day'] for d in days] == list(range(3,13))
    course = json.loads((ROOT / 'curriculum.json').read_text())
    examples = json.loads((ROOT / 'interactive-examples.json').read_text())
    examples = {k:v for k,v in examples.items() if k.startswith(('d1-', 'd2-'))}
    sql = json.loads((ROOT / 'sql-exercises.json').read_text())
    sql['days'] = {k:v for k,v in sql['days'].items() if k in ('1','2')}
    sql['fixtures'] = {}
    outputs = {}
    for day in days:
        n = day['day']
        assert len(day['quiz']) == 5 and len(day['exits']) == len(day['questions']) == 3
        outputs[f'lessons/lesson-{n:02}.html'] = lesson_html(day, course['days'][n-1])
        for t in day['topics']:
            if 'interaction' in t:
                examples[f'd{n}-{t["slug"]}'] = {**t['interaction'], 'limit': t['limit'], 'references': [t['ref']]}
            else:
                examples[f'd{n}-{t["slug"]}'] = {'title': t.get('example_title', t['cases'][0]['label'] + ' / ' + t['cases'][1]['label']), 'intro': t.get('intro', INTROS[t['slug']]), 'limit': t['limit'], 'references': [t['ref']], 'diagram': t['cases'][0]['steps'][0]['diagram'], 'cases': t['cases']}
        data, exercises = fixtures(n)
        sql['fixtures'][str(n)] = data
        sql['days'][str(n)] = exercises
    course['version'] = '0.4.1-dev'
    course['published_days'] = list(range(1,13))
    course['source_note'] = '主站三页正文编号1–55；重复主题合并教学。12天完整课件已制作，当前为本地开发检查版。'
    for day in course['days']:
        day['status'] = 'ready'
    for file, data in [('curriculum.json',course),('interactive-examples.json',examples),('sql-exercises.json',sql)]:
        outputs[file] = json.dumps(data,ensure_ascii=False,indent=2) + '\n'
    for file, text in outputs.items():
        path = ROOT / file
        if check:
            assert path.read_text() == text, file + ' needs authoring rebuild'
        else:
            path.write_text(text)
    print('Authored days 3-12: 40 theory topics, 40 SQL exercises; days 1-2 use their authoritative lesson files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    render(parser.parse_args().check)
