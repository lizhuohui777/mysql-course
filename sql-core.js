(function (root) {
  'use strict';
  function oneStatement(sql, operation = 'SELECT') {
    if (!['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'COMMIT', 'ROLLBACK'].includes(operation)) throw Error('这道练习的操作配置无效。');
    if (typeof sql !== 'string' || !sql.trim()) throw Error('先写一条SQL，再点运行。');
    if (sql.length > 20000) throw Error('这是一道短题，请把SQL缩短到20000字以内。');
    let visible = '', quote = '', comment = '', ended = false;
    for (let i = 0; i < sql.length; i++) {
      const c = sql[i], next = sql[i + 1];
      if (comment === 'line') { if (c === '\n') { comment = ''; visible += ' '; } continue; }
      if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; visible += ' '; } continue; }
      if (quote) {
        if (c === quote) { if (next === quote) i++; else quote = ''; }
        continue;
      }
      if (c === '-' && next === '-') { comment = 'line'; i++; continue; }
      if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
      if (ended && !/\s/.test(c)) throw Error('每次只运行一条' + operation + '语句。');
      if (c === "'" || c === '"' || c === '`' || c === '[') { quote = c === '[' ? ']' : c; visible += ' value '; continue; }
      if (c === ';') { ended = true; continue; }
      visible += c;
    }
    if (quote || comment === 'block') throw Error('引号或注释没有写完整。');
    if (!new RegExp('^\\s*' + operation + '\\b', 'i').test(visible)) throw Error(operation === 'SELECT' ? '本题只运行SELECT查询，暂不运行增删改或建表语句。' : '本题请使用一条' + operation + '语句。');
    return sql;
  }
  const oneSelect = sql => oneStatement(sql, 'SELECT');
  function bag(rows) { return rows.map(row => JSON.stringify(row)).sort().join('\n'); }
  function matches(result, expected, ordered = false) {
    if (result.truncated || result.columns.length !== expected.columns.length || result.values.length !== expected.values.length) return false;
    // Compare actual values, not a preferred spelling; retain duplicate rows and accept column aliases/order.
    const encode = rows => ordered ? JSON.stringify(rows) : bag(rows);
    const target = encode(expected.values), width = expected.columns.length;
    function search(order, used) {
      if (order.length === width) return encode(result.values.map(row => order.map(i => row[i]))) === target;
      for (let i = 0; i < width; i++) if (!used.has(i)) {
        used.add(i); order.push(i);
        if (search(order, used)) return true;
        order.pop(); used.delete(i);
      }
      return false;
    }
    return search([], new Set());
  }
  function friendlyError(message) {
    if (/no such table:/i.test(message)) return '找不到这张表：' + message.split(':').slice(1).join(':').trim() + '。请对照本课的练习数据表名。';
    if (/no such column:/i.test(message)) return '找不到这列：' + message.split(':').slice(1).join(':').trim() + '。请对照练习表头；多表查询可用表别名限定列。';
    if (/UNIQUE constraint failed/i.test(message)) return '编号重复了：id必须唯一。每次运行已有编号1–4，请检查要插入的编号。';
    if (/NOT NULL constraint failed/i.test(message)) return '必填列缺少值，请检查列清单与VALUES是否对应。原始提示：' + message;
    if (/syntax error|incomplete input/i.test(message)) return 'SQL语法还不完整。检查关键字、列与值的对应，以及逗号和引号。原始提示：' + message;
    if (/readonly|not authorized/i.test(message)) return '当前只读练习不修改数据，请使用SELECT查询。';
    return message;
  }
  const api = Object.freeze({ oneSelect, oneStatement, matches, friendlyError });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CourseSQLCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
