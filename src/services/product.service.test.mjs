import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL?.startsWith('file:')) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
  }
  return next(specifier, context);
} });
const oldUri = process.env.DB_HOST;
process.env.DB_HOST = 'mongodb://offline.invalid/db-babyhub';
const [{ default: Category }, { default: Product }, { default: Media }, { getProductBySlug }] = await Promise.all([
  import('../models/Category.ts'), import('../models/Product.ts'), import('../models/Media.ts'), import('./product.service.ts'),
]);
if (oldUri === undefined) delete process.env.DB_HOST;
else process.env.DB_HOST = oldUri;

test('public product details resolve Media only after published category/product checks', async (t) => {
  const originals = { connect: mongoose.connect, category: Category.findOne, product: Product.findOne, media: Media.find };
  const categoryId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const first = new mongoose.Types.ObjectId();
  const second = new mongoose.Types.ObjectId();
  const missing = new mongoose.Types.ObjectId();
  let categoryStatus = 'published';
  let productStatus = 'published';
  let mediaReads = 0;
  const query = value => ({ select() { return this; }, lean() { return this; }, async exec() { return value; } });
  mongoose.connect = async () => mongoose; // No connection, network or mutation methods in this fixture.
  Category.findOne = filter => {
    assert.equal(filter.status, 'published');
    assert.equal(filter['slug.uk'], 'avtokrisla');
    return query(categoryStatus === 'published' ? { _id: categoryId } : null);
  };
  Product.findOne = filter => {
    assert.equal(filter.status, 'published');
    assert.equal(filter.category, categoryId);
    assert.equal(filter['slug.uk'], 'avtokreslo-adbor-capri');
    return query(productStatus === 'published' ? { _id: productId, category: categoryId,
      name: { uk: 'Adbor Capri' }, slug: { uk: 'avtokreslo-adbor-capri' }, status: productStatus,
      images: [first, missing, second], pricing: { currency: 'UAH', rentalRates: [] } } : null);
  };
  Media.find = filter => {
    mediaReads++;
    assert.deepEqual(filter, { _id: { $in: [first, missing, second] } });
    return query([
      { _id: second, url: 'https://res.cloudinary.com/dmvl4lxnq/image/upload/second.jpg', width: 200, height: 300 },
      { _id: first, url: 'https://res.cloudinary.com/dmvl4lxnq/image/upload/first.jpg', width: 249, height: 270, alt: { uk: 'Автокрісло' } },
    ]);
  };
  try {
    await t.test('draft category is hidden before reading Media', async () => {
      categoryStatus = 'draft';
      assert.equal(await getProductBySlug('avtokrisla', 'avtokreslo-adbor-capri'), null);
      assert.equal(mediaReads, 0);
    });
    await t.test('draft product is hidden before reading Media', async () => {
      categoryStatus = 'published'; productStatus = 'draft';
      assert.equal(await getProductBySlug('avtokrisla', 'avtokreslo-adbor-capri'), null);
      assert.equal(mediaReads, 0);
    });
    await t.test('Media order follows Product.images; missing Media is skipped; no price is invented', async () => {
      productStatus = 'published';
      const product = await getProductBySlug('avtokrisla', 'avtokreslo-adbor-capri');
      assert.deepEqual(product.images, [first, missing, second].map(String));
      assert.deepEqual(product.media.map(image => image.id), [first, second].map(String));
      assert.equal(product.media[0].width, 249);
      assert.equal(product.media[0].alt.uk, 'Автокрісло');
      assert.equal(product.media[0].url, 'https://res.cloudinary.com/dmvl4lxnq/image/upload/first.jpg');
      assert.equal(product.pricing.salePrice, null);
      assert.deepEqual(product.pricing.rentalRates, []);
      assert.equal(mediaReads, 1);
    });
  } finally {
    mongoose.connect = originals.connect;
    Category.findOne = originals.category;
    Product.findOne = originals.product;
    Media.find = originals.media;
  }
});
