"""Validate small authored scenarios and insert their shared interaction controls."""
from html import escape
import re


def validate_examples(examples, topic_ids):
    assert set(examples) == {id for id in topic_ids if not re.fullmatch(r'd\d+-sql', id)}, 'Each theory topic needs its own scenario'
    for topic_id, example in examples.items():
        assert all(example.get(k) for k in ('title', 'intro', 'limit', 'references')), topic_id
        if example.get('kind') in ('lab', 'static'):
            if example['kind'] == 'lab':
                assert example['model'] in ('cache','path','cover','prefix','plan','read','versions','recovery','range','deadlock','join','diagnose','shard','transfer','acid'), topic_id
            else:
                assert 1 <= len(example['cards']) <= 3, topic_id
                for card in example['cards']:
                    assert card['title'] and card['text'], topic_id
                    if 'diagram' in card:
                        diagram=card['diagram']
                        assert diagram['kind']=='graph' and 100 <= diagram['width'] <= 900 and 100 <= diagram['height'] <= 600, topic_id
                        assert 1 <= len(diagram['nodes']) <= 12 and len(diagram['edges']) <= 16, topic_id
                        nodes={n['id'] for n in diagram['nodes']}
                        assert len(nodes)==len(diagram['nodes']), topic_id
                        for n in diagram['nodes']:
                            assert n['title'] and n['width'] > 0 and n['height'] > 0 and 0 <= n['x'] <= diagram['width']-n['width'] and 0 <= n['y'] <= diagram['height']-n['height'], topic_id
                        for e in diagram['edges']:
                            assert e['from'] in nodes and e['to'] in nodes, topic_id
                    if 'table' in card:
                        data=card['table']
                        assert len(data['rows']) <= 6 and 1 <= len(data['columns']) <= 4, topic_id
                        assert all(len(row)==len(data['columns']) for row in data['rows']), topic_id
            continue
        if example.get('kind') in ('transfer', 'reason'):
            assert topic_id.startswith('d7-'), 'Reasoning pilot is scoped to day seven'
            if example['kind'] == 'reason':
                assert 2 <= len(example['items']) <= 3
                for item in example['items']:
                    assert all(item.get(k) for k in ('label', 'scene', 'prompt', 'result', 'why')), topic_id
                    choices = item.get('choices', example.get('choices', []))
                    assert 2 <= len(choices) <= 3 and 0 <= item['answer'] < len(choices)
                    if 'misconceptions' in item:
                        assert len(item['misconceptions']) == len(choices)
            continue
        assert len(example['cases']) == 2, topic_id
        for case in example['cases']:
            assert case['label'] and case['assumption'] and 3 <= len(case['steps']) <= 5, topic_id
            for step in case['steps']:
                config = step.get('diagram', case.get('diagram', example['diagram']))
                assert config['kind'] in ('tables', 'documents', 'text', 'tree'), topic_id
                valid_rows = set()
                valid_columns = set()
                for table in config.get('tables', []):
                    assert 0 <= len(table['rows']) <= 6 and 1 <= len(table['columns']) <= 4
                    assert all(len(row) == len(table['columns']) for row in table['rows'])
                    valid_rows |= {f"{table['name']}:{i}" for i in range(len(table['rows']))}
                    valid_columns |= {f"{table['name']}.{c}" for c in table['columns']}
                assert step['title'] and step['text'], topic_id
                if config['kind'] in ('tables', 'documents'):
                    assert set(step.get('rows', [])) <= valid_rows
                    assert set(step.get('columns', [])) <= valid_columns
                elif 'value' in step:
                    assert len(step['value']) <= 4
                if config['kind'] == 'tree':
                    assert 1 <= len(config['levels']) <= 4
                    assert all(1 <= len(level) <= 4 for level in config['levels'])


def figure(topic_id, example):
    if example.get('kind') in ('lab', 'static'):
        refs = ''.join(f'<li><a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(url.removeprefix("https://"))}</a></li>' for url in example['references'])
        return f'''<figure class="guided-example learning-example" id="example-{topic_id}" data-example="{topic_id}">
<div class="ex-heading"><h4>{escape(example['title'])}</h4></div><p class="ex-intro">{escape(example['intro'])}</p>
<div class="learning-surface"></div><figcaption><details><summary>演示条件与参考</summary><p>{escape(example['limit'])}</p><ul>{refs}</ul></details></figcaption></figure>'''
    if example.get('kind') in ('transfer', 'reason'):
        refs = ''.join(f'<li><a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(url.removeprefix("https://"))}</a></li>' for url in example['references'])
        return f'''<figure class="guided-example reasoning-example" id="example-{topic_id}" data-example="{topic_id}">
<div class="ex-heading"><h4>{escape(example['title'])}</h4></div>
<p class="ex-intro">{escape(example['intro'])}</p>
<div class="reasoning-surface"></div>
<figcaption><details><summary>演示条件与参考</summary><p>{escape(example['limit'])}</p><ul>{refs}</ul></details></figcaption>
</figure>'''
    buttons = ''.join(f'<button type="button" data-example-case="{i}" aria-pressed="{str(i == 0).lower()}">{escape(c["label"])}</button>' for i, c in enumerate(example['cases']))
    refs = ''.join(f'<li><a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{escape(url.removeprefix("https://"))}</a></li>' for url in example['references'])
    first = example['cases'][0]
    return f'''<figure class="guided-example" id="example-{topic_id}" data-example="{topic_id}">
<div class="ex-heading"><h4>{escape(example['title'])}</h4><span class="ex-count">1 / {len(first['steps'])}</span></div>
<p class="ex-intro">{escape(example['intro'])}</p>
<div class="ex-case-controls" aria-label="选择示例情形">{buttons}</div>
<p class="ex-assumption">{escape(first['assumption'])}</p>
<div class="ex-controls"><button type="button" data-example-previous disabled>上一步</button><button type="button" class="primary" data-example-next>下一步</button><button type="button" data-example-reset>重新演示</button></div>
<div class="ex-canvas" tabindex="0" aria-label="小数据机制示意，可横向滚动"></div>
<div class="ex-explanation" aria-live="polite" aria-atomic="true"><strong class="ex-step-title">{escape(first['steps'][0]['title'])}</strong><p class="ex-step-text">{escape(first['steps'][0]['text'])}</p></div>
<details class="ex-transcript"><summary>展开本例全部步骤</summary><ol class="ex-all-steps"></ol></details>
<figcaption><details><summary>图示条件与参考</summary><p>{escape(example['limit'])}</p><ul>{refs}</ul></details></figcaption>
</figure>'''


def enrich(html, examples):
    for topic_id, example in examples.items():
        marker = f'<!-- EXAMPLE:{topic_id} -->'
        if marker not in html:
            continue
        assert html.count(marker) == 1, (topic_id, 'Need one authored position after prerequisites')
        html = html.replace(marker, figure(topic_id, example))
    assert '<!-- EXAMPLE:' not in html
    return html
