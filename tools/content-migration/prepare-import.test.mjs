import assert from 'node:assert/strict';
import test from 'node:test';
import { buildImportDocuments, validateImportDocuments } from './prepare-import.mjs';
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
