import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { parsePlanArguments, forbidDriverMutations } from './plan-avtokrisla.mjs';
import { buildImportDocuments, assertImportScope, validateImportDocuments } from './prepare-import.mjs';
const [{ default: Category }, { default: Product }] = await Promise.all([
  import('../../src/models/Category.ts'), import('../../src/models/Product.ts'),
]);
const models = { mongoose, Category, Product };

test('category planner never accepts write authorization or implicit targets', () => {
  for (const args of [[], ['--target=main', '--confirm-import', '--confirm-database=db-babyhub'],
    ['--target=test', '--confirm-import'], ['--target=main', '--confirm-database=db-babyhub']]) {
    assert.throws(() => parsePlanArguments(args));
  }
  assert.equal(parsePlanArguments(['--target=main']).target, 'main');
});

test('read-only guard rejects driver writes, indexes and explicit transactions before any network call', () => {
  const original = mongoose.mongo.Collection.prototype.insertOne;
  const guard = forbidDriverMutations();
  try {
    for (const [prototype, name] of [[mongoose.mongo.Collection.prototype, 'insertOne'],
      [mongoose.mongo.Collection.prototype, 'createIndexes'], [mongoose.mongo.Db.prototype, 'createCollection'],
      [mongoose.mongo.ClientSession.prototype, 'startTransaction']]) {
      assert.throws(() => prototype[name](), { code: 'MUTATION_FORBIDDEN' });
    }
    assert.equal(guard.attempts(), 4);
  } finally { guard.restore(); }
  assert.equal(mongoose.mongo.Collection.prototype.insertOne, original);
});

test('reviewed category has 20 UK products/22 photos; executable selection excludes the identity conflict and missing photo', async () => {
  const full = JSON.parse(await fs.readFile(new URL('./output/avtokrisla-uk-manifest-3821.json', import.meta.url), 'utf8'));
  const ready = JSON.parse(await fs.readFile(new URL('./output/avtokrisla-uk-ready-3821.json', import.meta.url), 'utf8'));
  assert.deepEqual(full.extraction.pageCounts, [6, 6, 6, 2]);
  assert.equal(full.products.length, 20);
  assert.equal(full.media.length, 22);
  assert.ok(full.products.every(record => record.locale === 'uk' && !record.legacyUrl.includes('/ru/')));
  assert.ok(full.media.every(record => !record.legacyUrl.includes('/themes/')));
  assert.equal(ready.products.length, 19);
  assert.equal(ready.media.length, 20);
  assert.ok(!ready.products.some(record => record.legacyUrl.includes('nanya')));
  assert.ok(!ready.products.some(record => record.imageLegacyUrls.some(url => url.endsWith('BabyServiseLcbuster1.jpg'))));
  assert.throws(() => assertImportScope(buildImportDocuments(full, models), { batch: true }), { code: 'UNREVIEWED_SOURCE' });
  const prepared = buildImportDocuments(ready, models);
  assertImportScope(prepared, { batch: true });
  assert.deepEqual(await validateImportDocuments(prepared), []);
  for (const { document } of prepared.products) {
    assert.equal(document.status, 'draft');
    assert.equal(document.availability, 'in_stock');
    assert.equal(document.pricing.currency, 'UAH');
    assert.equal(document.pricing.rentalRates.length, 0);
    assert.match(document.importMeta.source, /deferred price=0 UAH/);
  }
});
