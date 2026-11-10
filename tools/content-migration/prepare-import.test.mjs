import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TEST_DATABASE, assertTestDatabase, assertImportScope, loadImportConfiguration,
  openTestConnection, parseImportArguments, runPreparedImport,
  buildImportDocuments, validateImportDocuments,
} from './prepare-import.mjs';
const [{ default: Category }, { default: Product }, { default: mongoose }] = await Promise.all([
  import('../../src/models/Category.ts'),
  import('../../src/models/Product.ts'),
  import('mongoose'),
]);

const manifest = () => ({
  categories: [{
    sourcePageKey: 'page:uk:category:seats',
    entityKey: 'entity:category:seats',
    legacyUrl: 'https://legacy.example/seats.html',
    name: { uk: 'Дитячі крісла', ru: 'Російський текст не імпортувати' },
    slug: { uk: 'seats', ru: 'seats-ru' },
    description: { uk: 'Опис', ru: 'Опис російською' },
  }],
  products: [{
    sourcePageKey: 'page:uk:product:seat-one',
    entityKey: 'entity:product:seat-one',
    legacyUrl: 'https://legacy.example/seats/seat-one.html',
    categoryEntityKey: 'entity:category:seats',
    name: { uk: 'Крісло', ru: 'Кресло' },
    slug: { uk: 'seat-one', ru: 'seat-one-ru' },
    pricingRaw: {
      type: 'rental',
      isConfirmed: false,
      amount: null,
      currency: null,
      periodDays: null,
      unit: null,
    },
  }],
});

test('перетворює тільки українські source-записи і не копіює російські поля', async () => {
  const source = manifest();
  source.categories.push({
    ...source.categories[0],
    sourcePageKey: 'page:ru:category:seats',
    locale: 'ru',
    name: { ru: 'Російська категорія' },
    slug: { ru: 'seats-ru' },
  });
  source.products.push({
    ...source.products[0],
    sourcePageKey: 'page:ru:product:seat-one',
    locale: 'ru',
    name: { ru: 'Російський товар' },
    slug: { ru: 'seat-one-ru' },
  });
  const prepared = buildImportDocuments(source, { Category, Product, mongoose });

  assert.equal(prepared.categories.length, 1);
  assert.equal(prepared.products.length, 1);
  assert.deepEqual(prepared.categories[0].document.name.toObject(), { uk: 'Дитячі крісла' });
  assert.deepEqual(prepared.products[0].document.name.toObject(), { uk: 'Крісло' });
});

test('Category/Product валідні без непідтвердженого тарифу і вигаданого unit', async () => {
  const prepared = buildImportDocuments(manifest(), { Category, Product, mongoose });
  const categoryErrors = await prepared.categories[0].document.validate().then(() => []).catch((error) =>
    Object.keys(error.errors));
  const product = prepared.products[0].document;

  assert.deepEqual(categoryErrors, []);
  assert.equal(product.pricing.currency, 'UAH');
  assert.equal(product.pricing.rentalRates.length, 0);
  assert.equal(product.pricing.salePrice, undefined);
  assert.equal(product.availability, 'in_stock');
  assert.equal(product.status, 'draft');
  assert.match(product.importMeta.source, /availability=in_stock/);
  assert.match(product.importMeta.source, /status=draft/);
  assert.match(product.importMeta.source, /currency=UAH/);
  assert.match(product.importMeta.source, /price=0/);
  assert.match(product.importMeta.source, /rentalRates=\[\] \(unit unconfirmed; deferred price=0 UAH\)/);
  assert.deepEqual(await validateImportDocuments(prepared), []);
});

test('не створює тариф без підтвердженого unit навіть із підтвердженою ціною', async () => {
  for (const unit of [undefined, null, '', '   ']) {
    const source = manifest();
    source.products[0].pricingRaw = {
      type: 'rental', isConfirmed: true, amount: 150, currency: 'UAH', unit,
    };
    const prepared = buildImportDocuments(source, { Category, Product, mongoose });
    const product = prepared.products[0].document;
    assert.equal(product.pricing.rentalRates.length, 0);
    assert.equal(product.pricing.salePrice, undefined);
    assert.match(product.importMeta.source, /deferred price=150 UAH/);
    assert.deepEqual(await validateImportDocuments(prepared), []);
  }
});

test('не використовує unit, суму та валюту з непідтвердженого pricing', async () => {
  const source = manifest();
  Object.assign(source.products[0].pricingRaw, { unit: 'доба', amount: 150, currency: 'USD' });
  const prepared = buildImportDocuments(source, { Category, Product, mongoose });
  const product = prepared.products[0].document;
  assert.equal(product.pricing.currency, 'UAH');
  assert.equal(product.pricing.rentalRates.length, 0);
  assert.match(product.importMeta.source, /deferred price=0 UAH/);
  assert.deepEqual(await validateImportDocuments(prepared), []);
});

test('зберігає підтверджений тариф із його одиницею та валютою', async () => {
  const source = manifest();
  source.products[0].pricingRaw = {
    type: 'rental', isConfirmed: true, amount: 150, currency: ' eur ', unit: ' доба ', periodDays: 1,
  };
  const prepared = buildImportDocuments(source, { Category, Product, mongoose });
  const product = prepared.products[0].document;
  const rate = product.pricing.rentalRates[0];
  assert.equal(rate.price, 150);
  assert.equal(rate.unit, 'доба');
  assert.equal(rate.periodDays, 1);
  assert.equal(rate.currency, 'EUR');
  assert.equal(product.pricing.currency, 'EUR');
  assert.equal(product.pricing.salePrice, undefined);
  assert.doesNotMatch(product.importMeta.source, /price=0|currency=UAH|unit unconfirmed/);
  assert.equal(product.status, 'draft');
  assert.deepEqual(await validateImportDocuments(prepared), []);
});

test('невалідна або відсутня ціна отримує 0, валюту UAH і статус draft', async () => {
  for (const type of ['sale', 'rental']) {
    for (const amount of [undefined, null, -1, NaN, Infinity, '150']) {
      const source = manifest();
      source.products[0].status = 'published';
      source.products[0].pricingRaw = { type, isConfirmed: true, amount, unit: 'доба' };
      const prepared = buildImportDocuments(source, { Category, Product, mongoose });
      const product = prepared.products[0].document;
      const price = type === 'rental' ? product.pricing.rentalRates[0].price : product.pricing.salePrice;
      assert.equal(price, 0);
      assert.equal(product.pricing.currency, 'UAH');
      assert.equal(product.status, 'draft');
      assert.match(product.importMeta.source, /price=0/);
      assert.deepEqual(await validateImportDocuments(prepared), []);
    }
  }
});

test('зберігає підтверджену ціну продажу, включно з нульовою; dry-run не підключає базу', async () => {
  for (const amount of [0, 150]) {
    const source = manifest();
    source.products[0].pricingRaw = { type: 'sale', isConfirmed: true, amount, currency: 'uah' };
    const prepared = buildImportDocuments(source, { Category, Product, mongoose });
    const product = prepared.products[0].document;
    assert.equal(product.pricing.salePrice, amount);
    assert.equal(product.pricing.rentalRates.length, 0);
    assert.doesNotMatch(product.importMeta.source, /price=0|currency=UAH/);
    assert.deepEqual(await validateImportDocuments(prepared), []);
  }
  assert.equal(mongoose.connection.readyState, 0);
});

const models = { Category, Product, mongoose };
const configuration = { target: 'test', uri: 'mongodb://offline.invalid/db-babyhub-test', dbName: TEST_DATABASE };
const prepare = () => buildImportDocuments(manifest(), models);

// An in-memory transactional double. No network connection or MongoDB writes occur.
const memoryDatabase = ({ target = 'test', databaseName = target === 'main' ? 'db-babyhub' : TEST_DATABASE, failProductInsert = false } = {}) => {
  const state = {
    categories: [], products: [], connected: 0, closed: 0, sessions: 0, ended: 0,
    inserts: 0, validationsBeforeFirstInsert: [],
  };
  let activeSession;
  const fakeModel = (ActualModel, collection) => {
    const Fake = function (payload) {
      const document = new ActualModel(payload);
      const validate = document.validate.bind(document);
      document.validate = async () => {
        if (!state.inserts) state.validationsBeforeFirstInsert.push(collection);
        return validate();
      };
      return document;
    };
    Fake.find = (filter) => {
      let session;
      let limit;
      return {
        session(value) { session = value; return this; },
        limit(value) { limit = value; return this; },
        async exec() {
          assert.equal(session, activeSession);
          if (state.hideExisting) return [];
          const get = (doc, key) => key.split('.').reduce((value, part) => value?.[part], doc);
          return state[collection].filter(doc => filter.$or.some(condition =>
            Object.entries(condition).every(([key, value]) => String(get(doc, key)) === String(value))
          )).slice(0, limit);
        },
      };
    };
    Fake.create = async (payloads, { session }) => {
      assert.equal(session, activeSession);
      if (collection === 'products' && failProductInsert) throw new Error('SIMULATED_INSERT_FAILURE');
      for (const payload of payloads) {
        if (state[collection].some(doc => String(doc._id) === String(payload._id))) {
          throw Object.assign(new Error('SIMULATED_DUPLICATE_ID'), { code: 11000 });
        }
        const doc = new ActualModel(payload);
        await doc.validate();
        state[collection].push(doc);
        state.inserts++;
      }
    };
    return Fake;
  };
  const boundModels = { Category: fakeModel(Category, 'categories'), Product: fakeModel(Product, 'products') };
  const connection = {
    db: { databaseName },
    model(name) { return boundModels[name]; },
    async close() { state.closed++; },
    async startSession() {
      state.sessions++;
      return {
        async withTransaction(callback) {
          const snapshot = { categories: [...state.categories], products: [...state.products] };
          activeSession = this;
          try { return await callback(); }
          catch (error) {
            state.categories = snapshot.categories;
            state.products = snapshot.products;
            throw error;
          } finally { activeSession = undefined; }
        },
        async endSession() { state.ended++; },
      };
    },
  };
  const options = {
    confirmed: true, target, confirmDatabase: target === 'main' ? 'db-babyhub' : undefined,
    configuration: { ...configuration, target, dbName: target === 'main' ? 'db-babyhub' : TEST_DATABASE },
    async openConnection(_models, config) {
      assert.equal(config.dbName, target === 'main' ? 'db-babyhub' : TEST_DATABASE);
      state.connected++;
      return connection;
    },
  };
  return { state, options };
};

test('конфігурація читає лише DB_HOST_TEST із кореневого .env та фіксує тестову базу', async () => {
  let readPath;
  const config = await loadImportConfiguration({ readFile: async (file) => {
    readPath = file;
    return 'DB_HOST=mongodb://main.invalid/main\nMONGODB_URI=mongodb://other.invalid/other\nDB_HOST_TEST=mongodb://test.invalid/db-babyhub-test\n';
  } });
  assert.match(String(readPath), /babyhub-02-frontend\/\.env$/);
  assert.equal(config.uri, 'mongodb://test.invalid/db-babyhub-test');
  assert.equal(config.dbName, 'db-babyhub-test');
  assert.equal(Object.isFrozen(config), true);
  for (const content of ['', 'DB_HOST=mongodb://main.invalid/main', 'DB_HOST_TEST=   ']) {
    await assert.rejects(loadImportConfiguration({ readFile: async () => content }), { code: 'DB_HOST_TEST_REQUIRED' });
  }
  await assert.rejects(loadImportConfiguration({ readFile: async () => { throw new Error('secret error'); } }),
    { code: 'TARGET_ENV_UNAVAILABLE', message: 'TARGET_ENV_UNAVAILABLE' });
});

test('опції ізольованого підключення перекривають базу з URI та вимикають autoCreate/autoIndex', async () => {
  let options;
  let closed = 0;
  const connection = { db: { databaseName: TEST_DATABASE }, async asPromise() {}, async close() { closed++; } };
  const fake = { mongoose: { createConnection(uri, opts) {
    assert.equal(uri, configuration.uri);
    options = opts;
    return connection;
  } } };
  assert.equal(await openTestConnection(fake, configuration), connection);
  assert.equal(options.dbName, TEST_DATABASE);
  assert.equal(options.autoCreate, false);
  assert.equal(options.autoIndex, false);
  const client = new mongoose.mongo.MongoClient(configuration.uri, { dbName: options.dbName });
  assert.equal(client.options.dbName, TEST_DATABASE);
  await client.close();
  connection.asPromise = async () => { throw new Error('SIMULATED_CONNECT_FAILURE'); };
  await assert.rejects(openTestConnection(fake, configuration), /SIMULATED_CONNECT_FAILURE/);
  assert.equal(closed, 1);
});

test('CLI має dry-run за замовчуванням і строго розбирає прапорець незалежно від позиції', () => {
  assert.equal(parseImportArguments([]).confirmed, false);
  for (const args of [['--target=test', '--confirm-import'], ['--target=test', '--confirm-import', 'input.json', 'output.json'],
    ['input.json', 'output.json', '--target=test', '--confirm-import']]) {
    const parsed = parseImportArguments(args);
    assert.equal(parsed.confirmed, true);
    assert.doesNotMatch(parsed.inputPath, /--confirm-import/);
    assert.doesNotMatch(parsed.outputPath, /--confirm-import/);
  }
  for (const args of [['--confirm'], ['--confirm-import', '--confirm-import'], ['a', 'b', 'c'], ['--dbName=production']]) {
    assert.throws(() => parseImportArguments(args), { code: 'INVALID_ARGUMENTS' });
  }
});

test('dry-run не підключається, не починає транзакцій і не створює документів', async () => {
  const memory = memoryDatabase();
  const result = await runPreparedImport(prepare(), models, { ...memory.options, target: undefined, confirmed: false });
  assert.deepEqual(result, { mode: 'dry-run', created: { categories: 0, products: 0 } });
  assert.equal(memory.state.connected, 0);
  assert.equal(memory.state.sessions, 0);
  assert.equal(memory.state.inserts, 0);
  assert.equal(memory.state.categories.length + memory.state.products.length, 0);
  assert.equal(mongoose.connection.readyState, 0);
  assert.equal((await runPreparedImport(prepare(), models)).mode, 'dry-run');
});

test('неправильна або невідома база блокується до підключення', async () => {
  for (const dbName of [undefined, '', 'test', 'db-babyhub', 'db-babyhub-test-legacy']) {
    assert.throws(() => assertTestDatabase(dbName), { code: 'UNSAFE_DATABASE' });
    const memory = memoryDatabase();
    await assert.rejects(runPreparedImport(prepare(), models, {
      ...memory.options, configuration: { ...configuration, dbName },
    }), { code: 'UNSAFE_DATABASE' });
    assert.equal(memory.state.connected, 0);
    assert.equal(memory.state.inserts, 0);
  }
});

test('фактична неправильна база блокує сесію та записи; з’єднання закривається', async () => {
  const memory = memoryDatabase({ databaseName: 'db-babyhub' });
  await assert.rejects(runPreparedImport(prepare(), models, memory.options), { code: 'UNSAFE_DATABASE' });
  assert.equal(memory.state.sessions, 0);
  assert.equal(memory.state.inserts, 0);
  assert.equal(memory.state.closed, 1);
});

test('тільки одна українська draft-пара з правильним зв’язком допускається до підключення', async () => {
  for (const change of [
    p => p.products.push(p.products[0]),
    p => p.categories.splice(0),
    p => { p.products[0].document.status = 'published'; },
    p => { p.products[0].record.locale = 'ru'; },
    p => { p.products[0].document.category = new mongoose.Types.ObjectId(); },
    p => { p.categories[0].document.importMeta.legacyUrl = undefined; },
  ]) {
    const prepared = prepare();
    change(prepared);
    assert.throws(() => assertImportScope(prepared));
    const memory = memoryDatabase();
    await assert.rejects(runPreparedImport(prepared, models, memory.options));
    assert.equal(memory.state.connected, 0);
  }
});

test('невалідний Mongoose-документ блокує підключення', async () => {
  const prepared = prepare();
  prepared.products[0].document.availability = 'invalid';
  const memory = memoryDatabase();
  await assert.rejects(runPreparedImport(prepared, models, memory.options), { code: 'INVALID_DOCUMENTS' });
  assert.equal(memory.state.connected, 0);
});

test('повторний запуск у симуляторі не дублює документи та зберігає зв’язок і defaults', async () => {
  const memory = memoryDatabase();
  const first = await runPreparedImport(prepare(), models, memory.options);
  assert.deepEqual(first.created, { categories: 1, products: 1 });
  assert.ok(memory.state.validationsBeforeFirstInsert.includes('categories'));
  assert.ok(memory.state.validationsBeforeFirstInsert.includes('products'));
  const before = JSON.stringify([memory.state.categories, memory.state.products]);
  const second = await runPreparedImport(prepare(), models, memory.options);
  assert.deepEqual(second.created, { categories: 0, products: 0 });
  assert.deepEqual(second.reused, { categories: 1, products: 1 });
  assert.equal(JSON.stringify([memory.state.categories, memory.state.products]), before);
  assert.equal(memory.state.inserts, 2);
  const category = memory.state.categories[0];
  const product = memory.state.products[0];
  assert.equal(String(product.category), String(category._id));
  assert.equal(product.availability, 'in_stock');
  assert.equal(product.pricing.currency, 'UAH');
  assert.equal(product.pricing.rentalRates.length, 0);
  assert.equal(product.status, 'draft');
  assert.equal(category.status, 'draft');
  assert.equal(memory.state.closed, 2);
  assert.equal(memory.state.ended, 2);
});

test('наявна категорія повторно використовується з її справжнім ObjectId', async () => {
  const memory = memoryDatabase();
  const existing = prepare().categories[0].document;
  memory.state.categories.push(existing);
  const result = await runPreparedImport(prepare(), models, memory.options);
  assert.deepEqual(result.created, { categories: 0, products: 1 });
  assert.equal(result.categoryId, String(existing._id));
  assert.equal(String(memory.state.products[0].category), String(existing._id));
});

test('конфлікти ідентичності та неправильний зв’язок наявного товару блокують усі вставки', async () => {
  for (const scenario of ['duplicate', 'slug-conflict', 'url-conflict', 'published', 'link']) {
    const memory = memoryDatabase();
    const prepared = prepare();
    const category = prepared.categories[0].document;
    const product = prepared.products[0].document;
    if (scenario === 'duplicate') memory.state.categories.push(category, new Category(category.toObject()));
    if (scenario === 'slug-conflict') {
      category.importMeta.legacyUrl = 'https://other.example/category';
      memory.state.categories.push(category);
    }
    if (scenario === 'url-conflict') {
      category.slug.uk = 'other-slug';
      memory.state.categories.push(category);
    }
    if (scenario === 'published') {
      category.status = 'published';
      memory.state.categories.push(category);
    }
    if (scenario === 'link') memory.state.products.push(product);
    const before = JSON.stringify([memory.state.categories, memory.state.products]);
    await assert.rejects(runPreparedImport(prepare(), models, memory.options));
    assert.equal(memory.state.inserts, 0);
    assert.equal(JSON.stringify([memory.state.categories, memory.state.products]), before);
    assert.equal(memory.state.closed, 1);
    assert.equal(memory.state.ended, 1);
  }
});

test('помилка вставки товару відкочує категорію в симуляторі транзакції', async () => {
  const memory = memoryDatabase({ failProductInsert: true });
  await assert.rejects(runPreparedImport(prepare(), models, memory.options), /SIMULATED_INSERT_FAILURE/);
  assert.equal(memory.state.categories.length, 0);
  assert.equal(memory.state.products.length, 0);
  assert.equal(memory.state.closed, 1);
  assert.equal(memory.state.ended, 1);
});

test('стабільні ObjectId блокують дублікати навіть коли читання не бачить попередню вставку', async () => {
  const memory = memoryDatabase();
  await runPreparedImport(prepare(), models, memory.options);
  const before = JSON.stringify([memory.state.categories, memory.state.products]);
  memory.state.hideExisting = true;
  await assert.rejects(runPreparedImport(prepare(), models, memory.options), { code: 11000 });
  assert.equal(JSON.stringify([memory.state.categories, memory.state.products]), before);
  assert.equal(memory.state.categories.length, 1);
  assert.equal(memory.state.products.length, 1);
});

test('main dry-run перевіряє конфлікти без сесій/вставок; захист запису діє й поза CLI', async () => {
  const memory = memoryDatabase({ target: 'main' });
  for (const override of [{ target: undefined }, { confirmDatabase: undefined }, { confirmDatabase: 'db-babyhub-test' }]) {
    await assert.rejects(runPreparedImport(prepare(), models, { ...memory.options, ...override }));
    assert.equal(memory.state.connected, 0);
  }
  const plan = await runPreparedImport(prepare(), models, { ...memory.options, confirmed: false });
  assert.deepEqual(plan.planned, { categories: 'create-draft', products: 'create-draft' });
  assert.equal(plan.database, 'db-babyhub');
  assert.equal(memory.state.sessions, 0);
  assert.equal(memory.state.inserts, 0);
  const conflict = prepare().categories[0].document;
  conflict.status = 'published';
  memory.state.categories.push(conflict);
  await assert.rejects(runPreparedImport(prepare(), models, { ...memory.options, confirmed: false }),
    { code: 'EXISTING_DOCUMENT_CONFLICT' });
  assert.equal(memory.state.inserts, 0);
});

test('main і test мають різні стабільні ID; main повторний запис і rollback перевіряються тільки в пам’яті', async () => {
  const main = memoryDatabase({ target: 'main' });
  const test = memoryDatabase();
  const a = await runPreparedImport(prepare(), models, main.options);
  const b = await runPreparedImport(prepare(), models, test.options);
  assert.notEqual(a.productId, b.productId);
  assert.notEqual(a.categoryId, b.categoryId);
  const repeated = await runPreparedImport(prepare(), models, main.options);
  assert.deepEqual(repeated.reused, { categories: 1, products: 1 });
  assert.deepEqual(repeated.created, { categories: 0, products: 0 });
  const broken = memoryDatabase({ target: 'main', failProductInsert: true });
  await assert.rejects(runPreparedImport(prepare(), models, broken.options));
  assert.equal(broken.state.categories.length + broken.state.products.length, 0);
});
