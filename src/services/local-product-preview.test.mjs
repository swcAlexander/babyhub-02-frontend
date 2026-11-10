import assert from 'node:assert/strict';
import test from 'node:test';
import mongoose from 'mongoose';
import { getLocalProductPreview } from './local-product-preview.service.ts';

const productId = '1e9f418c65cc80c3d3a56184';
const mediaId = '2f19079efd10749817072a2d';
const env = { NODE_ENV: 'development', DB_HOST_TEST: 'mongodb://localhost/db-babyhub-test' };

test('preview safety and Product.images → Media, without network or writes', async (t) => {
  const original = mongoose.createConnection;
  let connections = 0;
  let closed = 0;
  let reads = [];
  let actualDatabase = 'db-babyhub-test';
  let imageIds = [new mongoose.Types.ObjectId(mediaId)];
  mongoose.createConnection = (uri, options) => {
    connections++;
    assert.equal(uri, env.DB_HOST_TEST);
    assert.equal(options.dbName, 'db-babyhub-test');
    assert.equal(options.autoCreate, false);
    assert.equal(options.autoIndex, false);
    return {
      async asPromise() {},
      async close() { closed++; },
      db: {
        databaseName: actualDatabase,
        collection(name) {
          // No mutation methods exist on this fixture.
          return { async findOne(filter) {
            reads.push(name);
            if (name === 'products') {
              assert.equal(filter._id.toString(), productId);
              assert.equal(filter['slug.uk'], 'avtokreslo-adbor-capri');
              assert.equal(filter.status, 'draft');
              return { _id: filter._id, name: { uk: 'Adbor Capri' }, images: imageIds,
                category: new mongoose.Types.ObjectId('1b04529bcd47ae89a17fdad1') };
            }
            if (name === 'categories') {
              assert.equal(filter.status, 'draft');
              return { _id: filter._id };
            }
            assert.equal(name, 'media');
            assert.equal(filter._id.toString(), mediaId);
            return { url: 'https://res.cloudinary.com/dmvl4lxnq/image/upload/photo.jpg', width: 249, height: 270 };
          } };
        },
      },
    };
  };
  try {
    await t.test('production/test return null before connecting, even with invalid URI', async () => {
      for (const mode of ['production', 'test', undefined]) {
        assert.equal(await getLocalProductPreview({ NODE_ENV: mode, DB_HOST_TEST: 'invalid' }), null);
      }
      assert.equal(connections, 0);
    });
    await t.test('missing URI, main database and malformed URI fail before connecting; DB_HOST is ignored', async () => {
      for (const uri of [undefined, '', 'invalid', 'https://localhost/db-babyhub-test', 'mongodb://localhost/db-babyhub']) {
        await assert.rejects(getLocalProductPreview({ ...env, DB_HOST_TEST: uri, DB_HOST: env.DB_HOST_TEST }), /requires DB_HOST_TEST/);
      }
      assert.equal(connections, 0);
    });
    await t.test('actual database mismatch blocks all reads and closes connection', async () => {
      actualDatabase = 'db-babyhub';
      await assert.rejects(getLocalProductPreview(env), /could not read/);
      assert.deepEqual(reads, []);
      assert.equal(closed, 1);
      actualDatabase = 'db-babyhub-test';
    });
    await t.test('fixed draft product resolves its linked Media URL and dimensions', async () => {
      const product = await getLocalProductPreview(env);
      assert.equal(product.id, productId);
      assert.equal(product.image.url, 'https://res.cloudinary.com/dmvl4lxnq/image/upload/photo.jpg');
      assert.equal(product.image.width, 249);
      assert.equal(product.image.height, 270);
      assert.deepEqual(reads, ['products', 'categories', 'media']);
      assert.equal(closed, 2);
    });
    await t.test('unlinked Media is never read', async () => {
      reads = [];
      imageIds = [];
      assert.equal(await getLocalProductPreview(env), null);
      assert.deepEqual(reads, ['products', 'categories']);
      assert.equal(closed, 3);
    });
  } finally {
    mongoose.createConnection = original;
  }
});
