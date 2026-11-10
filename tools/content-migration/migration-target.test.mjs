import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTargetArguments, loadTargetConfiguration, openTargetConnection,
  assertWriteAuthorization, assertTargetDatabase } from './migration-target.mjs';

test('writes require explicit target; main additionally requires exact database confirmation', () => {
  assert.equal(parseTargetArguments([]).confirmed, false);
  assert.throws(() => parseTargetArguments(['--confirm-import']), { code: 'TARGET_REQUIRED' });
  assert.throws(() => parseTargetArguments(['--target=main', '--confirm-import']),
    { code: 'MAIN_DATABASE_CONFIRMATION_REQUIRED' });
  assert.equal(parseTargetArguments(['--target=test', '--confirm-import']).target, 'test');
  assert.equal(parseTargetArguments(['--confirm-database=db-babyhub', '--confirm-import', '--target=main']).target, 'main');
  for (const args of [ ['--target=other'], ['--target=test', '--target=main'],
    ['--target=main', '--confirm-database=db-babyhub-test'], ['--target=test', '--confirm-database=db-babyhub'],
    ['--confirm-import', '--confirm-import'], ['--confirm-database=db-babyhub'] ]) {
    assert.throws(() => parseTargetArguments(args));
  }
  assert.throws(() => assertWriteAuthorization({ confirmed: true }), { code: 'TARGET_REQUIRED' });
});

test('configuration uses only the selected variable from file, ignoring inherited disabled DB_HOST', async () => {
  const previous = process.env.DB_HOST;
  process.env.DB_HOST = 'mongodb://127.0.0.1:1/disabled-for-local-preview';
  try {
    const readFile = async () => 'DB_HOST=mongodb://main.invalid/db-babyhub\nDB_HOST_TEST=mongodb://test.invalid/db-babyhub-test';
    const main = await loadTargetConfiguration({ target: 'main', readFile });
    const test = await loadTargetConfiguration({ target: 'test', readFile });
    assert.equal(main.uri, 'mongodb://main.invalid/db-babyhub');
    assert.equal(main.dbName, 'db-babyhub');
    assert.equal(test.uri, 'mongodb://test.invalid/db-babyhub-test');
    assert.notEqual(main.uri, process.env.DB_HOST);
    await assert.rejects(loadTargetConfiguration({ target: 'main', readFile: async () => 'DB_HOST_TEST=mongodb://test.invalid/' }), { code: 'DB_HOST_REQUIRED' });
    for (const uri of ['mongodb://main.invalid/db-babyhub-test', 'mongodb://127.0.0.1:1/disabled-for-local-preview', 'https://main.invalid/db-babyhub']) {
      await assert.rejects(loadTargetConfiguration({ target: 'main', readFile: async () => `DB_HOST=${uri}` }), { code: 'UNSAFE_DATABASE_URI' });
    }
    assert.equal((await loadTargetConfiguration({ target: 'main', readFile: async () => 'DB_HOST=mongodb://main.invalid/' })).dbName, 'db-babyhub');
  } finally {
    if (previous === undefined) delete process.env.DB_HOST;
    else process.env.DB_HOST = previous;
  }
});

test('actual database is checked before returning a connection; mismatch closes it without reads', async () => {
  for (const target of ['main', 'test']) {
    const expected = target === 'main' ? 'db-babyhub' : 'db-babyhub-test';
    const configuration = { target, dbName: expected, uri: 'mongodb://offline.invalid/' };
    let closed = 0;
    let actual = expected;
    const connection = { get db() { return { databaseName: actual }; }, async asPromise() {}, async close() { closed++; } };
    const models = { mongoose: { createConnection(uri, options) {
      assert.equal(uri, configuration.uri);
      assert.equal(options.dbName, expected);
      assert.equal(options.autoIndex, false);
      assert.equal(options.autoCreate, false);
      return connection;
    } } };
    assert.equal(await openTargetConnection(models, configuration), connection);
    actual = 'unapproved';
    await assert.rejects(openTargetConnection(models, configuration), { code: 'UNSAFE_DATABASE' });
    assert.equal(closed, 1);
    assert.throws(() => assertTargetDatabase(actual, target), { code: 'UNSAFE_DATABASE' });
  }
});
