"""Validate the approved roadmap and build offline, self-contained pilot pages."""
import argparse
import base64
import json
import re
from collections import Counter
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from lesson_examples import enrich, validate_examples

ROOT = Path(__file__).resolve().parent


class Inspector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids, self.topics, self.quizzes, self.exits, self.phases, self.forbidden = [], [], [], [], [], []
        self.figures = 0
        self.related_sources = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.append(attrs['id'])
        if 'data-topic' in attrs:
            self.topics.append((attrs['id'], [s.strip() for s in attrs.get('data-sources', '').split(',') if s.strip()]))
            self.related_sources.extend(s.strip() for s in attrs.get('data-related-sources', '').split(',') if s.strip())
        if 'data-quiz' in attrs:
            self.quizzes.append(attrs['data-quiz'])
        if tag == 'input' and attrs.get('type') == 'checkbox' and 'data-save' in attrs:
            self.exits.append(attrs['data-save'])
        if 'data-phase' in attrs:
            self.phases.append(attrs['data-phase'])
        if tag == 'figure':
            self.figures += 1
        if tag in ('script', 'iframe'):
            self.forbidden.append(tag)


def sql_practice(data, day):
    entries = data['days'][str(day)]
    assert 3 <= len(entries) <= 4
    tables = data.get('fixtures', {}).get(str(day), {}).get('tables', [data['table']])
    assert all(len(t['rows']) <= 4 and len(t['columns']) <= 4 for t in tables)
    instructions = ('每次运行都恢复这份初始数据，各题互不影响。增删改显示操作后的整张表，并检查其他记录是否保持不变。不要求照抄答案。'
                    if any(e.get('operation', 'SELECT') != 'SELECT' for e in entries)
                    else '每次运行都使用这份初始数据。只比较题目要求的结果，不要求照抄答案。排序题检查所要求的顺序；未要求排序的题目允许行顺序不同。')
    seed_tables = []
    for table in tables:
        headers = ''.join(f'<th scope="col">{escape(c)}</th>' for c in table['columns'])
        rows = ''.join('<tr>' + ''.join(f'<td>{"NULL" if v is None else escape(str(v))}</td>' for v in row) + '</tr>' for row in table['rows'])
        seed_tables.append(f'<div class="sql-data-heading"><h4>练习数据：{escape(table["name"])}</h4><span class="chip">{len(table["rows"])}行 · {len(table["columns"])}列</span></div><div class="table-wrap sql-seed"><table class="data-table"><thead><tr>{headers}</tr></thead><tbody>{rows}</tbody></table></div>')
    tabs = ''.join(f'<button type="button" data-sql-tab="{i}" aria-pressed="{str(i == 0).lower()}">第{i + 1}题</button>' for i in range(len(entries)))
    panels = []
    for i, entry in enumerate(entries):
        operation = entry.get('operation', 'SELECT')
        assert operation in ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'COMMIT', 'ROLLBACK')
        assert entry['id'].startswith(f'd{day}-sql-') and entry['answer'].startswith(operation)
        if operation != 'SELECT':
            assert entry['check'].startswith('SELECT ')
            if operation not in ('COMMIT', 'ROLLBACK'):
                assert entry['affected'] >= 1
        scaffold = ''
        if entry.get('setup') or entry.get('after'):
            scaffold = '<div class="callout"><strong>本题已准备的事务</strong>'
            if entry.get('setup'):
                scaffold += f'<p>运行你的语句前：</p><pre><code>{escape(entry["setup"])}</code></pre>'
            if entry.get('after'):
                scaffold += f'<p>运行你的语句后自动执行：</p><pre><code>{escape(entry["after"])}</code></pre>'
            scaffold += '<p>每题使用独立数据库；只需在下方补一条语句。</p></div>'
        panels.append(f'''<section class="sql-panel" data-sql-panel="{i}" {'hidden' if i else ''}>
<h4>{i + 1} / {escape(entry['prompt'])}</h4>
{scaffold}
<label class="inline-label" for="{entry['id']}">我的SQL</label>
<textarea id="{entry['id']}" data-save="{entry['id']}" rows="3" maxlength="20000" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="写一条{operation}语句…"></textarea>
<div class="sql-actions"><button type="button" class="primary" data-sql-run disabled>运行SQL</button><button type="button" data-sql-reset>重置这题</button>{'<button type="button" data-sql-next>下一题</button>' if i < len(entries) - 1 else ''}</div>
<p class="sql-status" role="status" aria-live="polite" data-sql-status></p>
<div class="sql-result" data-sql-result></div>
<div class="sql-help"><details><summary>一点提示</summary><p>{escape(entry['hint'])}</p></details><details><summary>查看参考答案</summary><pre><code>{escape(entry['answer'])}</code></pre></details></div>
</section>''')
    return f'''<div class="sql-practice" data-sql-practice="{day}">
{''.join(seed_tables)}
<p class="micro">{instructions}</p>
<div class="sql-engine"><span data-engine-status>正在准备离线SQL练习…</span><button class="text-button" type="button" data-sql-retry>重试引擎</button></div>
<div class="sql-tabs" aria-label="选择短题">{tabs}</div>
{''.join(panels)}
</div>'''


def validate(course, examples, sql):
    assert course['id'] == 'mysql-foundations-12' and course['default_mode'] in ('study', 'review')
    assert [d['day'] for d in course['days']] == list(range(1, 13))
    mapped = [qid for day in course['days'] for qid in day['ids']]
    assert len(mapped) == len(set(mapped)) == 55
    assert set(mapped) == set(course['questions']) == set(map(str, range(1, 56)))
    ready = [d['day'] for d in course['days'] if d['status'] == 'ready']
    assert ready == course['published_days'] and ready
    assert set(sql['days']) == set(map(str, ready))
    for question in course['questions'].values():
        assert question['label'] and question['url'].startswith('https://interviewguide.cn/') and '#_' in question['url']
    templates, topics = [], []
    for day in course['days']:
        assert len(day['goals']) == 3 and day['budget'] == [3, 45, 15, 12] and sum(day['budget']) == 75 and day['main_budget'] == {'theory': 45, 'sql': 15}
        if day['day'] not in ready:
            assert not (ROOT / 'lessons' / f"lesson-{day['day']:02}.html").exists(), 'Unwritten days must not masquerade as lessons'
            continue
        n = day['day']
        html = (ROOT / 'lessons' / f'lesson-{n:02}.html').read_text(encoding='utf-8')
        html = enrich(html, examples)
        marker = f'<!-- SQL_PRACTICE:{n} -->'
        assert html.count(marker) == 1
        html = html.replace(marker, sql_practice(sql, n))
        parser = Inspector()
        parser.feed(html)
        assert not parser.forbidden and not [k for k, count in Counter(parser.ids).items() if count > 1]
        assert parser.phases == ['recall', 'main', 'sql', 'quiz', 'close']
        assert len(parser.topics) >= 4 and len(parser.quizzes) == 5 and len(parser.exits) == 3 and parser.figures >= 4
        ids = [qid for _, qids in parser.topics for qid in qids]
        assert len(ids) == len(set(ids)) and set(ids) == set(day['ids'])
        assert set(parser.related_sources) <= set(day['ids'])
        assert all(topic.startswith(f'd{n}-') for topic, _ in parser.topics)
        assert html.count('data-topic-sources') == len(parser.topics) and 'data-day-sources' in html
        assert len(re.findall(r'[\u4e00-\u9fff]', re.sub(r'<[^>]*>', '', html))) >= 1800, 'Pilot needs substantive teaching, not outlines'
        topics.extend(topic for topic, _ in parser.topics)
        templates.append(f'<template id="lesson-{n:02}" data-day="{n}">\n{html}\n</template>')
    assert len(topics) == len(set(topics))
    validate_examples(examples, topics)
    return '\n'.join(templates)


def script(text):
    return re.sub(r'</script', r'<\\/script', text, flags=re.I)


def assemble(course, lessons, mode, examples, sql):
    html = (ROOT / 'template.html').read_text(encoding='utf-8')
    for block in ('REDIRECT', 'NOTICE'):
        html = re.sub(f'[ \t]*<!-- SOURCE_ONLY_{block}_START -->.*?<!-- SOURCE_ONLY_{block}_END -->', '', html, flags=re.S)
    replacements = {
        '/* MODE */': mode,
        '/* STYLES */': (ROOT / 'style.css').read_text(encoding='utf-8'),
        '/* COURSE_DATA */': json.dumps(course, ensure_ascii=False).replace('<', '\\u003c'),
        '<!-- LESSON_TEMPLATES -->': lessons,
        '/* DIAGRAM_DATA */': json.dumps(examples, ensure_ascii=False).replace('<', '\\u003c'),
        '/* SQL_DATA */': json.dumps(sql, ensure_ascii=False).replace('<', '\\u003c'),
        '/* SQLITE_LIBRARY */': script((ROOT / 'vendor/sql-wasm.js').read_text(encoding='utf-8')),
        '/* SQLITE_LICENSE */': script((ROOT / 'vendor/LICENSE').read_text(encoding='utf-8')),
        '/* SQLITE_WASM */': base64.b64encode((ROOT / 'vendor/sql-wasm.wasm').read_bytes()).decode('ascii'),
    }
    for marker, path in [('/* STATE */','state.js'), ('/* LABS */','learning-labs.js'), ('/* DIAGRAMS */','diagrams.js'), ('/* APP */','app.js'), ('/* SQL_UI */','sql-ui.js'), ('/* SQL_CORE */','sql-core.js'), ('/* SQL_WORKER */','sql-worker.js')]:
        replacements[marker] = script((ROOT / path).read_text(encoding='utf-8'))
    for marker, value in replacements.items():
        assert html.count(marker) == 1, marker
        html = html.replace(marker, value)
    assert not re.search(r'<(?:script[^>]*\bsrc|link[^>]*\bhref)\s*=', html, flags=re.I)
    assert 'http-equiv="refresh"' not in html and '<!-- EXAMPLE:' not in html
    return html


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    course, examples, sql = [json.loads((ROOT / file).read_text(encoding='utf-8')) for file in ('curriculum.json', 'interactive-examples.json', 'sql-exercises.json')]
    lessons = validate(course, examples, sql)
    for filename, mode in [('index.html', course['default_mode']), ('review.html','review'), ('study.html','study')]:
        html = assemble(course, lessons, mode, examples, sql)
        path = ROOT / filename
        if args.check:
            assert path.exists() and path.read_text(encoding='utf-8') == html, f'{filename} needs rebuilding'
        else:
            path.write_text(html, encoding='utf-8')
        print(f'{filename}: {len(course["published_days"])} complete lesson, 55 source mappings, {len(html.encode()):,} bytes, offline SQL bundled')


if __name__ == '__main__':
    main()
