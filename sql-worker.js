'use strict';
let SQL, seed, exercises;
function readResult(statement) {
  const columns = statement.getColumnNames(), values = [];
  let truncated = false;
  while (statement.step()) {
    if (values.length === 100) { truncated = true; break; }
    values.push(statement.get());
  }
  return { columns, values, truncated };
}
self.onmessage = async event => {
  const message = event.data;
  if (message.type === 'init') {
    try {
      seed = message.seed;
      exercises = new Map((message.exercises || []).map(item => [item.id, item]));
      SQL = await initSqlJs({ wasmBinary: new Uint8Array(message.wasm) });
      self.postMessage({ type: 'ready' });
    } catch (error) { self.postMessage({ type: 'init-error', error: String(error.message || error) }); }
    return;
  }
  if (message.type !== 'run' || !SQL) return;
  let db, statement;
  try {
    const exercise = exercises.get(message.exerciseId);
    if (!exercise) throw Error('找不到这道练习，请重新打开课程。');
    const operation = exercise.operation || 'SELECT';
    const sql = CourseSQLCore.oneStatement(message.sql, operation);
    db = new SQL.Database();
    db.run(exercise.seed || seed);
    if (exercise.setup) db.run(exercise.setup);
    if (operation === 'SELECT') db.run('PRAGMA query_only = ON;');
    statement = db.prepare(sql);
    let result = readResult(statement), affected, beforeResult;
    statement.free(); statement = null;
    let correct;
    if (operation !== 'SELECT') {
      affected = ['COMMIT', 'ROLLBACK'].includes(operation) ? undefined : db.getRowsModified();
      if (exercise.expectedBefore) {
        statement = db.prepare(exercise.check);
        beforeResult = readResult(statement);
        statement.free(); statement = null;
      }
      if (exercise.after) db.run(exercise.after);
      // The fixture, not learner input, controls how the final database is inspected.
      db.run('PRAGMA query_only = ON;');
      statement = db.prepare(exercise.check);
      result = readResult(statement);
      correct = (exercise.affected === undefined || affected === exercise.affected) && JSON.stringify(result) === JSON.stringify({ ...exercise.expected, truncated: false }) && (!exercise.expectedBefore || JSON.stringify(beforeResult) === JSON.stringify({ ...exercise.expectedBefore, truncated: false }));
    } else correct = CourseSQLCore.matches(result, exercise.expected, exercise.ordered);
    self.postMessage({ type: 'result', id: message.id, result, beforeResult, affected, correct });
  } catch (error) {
    self.postMessage({ type: 'error', id: message.id, error: CourseSQLCore.friendlyError(String(error.message || error)) });
  } finally {
    if (statement) statement.free();
    if (db) db.close();
  }
};
