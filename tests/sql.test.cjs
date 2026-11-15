const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../sql-core.js');
const fixture = require('../sql-exercises.json');
const root = path.resolve(__dirname, '..');

test('single SELECT guard handles strings, comments and incomplete input', () => {
  for (const sql of ['SELECT * FROM products;', ' -- hi\nSELECT name FROM products; /* end */', "SELECT 'a;b'", 'SELECT "a;b"', 'SELECT [name] FROM products']) {
    assert.equal(core.oneSelect(sql), sql);
  }
  for (const sql of ['', 'DELETE FROM products', 'PRAGMA query_only=OFF', 'SELECT 1; SELECT 2', "SELECT 'oops", 'SELECT 1 /* oops', 'x'.repeat(20001)]) {
    assert.throws(() => core.oneSelect(sql));
  }
});

test('result matching accepts aliases, row/column reordering and retains duplicates', () => {
  const expected = { columns: ['name', 'price'], values: [['water', 3], ['water', 3], ['milk', 8]] };
  assert.equal(core.matches({ columns: ['cost', 'label'], values: [[8, 'milk'], [3, 'water'], [3, 'water']] }, expected), true);
  assert.equal(core.matches({ columns: ['name', 'price'], values: [['water', 3], ['milk', 8]] }, expected), false);
  assert.equal(core.matches({ columns: ['name', 'price'], values: [['water', 3], ['milk', 8], ['milk', 8]] }, expected), false);
  assert.equal(core.matches({ ...expected, truncated: true }, expected), false);
  assert.equal(core.matches({ columns: ['x'], values: [] }, { columns: ['name'], values: [] }), true);
});

test('offline Worker executes every fixture and recovers after SQL errors', async () => {
  const messages = [];
  const context = vm.createContext({
    console, setTimeout, clearTimeout, TextDecoder, TextEncoder, Uint8Array,
    WebAssembly, fetch: () => { throw Error('Network access must not be needed'); },
    self: { postMessage: message => messages.push(message) }
  });
  for (const file of ['vendor/sql-wasm.js', 'sql-core.js', 'sql-worker.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  const bytes = fs.readFileSync(path.join(root, 'vendor/sql-wasm.wasm'));
  await context.self.onmessage({ data: { type: 'init', seed: fixture.seed, exercises: Object.values(fixture.days).flat(), wasm: bytes } });
  assert.equal(messages.pop().type, 'ready');
  async function run(sql, exercise = fixture.days['1'][0], extra = {}) {
    await context.self.onmessage({ data: { type: 'run', id: 1, sql, exerciseId: exercise.id, ...extra } });
    return JSON.parse(JSON.stringify(messages.pop()));
  }
  for (const exercise of Object.values(fixture.days).flat()) {
    const response = await run(exercise.answer, exercise);
    assert.equal(response.type, 'result', exercise.id);
    assert.equal(response.correct, true, exercise.id);
    assert.deepEqual(response.result.values, exercise.expected.values);
  }
  assert.equal((await run('SELECT price AS cost, name AS label FROM products ORDER BY id DESC', fixture.days['1'][1])).correct, true);
  for (const [sql, hint] of [['SELECT * FROM missing', '找不到这张表'], ['SELECT missing FROM products', '找不到这列'], ['SELECT FROM products', 'SQL语法'], ['DELETE FROM products', '本题只运行SELECT']]) {
    const response = await run(sql);
    assert.equal(response.type, 'error');
    assert.ok(response.error.includes(hint), response.error);
  }
  assert.equal((await run('SELECT name FROM products')).correct, false);
  const empty = await run('SELECT name FROM products WHERE id < 0');
  assert.deepEqual(empty.result, { columns: ['name'], values: [], truncated: false });
  const limited = await run('SELECT a.id FROM products a, products b, products c, products d');
  assert.equal(limited.result.truncated, true);
  assert.equal(limited.result.values.length, 100);
  assert.equal((await run(fixture.days['1'][0].answer)).correct, true);
  const [insert, update, remove, multi] = fixture.days['2'];
  for (const item of fixture.days['2']) {
    assert.equal((await run(item.answer, item)).correct, true);
    assert.equal((await run(item.answer, item)).correct, true, 'Every run re-seeds data');
  }
  assert.equal((await run('UPDATE products SET stock = 7', update)).correct, false, 'Missing WHERE affects unrelated rows');
  assert.equal((await run('UPDATE products SET stock = 7 WHERE id = 1', update)).correct, false);
  assert.equal((await run('UPDATE products SET stock = 8 WHERE id = 1', multi)).correct, false);
  assert.equal((await run('DELETE FROM products', remove)).correct, false);
  assert.equal((await run("INSERT INTO products VALUES (1, '茶', 6, 3)", insert)).type, 'error');
  for (const sql of ['DROP TABLE products', 'PRAGMA query_only=OFF', 'UPDATE products SET stock=7 WHERE id=2; DELETE FROM products', 'SELECT * FROM products']) {
    assert.equal((await run(sql, update)).type, 'error');
  }
  assert.equal((await run('DELETE FROM products', remove, { operation: 'DELETE', check: 'SELECT 1', expected: { columns: [], values: [] }, seed: '' })).correct, false, 'Run payload cannot replace the trusted check or fixture');
  assert.equal((await run(update.answer, update, { exerciseId: 'unknown' })).type, 'error');
  const many = await run("INSERT INTO products SELECT 10 + a.id * 1000 + b.id * 100 + c.id * 10 + d.id, '茶', 6, 3 FROM products a, products b, products c, products d", insert);
  assert.equal(many.result.truncated, true);
  assert.equal(many.result.values.length, 100);
  assert.equal(many.correct, false);
  assert.equal((await run(insert.answer, insert)).correct, true, 'Recovers after invalid or overbroad DML');
});

test('SQLite query-only defense blocks writes even independently of the SELECT guard', async () => {
  const SQL = await require('../vendor/sql-wasm.js')({ wasmBinary: fs.readFileSync(path.join(root, 'vendor/sql-wasm.wasm')) });
  const db = new SQL.Database();
  try {
    db.run(fixture.seed);
    db.run('PRAGMA query_only=ON');
    assert.throws(() => db.run('DELETE FROM products'), /readonly/);
    assert.equal(db.exec('SELECT COUNT(*) FROM products')[0].values[0][0], 4);
  } finally { db.close(); }
});

test('each generated single-file entry contains a working offline SQL engine', async () => {
  for (const entry of ['index.html', 'review.html', 'study.html']) {
    const html = fs.readFileSync(path.join(root, entry), 'utf8');
    const embedded = id => {
      const match = html.match(new RegExp('<script id="' + id + '"[^>]*>([\\s\\S]*?)</script>'));
      assert.ok(match, entry + ': ' + id);
      return match[1];
    };
    assert.ok(embedded('sqlite-license').includes('Permission is hereby granted'));
    const messages = [];
    const context = vm.createContext({
      console, setTimeout, clearTimeout, TextDecoder, TextEncoder, Uint8Array, WebAssembly,
      fetch: () => { throw Error('Single-file entry must not fetch'); },
      self: { postMessage: message => messages.push(message) }
    });
    for (const id of ['sqlite-library', 'sql-core-code', 'sql-worker-code']) {
      vm.runInContext(embedded(id), context, { filename: entry + ':' + id });
    }
    const data = JSON.parse(embedded('sql-exercises'));
    await context.self.onmessage({ data: { type: 'init', seed: data.seed, exercises: Object.values(data.days).flat(), wasm: Buffer.from(embedded('sqlite-wasm').trim(), 'base64') } });
    assert.equal(messages.pop().type, 'ready', entry);
    for (const exercise of Object.values(data.days).flat()) {
      await context.self.onmessage({ data: { type: 'run', id: 1, sql: exercise.answer, exerciseId: exercise.id } });
      assert.equal(messages.pop().correct, true, entry + ': ' + exercise.id);
    }
  }
});

test('DML guard permits only the trusted operation and one complete statement', () => {
  for (const [sql, op] of [["INSERT INTO products VALUES (5,'a;b',6,3);", 'INSERT'], [' /* hi */ UPDATE products SET stock=7 WHERE id=2;', 'UPDATE'], ['DELETE FROM products WHERE id=3;', 'DELETE']]) {
    assert.equal(core.oneStatement(sql, op), sql);
  }
  for (const sql of ['SELECT 1', 'DELETE FROM products', 'PRAGMA query_only=OFF', 'DROP TABLE products', 'UPDATE products SET stock=7; UPDATE products SET price=2', 'UPDATE products SET stock=7; "ignored"', "UPDATE products SET name='oops"]) {
    assert.throws(() => core.oneStatement(sql, 'UPDATE'));
  }
  assert.throws(() => core.oneStatement('DROP TABLE products', 'DROP'));
});
