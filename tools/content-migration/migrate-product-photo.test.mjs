import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { CloudinaryServiceError, createCloudinaryService } from '../../src/lib/cloudinary.ts';
import { TARGET, photoIdentity, photoJournalPath, MAX_PHOTO_BYTES, parsePhotoArguments, inspectJpeg,
  fetchPhoto, createPhotoJournal, runPhotoMigration } from './migrate-product-photo.mjs';
const [{ default: Media }, { default: Product }] = await Promise.all([
  import('../../src/models/Media.ts'), import('../../src/models/Product.ts'),
]);
const { buildImportDocuments } = await import('./prepare-import.mjs');
const { default: Category } = await import('../../src/models/Category.ts');
const manifest = JSON.parse(await fs.readFile(new URL('./output/candidate-manifest.json', import.meta.url), 'utf8'));
const prepared = buildImportDocuments(manifest, { Category, Product, mongoose });
const TEST_PRODUCT_ID = '1e9f418c65cc80c3d3a56184';
const IDENTITY = photoIdentity('test');
const models = { Media, Product };
const oid = value => new mongoose.Types.ObjectId(value);
// Minimal JPEG headers + scan data for format/dimension parsing, not an upload fixture.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 1, 14, 0, 249, 1, 1, 0x11, 0,
  0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 1, 2, 3, 0xff, 0xd9]);
const photoResponse = (body = jpeg, { status = 200, url = TARGET.photoUrl, mime = 'image/jpeg', length = body.length } = {}) => {
  const response = new Response(body, { status, headers: { 'content-type': mime,
    ...(length === null ? {} : { 'content-length': String(length) }) } });
  return { status, url, headers: response.headers, body: response.body };
};
const copy = value => {
  if (value instanceof mongoose.Types.ObjectId) return oid(value.toHexString());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, copy(v)]));
  return value;
};
const get = (object, field) => field.split('.').reduce((value, part) => value?.[part], object);
const matches = (doc, query) => Object.entries(query).every(([key, value]) => key === '$or'
  ? value.some(condition => matches(doc, condition))
  : value === null ? get(doc, key) == null : String(get(doc, key)) === String(value));
const fixture = (target = 'test') => {
  const IDENTITY = photoIdentity(target);
  const state = {
    products: [{ _id: oid(TEST_PRODUCT_ID), name: { uk: 'Автокрісло' }, slug: { uk: TARGET.slug },
      status: 'draft', importMeta: { legacyUrl: TARGET.legacyUrl }, images: [],
      category: oid('1b04529bcd47ae89a17fdad1') }],
    categories: [{ _id: oid('1b04529bcd47ae89a17fdad1'), slug: { uk: prepared.categories[0].document.slug.uk }, status: 'draft', importMeta: { legacyUrl: prepared.categories[0].document.importMeta.legacyUrl } }],
    media: [], content_migration_locks: [], writes: [], cloudCalls: [], journalSaves: [],
    journal: null, cloudImage: null, fetches: 0, sessionsEnded: 0,
  };
  const connection = {
    db: {
      databaseName: target === 'main' ? 'db-babyhub' : 'db-babyhub-test',
      collection(name) {
        assert.ok(['products', 'categories', 'media', 'content_migration_locks'].includes(name), 'No other collection may be used');
        return {
          async findOne(query) { return copy(state[name].find(doc => matches(doc, query)) ?? null); },
          async countDocuments(query) { return state[name].filter(doc => matches(doc, query)).length; },
          find(query) { return { limit(limit) { return { async toArray() {
            return state[name].filter(doc => matches(doc, query)).slice(0, limit).map(copy);
          } }; } }; },
          async insertOne(doc) {
            if (state[name].some(other => String(other._id) === String(doc._id))) {
              throw Object.assign(new Error('duplicate'), { code: 11000 });
            }
            state.writes.push([name, 'insert']); state[name].push(copy(doc));
            return { acknowledged: true, insertedId: doc._id };
          },
          async updateOne(query, update, options = {}) {
            state.writes.push([name, 'update']);
            if (name === 'products' && state.failProductUpdate) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
            let doc = state[name].find(item => matches(item, query));
            if (!doc) {
              if (!options.upsert) return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
              if (state[name].some(item => String(item._id) === String(query._id))) {
                throw Object.assign(new Error('lock held'), { code: 11000 });
              }
              doc = { ...copy(query), ...copy(update.$setOnInsert), ...copy(update.$set) };
              state[name].push(doc);
              return { acknowledged: true, matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
            }
            let modified = false;
            if (update.$set) { Object.assign(doc, copy(update.$set)); modified = true; }
            if (update.$addToSet) {
              assert.deepEqual(Object.keys(update.$addToSet), ['images']);
              const id = update.$addToSet.images;
              if (!doc.images.some(value => String(value) === String(id))) { doc.images.push(copy(id)); modified = true; }
            }
            return { acknowledged: true, matchedCount: 1, modifiedCount: modified ? 1 : 0, upsertedCount: 0 };
          },
        };
      },
    },
    async startSession() {
      return {
        async withTransaction(action) {
          const snapshot = copy({ products: state.products, media: state.media });
          try { return await action(); }
          catch (error) { state.products = snapshot.products; state.media = snapshot.media; throw error; }
        },
        async endSession() { state.sessionsEnded++; },
      };
    },
  };
  const cloudinary = {
    checkConfiguration() { return { configured: true }; },
    async getImageInfo(id) {
      assert.equal(id, IDENTITY.publicId);
      state.cloudCalls.push('get');
      if (state.lookupGate) await state.lookupGate();
      if (state.lookupError) throw state.lookupError;
      if (state.cloudImage) return copy(state.cloudImage);
      throw new CloudinaryServiceError('CLOUDINARY_REQUEST_FAILED', 'not found', 404);
    },
    async uploadImage(source, options) {
      assert.equal(source, `data:image/jpeg;base64,${jpeg.toString('base64')}`);
      assert.deepEqual(options, { public_id: IDENTITY.publicId });
      state.cloudCalls.push('upload');
      if (state.uploadError) throw state.uploadError;
      state.cloudImage = { public_id: IDENTITY.publicId, secure_url: 'https://res.cloudinary.com/test/image/upload/v1/photo.jpg',
        width: 249, height: 270, bytes: jpeg.length, format: 'jpg' };
      return copy(state.cloudImage);
    },
  };
  const journal = {
    async read() { return copy(state.journal); },
    async save(record) {
      state.journalSaves.push(record.phase);
      if (state.failJournalPhase === record.phase) throw new Error('simulated journal disk failure');
      state.journal = copy(record);
      if (state.afterJournalSave) state.afterJournalSave(record);
    },
  };
  const options = { target, confirmDatabase: target === 'main' ? 'db-babyhub' : undefined, prepared, connection, models, cloudinary, journal, account: 'a'.repeat(64),
    async fetchImpl(url, options) {
      state.fetches++;
      assert.equal(url, TARGET.photoUrl);
      assert.equal(options.redirect, 'manual');
      return photoResponse();
    } };
  return { state, options, run: confirmed => runPhotoMigration({ ...options, confirmed }) };
};

test('CLI вимагає явну ціль для запису та зберігає legacy dry-run', () => {
  assert.equal(parsePhotoArguments([]).confirmed, false);
  assert.equal(parsePhotoArguments(['--target=test', '--confirm-import']).confirmed, true);
  assert.throws(() => parsePhotoArguments(['--confirm-import']), { code: 'TARGET_REQUIRED' });
  for (const args of [['--url=other'], ['--db=main'], ['file'], ['--confirm-import', '--confirm-import']]) {
    assert.throws(() => parsePhotoArguments(args), { code: 'INVALID_ARGUMENTS' });
  }
});

test('перевіряє JPEG за байтами й розмірами, а не розширенням', () => {
  assert.deepEqual(inspectJpeg(jpeg), { width: 249, height: 270 });
  for (const invalid of [Buffer.from('not jpeg'), jpeg.subarray(0, -2), Buffer.from(jpeg).fill(0, 7, 9)]) {
    assert.throws(() => inspectJpeg(invalid));
  }
});

test('фотографія перевіряється через один обмежений HTTPS GET із MIME і SHA-256', async () => {
  const photo = await fetchPhoto(async () => photoResponse());
  assert.equal(photo.sizeBytes, jpeg.length);
  assert.equal(photo.mimeType, 'image/jpeg');
  assert.equal(photo.format, 'jpg');
  assert.match(photo.sha256, /^[a-f0-9]{64}$/);
});

test('редиректи, інша URL, MIME, формат і некоректний розмір блокуються', async () => {
  for (const response of [
    () => photoResponse(jpeg, { status: 302 }),
    () => photoResponse(jpeg, { url: 'http://example.test/image.jpg' }),
    () => photoResponse(jpeg, { mime: 'text/html' }),
    () => photoResponse(Buffer.from('fake jpeg')),
    () => photoResponse(jpeg, { length: MAX_PHOTO_BYTES + 1 }),
    () => photoResponse(jpeg, { length: jpeg.length + 1 }),
    () => photoResponse(jpeg, { length: 0 }),
    () => photoResponse(Buffer.alloc(MAX_PHOTO_BYTES + 1), { length: null }),
  ]) await assert.rejects(fetchPhoto(async () => response()));
});

test('dry-run читає товар і фото, але не змінює MongoDB, журнал чи Cloudinary', async () => {
  const { state, run } = fixture();
  const result = await run(false);
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.mediaModelValidation, 'valid-with-preview-url');
  assert.equal(result.uploads, 0);
  assert.equal(result.mongoWrites, 0);
  assert.equal(state.fetches, 1);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.cloudCalls, []);
  assert.deepEqual(state.journalSaves, []);
  assert.equal(state.media.length, 0);
  assert.deepEqual(state.products[0].images, []);
});

test('назва БД, slug, legacyUrl і draft перевіряються до GET або записів', async () => {
  for (const mutate of [
    (s, o) => { o.connection.db.databaseName = 'db-babyhub'; },
    s => { s.products[0].slug.uk = 'other'; },
    s => { s.products[0].importMeta.legacyUrl = 'https://example.test/other'; },
    s => { s.products[0].status = 'published'; },
    s => { s.products.push(copy(s.products[0])); },
  ]) {
    const { state, options, run } = fixture();
    mutate(state, options);
    await assert.rejects(run(true));
    assert.equal(state.fetches, 0);
    assert.deepEqual(state.writes, []);
    assert.deepEqual(state.cloudCalls, []);
  }
});

test('конфлікти Media за _id, filename або source URL не перезаписуються', async () => {
  for (const doc of [
    { _id: oid(IDENTITY.mediaId) },
    { _id: oid('aaaaaaaaaaaaaaaaaaaaaaaa'), filename: IDENTITY.filename },
    { _id: oid('aaaaaaaaaaaaaaaaaaaaaaaa'), importMeta: { legacyUrl: TARGET.photoUrl } },
  ]) {
    const { state, run } = fixture();
    state.media.push(doc);
    await assert.rejects(run(true), { code: 'MEDIA_IDENTITY_CONFLICT' });
    assert.deepEqual(state.writes, []);
    assert.deepEqual(state.cloudCalls, []);
  }
});

test('два кандидати Media блокують операцію незалежно від індексів', async () => {
  const { state, run } = fixture();
  state.media.push({ filename: IDENTITY.filename }, { importMeta: { legacyUrl: TARGET.photoUrl } });
  await assert.rejects(run(true), { code: 'MEDIA_DUPLICATE_CONFLICT' });
  assert.deepEqual(state.writes, []);
});

test('перший запис у симуляторі створює одну Media, додає images і зберігає журнал', async () => {
  const { state, run } = fixture();
  const result = await run(true);
  assert.equal(result.uploads, 1);
  assert.equal(result.createdMedia, 1);
  assert.equal(result.productModified, 1);
  assert.equal(state.media.length, 1);
  await Media.hydrate(state.media[0]).validate();
  assert.equal(String(state.products[0].images[0]), IDENTITY.mediaId);
  assert.equal(state.products[0].status, 'draft');
  assert.equal(state.media[0].importMeta.legacyUrl, TARGET.photoUrl);
  assert.equal(JSON.parse(state.media[0].importMeta.source).publicId, IDENTITY.publicId);
  assert.deepEqual(state.journalSaves, ['upload-intent', 'uploaded', 'committed']);
  assert.equal(state.content_migration_locks[0].owner, null);
  assert.equal(state.sessionsEnded, 1);
  assert.doesNotMatch(JSON.stringify(state.journal), /api_secret|api_key|mongodb:|data:image/);
});

test('повторний запуск використовує ресурс і Media без дублікатів та повторного upload', async () => {
  const { state, run } = fixture();
  await run(true);
  const snapshot = JSON.stringify([state.products, state.media]);
  const repeat = await run(true);
  assert.equal(repeat.uploads, 0);
  assert.equal(repeat.createdMedia, 0);
  assert.equal(repeat.productModified, 0);
  assert.equal(state.cloudCalls.filter(c => c === 'upload').length, 1);
  assert.equal(JSON.stringify([state.products, state.media]), snapshot);
  const plan = await run(false);
  assert.deepEqual(plan.planned, { media: 'reuse', productImage: 'reuse-link' });
});

test('лише типізований підтверджений 404 дозволяє upload', async () => {
  for (const error of [new Error('network timeout'),
    new CloudinaryServiceError('CLOUDINARY_REQUEST_FAILED', 'auth', 401),
    new CloudinaryServiceError('CLOUDINARY_REQUEST_FAILED', 'network', 502),
    Object.assign(new Error('untrusted 404'), { status: 404 })]) {
    const { state, run } = fixture();
    state.lookupError = error;
    await assert.rejects(run(true));
    assert.equal(state.cloudCalls.includes('upload'), false);
    assert.equal(state.media.length, 0);
    assert.deepEqual(state.journalSaves, []);
    assert.equal(state.content_migration_locks[0].owner, null);
  }
});

test('реальний нормалізатор дозволяє міграцію лише після верхнього/вкладеного 404 (mock SDK)', async () => {
  for (const [rawError, missing] of [
    [{ http_code: 404 }, true], [{ error: { http_code: 404 } }, true],
    [{ error: { http_code: 401 } }, false], [{ error: { http_code: 403 } }, false],
    [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), false],
    [{ error: { message: 'unknown' } }, false], [{ status: 404 }, false],
    [{ http_code: 401, error: { http_code: 404 } }, false],
  ]) {
    const { state, options } = fixture();
    const fakeCloud = options.cloudinary;
    options.cloudinary = createCloudinaryService({
      env: { CLOUDINARY_CLOUD_NAME: 'test', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'dummy-secret' },
      sdk: {
        api: { async resource() { throw rawError; } },
        uploader: {
          async upload(source, settings) {
            return { ...await fakeCloud.uploadImage(source, { public_id: settings.public_id }), resource_type: 'image' };
          },
          async destroy() { assert.fail('Deletion must never be called'); },
        },
      },
    });
    const run = () => runPhotoMigration({ ...options, confirmed: true });
    if (missing) {
      const result = await run();
      assert.equal(result.uploads, 1);
      assert.equal(result.createdMedia, 1);
    } else {
      await assert.rejects(run(), { code: 'CLOUDINARY_REQUEST_FAILED' });
      assert.equal(state.cloudCalls.includes('upload'), false);
      assert.equal(state.media.length, 0);
      assert.deepEqual(state.journalSaves, []);
    }
  }
});

test('наявний Cloudinary ресурс невідомого походження не використовується', async () => {
  const { state, run } = fixture();
  state.cloudImage = { public_id: IDENTITY.publicId, secure_url: 'https://res.cloudinary.com/test/image/upload/v1/photo.jpg',
    width: 249, height: 270, bytes: jpeg.length, format: 'jpg' };
  await assert.rejects(run(true), { code: 'CLOUD_RESOURCE_UNKNOWN_ORIGIN' });
  assert.equal(state.cloudCalls.includes('upload'), false);
  assert.equal(state.media.length, 0);
});

test('помилка MongoDB після upload зберігає proven журнал і дозволяє відновлення', async () => {
  const { state, run } = fixture();
  state.failProductUpdate = true;
  await assert.rejects(run(true), { code: 'PRODUCT_UPDATE_FAILED' });
  assert.equal(state.media.length, 0);
  assert.deepEqual(state.products[0].images, []);
  assert.equal(state.journal.phase, 'uploaded');
  assert.ok(state.journal.image);
  state.failProductUpdate = false;
  const recovery = await run(true);
  assert.equal(recovery.uploads, 0);
  assert.equal(recovery.createdMedia, 1);
  assert.equal(state.cloudCalls.filter(c => c === 'upload').length, 1);
  assert.equal(state.journal.phase, 'committed');
});

test('невдалий запис upload-intent не дозволяє upload', async () => {
  const { state, run } = fixture();
  state.failJournalPhase = 'upload-intent';
  await assert.rejects(run(true));
  assert.equal(state.cloudCalls.includes('upload'), false);
  assert.equal(state.media.length, 0);
});

test('втрата підтвердження upload залишає неоднозначний стан і блокує автоматичне продовження', async () => {
  const { state, run } = fixture();
  state.failJournalPhase = 'uploaded';
  await assert.rejects(run(true));
  assert.equal(state.journal.phase, 'upload-intent');
  assert.equal(state.media.length, 0);
  state.failJournalPhase = null;
  await assert.rejects(run(true), { code: 'CLOUD_RESOURCE_UNKNOWN_ORIGIN' });
  assert.equal(state.cloudCalls.filter(c => c === 'upload').length, 1);
});

test('upload-intent без ресурсу відновлюється лише після нового підтвердженого 404', async () => {
  const { state, run } = fixture();
  state.uploadError = new Error('upload connection failed before success');
  await assert.rejects(run(true));
  assert.equal(state.journal.phase, 'upload-intent');
  assert.equal(state.cloudImage, null);
  state.uploadError = null;
  const recovery = await run(true);
  assert.equal(recovery.uploads, 1);
  assert.equal(recovery.createdMedia, 1);
  assert.equal(state.media.length, 1);
});

test('втрата вже підтвердженого ресурсу не запускає повторне завантаження', async () => {
  const { state, run } = fixture();
  await run(true);
  state.cloudImage = null;
  await assert.rejects(run(true), { code: 'MISSING_OR_AMBIGUOUS_CLOUD_RESOURCE' });
  assert.equal(state.cloudCalls.filter(c => c === 'upload').length, 1);
});

test('втрата committed journal після commit не створює дублікатів при відновленні', async () => {
  const { state, run } = fixture();
  state.failJournalPhase = 'committed';
  await assert.rejects(run(true));
  assert.equal(state.media.length, 1);
  assert.equal(state.journal.phase, 'uploaded');
  state.failJournalPhase = null;
  const result = await run(true);
  assert.equal(result.createdMedia, 0);
  assert.equal(result.productModified, 0);
  assert.equal(result.uploads, 0);
});

test('підтверджена Media дозволяє відновити локальний журнал без нового upload', async () => {
  const { state, run } = fixture();
  await run(true);
  state.journal = null;
  const result = await run(true);
  assert.equal(result.uploads, 0);
  assert.equal(result.createdMedia, 0);
  assert.equal(state.journal.phase, 'committed');
});

test('зміна байтів джерела, аккаунта або ідентифікаторів у журналі блокує продовження', async () => {
  for (const field of ['sourceSha256', 'account', 'publicId', 'mediaId', 'sourceUrl', 'productId', 'database']) {
    const { state, run } = fixture();
    await run(true);
    state.journal[field] = 'different';
    const calls = state.cloudCalls.length;
    await assert.rejects(run(true), { code: 'JOURNAL_IDENTITY_CONFLICT' });
    assert.equal(state.cloudCalls.length, calls);
  }
});

test('паралельний запуск блокується MongoDB lock, поки перший виконує Cloudinary lookup', async () => {
  const { state, run } = fixture();
  let reached;
  let resume;
  const ready = new Promise(resolve => { reached = resolve; });
  const gate = new Promise(resolve => { resume = resolve; });
  state.lookupGate = async () => { reached(); await gate; };
  const first = run(true);
  await ready;
  await assert.rejects(run(true), { code: 'PHOTO_MIGRATION_LOCKED' });
  resume();
  await first;
  assert.equal(state.media.length, 1);
  assert.equal(state.cloudCalls.filter(c => c === 'upload').length, 1);
});

test('lock загиблого процесу не перехоплюється автоматично', async () => {
  const { state, run } = fixture();
  state.content_migration_locks.push({ _id: 'baby-service-photo-v1', owner: 'previous-owner', sourceUrl: TARGET.photoUrl });
  await assert.rejects(run(true), { code: 'PHOTO_MIGRATION_LOCKED' });
  assert.equal(state.content_migration_locks[0].owner, 'previous-owner');
  assert.deepEqual(state.cloudCalls, []);
});

test('повторна перевірка draft після журналу блокує upload при зміні товару', async () => {
  const { state, run } = fixture();
  state.afterJournalSave = record => { if (record.phase === 'upload-intent') state.products[0].status = 'published'; };
  await assert.rejects(run(true), { code: 'TARGET_PRODUCT_MISMATCH' });
  assert.equal(state.cloudCalls.includes('upload'), false);
  assert.equal(state.media.length, 0);
});

test('журнал фізично записується та читається як JSON без секретів', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'babyhub-photo-journal-'));
  const file = path.join(directory, 'journal.json');
  try {
    const journal = createPhotoJournal(file);
    assert.equal(await journal.read(), null);
    const record = { sourceUrl: TARGET.photoUrl, ...IDENTITY, phase: 'upload-intent' };
    await journal.save(record);
    assert.deepEqual(await journal.read(), record);
    await journal.save({ ...record, phase: 'uploaded' });
    assert.equal((await journal.read()).phase, 'uploaded');
    assert.deepEqual(await fs.readdir(directory), ['journal.json']);
  } finally { await fs.unlink(file).catch(() => {}); await fs.rmdir(directory); }
});

test('товар визначається точним legacyUrl, а не тестовим ObjectId', async () => {
  const { state, run } = fixture('main');
  state.products[0]._id = oid('aaaaaaaaaaaaaaaaaaaaaaaa');
  const result = await run(false);
  assert.equal(result.productId, 'aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(result.database, 'db-babyhub');
  assert.deepEqual(state.writes, []);
});

test('main без Product повертає залежність у плані; підтверджений режим не доходить до upload/lock', async () => {
  const { state, run } = fixture('main');
  state.products = [];
  const result = await run(false);
  assert.equal(result.dependency, 'PRODUCT_IMPORT_REQUIRED');
  assert.equal(result.productId, null);
  assert.equal(result.mongoWrites, 0);
  assert.deepEqual(state.cloudCalls, []);
  assert.deepEqual(state.writes, []);
  await assert.rejects(run(true), { code: 'TARGET_PRODUCT_MISMATCH' });
  assert.deepEqual(state.writes, []);
});

test('main вимагає окреме підтвердження до читань, fetch і будь-яких мутацій', async () => {
  const { options, state } = fixture('main');
  for (const override of [{ target: undefined }, { confirmDatabase: undefined }, { confirmDatabase: 'db-babyhub-test' }]) {
    await assert.rejects(runPhotoMigration({ ...options, confirmed: true, ...override }));
  }
  assert.equal(state.fetches, 0);
  assert.deepEqual(state.cloudCalls, []);
  assert.deepEqual(state.writes, []);
});

test('main не приймає test журнал/Media; publicId, filename, Media ID, locks і шляхи ізольовані', async () => {
  assert.notEqual(photoJournalPath('main'), photoJournalPath('test'));
  const mainIdentity = photoIdentity('main');
  assert.ok(mainIdentity.publicId.startsWith('baby-service/'));
  for (const field of ['publicId', 'filename', 'mediaId']) assert.notEqual(mainIdentity[field], IDENTITY[field]);
  const testRun = fixture();
  await testRun.run(true);
  const main = fixture('main');
  main.state.journal = copy(testRun.state.journal);
  await assert.rejects(main.run(false), { code: 'JOURNAL_IDENTITY_CONFLICT' });
  main.state.journal = null;
  main.state.media = copy(testRun.state.media);
  await assert.rejects(main.run(false), { code: 'MEDIA_IDENTITY_CONFLICT' });
  main.state.media = [];
  const first = await main.run(true); // Entirely in-memory; no external mutations.
  assert.equal(first.uploads, 1);
  assert.notEqual(main.state.content_migration_locks[0]._id, testRun.state.content_migration_locks[0]._id);
  const second = await main.run(true);
  assert.equal(second.uploads, 0);
  assert.equal(second.createdMedia, 0);
  assert.equal(second.productModified, 0);
});

test('main зберігає відновлення після часткового збою, транзакційність і provenance', async () => {
  const { state, run } = fixture('main');
  state.failProductUpdate = true;
  await assert.rejects(run(true), { code: 'PRODUCT_UPDATE_FAILED' });
  assert.equal(state.media.length, 0);
  assert.equal(state.journal.phase, 'uploaded');
  state.failProductUpdate = false;
  const restored = await run(true);
  assert.equal(restored.uploads, 0);
  assert.equal(restored.createdMedia, 1);
  assert.equal(state.journal.database, 'db-babyhub');
  assert.ok(state.journal.publicId.startsWith('baby-service/'));
});

test('фото має бути в підготовленому записі цього товару; draft-категорія мусить відповідати джерелу', async () => {
  const main = fixture('main');
  main.options.prepared = { ...prepared, products: [{ ...prepared.products[0], record: { ...prepared.products[0].record, imageLegacyUrls: [] } }] };
  await assert.rejects(main.run(false), { code: 'PHOTO_SOURCE_PRODUCT_MISMATCH' });
  assert.equal(main.state.fetches, 0);
  const other = fixture('main');
  other.state.categories[0].importMeta.legacyUrl = 'https://example.test/other-category';
  await assert.rejects(other.run(false), { code: 'TARGET_CATEGORY_MISMATCH' });
  assert.equal(other.state.fetches, 0);
});
