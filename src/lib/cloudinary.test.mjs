import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryServiceError, createCloudinaryService } from './cloudinary.ts';
import legacyCloudinary from '../app/api/helpers/cloudinary.js';

const env = {
  CLOUDINARY_CLOUD_NAME: 'test-cloud',
  CLOUDINARY_API_KEY: '123456',
  CLOUDINARY_APY_KEY: '999999',
  CLOUDINARY_API_SECRET: 'test-secret-never-log',
};
const response = {
  public_id: 'migration/image', resource_type: 'image',
  secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/image.jpg',
  url: 'http://res.cloudinary.com/test-cloud/image/upload/image.jpg',
  width: 640, height: 480, bytes: 1024, format: 'jpg',
  signature: 'must-not-be-returned', api_secret: env.CLOUDINARY_API_SECRET,
};
const fixture = (overrides = {}) => {
  const calls = [];
  const sdk = {
    uploader: {
      async upload(...args) { calls.push(['upload', ...args]); return overrides.upload ?? response; },
      async destroy(...args) { calls.push(['destroy', ...args]); return overrides.destroy ?? { result: 'ok' }; },
    },
    api: { async resource(...args) { calls.push(['resource', ...args]); return overrides.resource ?? response; } },
  };
  return { sdk, calls, service: createCloudinaryService({ env: { ...env }, sdk }) };
};

test('конфігурація лінива; перевірка повертає лише безпечну ознаку та назву ключа', () => {
  assert.doesNotThrow(() => createCloudinaryService({ env: {} }));
  const { service, calls } = fixture();
  assert.deepEqual(service.checkConfiguration(), { configured: true, apiKeyVariable: 'CLOUDINARY_API_KEY' });
  assert.equal(calls.length, 0);
  assert.doesNotMatch(JSON.stringify(service.checkConfiguration()), /123456|test-secret|test-cloud/);
});

test('основний API_KEY має пріоритет; APY_KEY підтримується як fallback', async () => {
  for (const [primary, legacy, expected, variable] of [
    [' 123456 ', '999999', '123456', 'CLOUDINARY_API_KEY'],
    [undefined, ' 999999 ', '999999', 'CLOUDINARY_APY_KEY'],
    ['  ', '999999', '999999', 'CLOUDINARY_APY_KEY'],
  ]) {
    const { sdk, calls } = fixture();
    const service = createCloudinaryService({ env: {
      ...env, CLOUDINARY_API_KEY: primary, CLOUDINARY_APY_KEY: legacy,
    }, sdk });
    assert.equal(service.checkConfiguration().apiKeyVariable, variable);
    await service.getImageInfo('migration/image');
    assert.equal(calls[0][2].api_key, expected);
  }
});

test('неповна конфігурація блокує всі операції до SDK без розкриття значень', async () => {
  for (const missing of ['cloud', 'keys', 'secret']) {
    const config = { ...env };
    if (missing === 'cloud') config.CLOUDINARY_CLOUD_NAME = ' ';
    if (missing === 'keys') { config.CLOUDINARY_API_KEY = ''; config.CLOUDINARY_APY_KEY = ''; }
    if (missing === 'secret') config.CLOUDINARY_API_SECRET = '';
    const { sdk, calls } = fixture();
    const service = createCloudinaryService({ env: config, sdk });
    assert.throws(() => service.checkConfiguration(), { code: 'CLOUDINARY_NOT_CONFIGURED' });
    for (const operation of ['uploadImage', 'getImageInfo', 'deleteImage']) {
      await assert.rejects(service[operation]('migration/image'), error => {
        assert.equal(error.code, 'CLOUDINARY_NOT_CONFIGURED');
        assert.doesNotMatch(error.message, /test-secret|123456|999999/);
        return true;
      });
    }
    assert.equal(calls.length, 0);
  }
});

test('завантаження має HTTPS, image та overwrite=false; відповідь містить лише метадані', async () => {
  const { service, calls } = fixture();
  const image = await service.uploadImage(' /tmp/image.jpg ', {
    folder: ' migration ', public_id: ' migration/image ',
    overwrite: true, resource_type: 'video', api_secret: 'injected-secret', cloud_name: 'injected-cloud',
  });
  assert.equal(calls[0][0], 'upload');
  assert.equal(calls[0][1], '/tmp/image.jpg');
  assert.deepEqual(calls[0][2], {
    cloud_name: 'test-cloud', api_key: '123456', api_secret: env.CLOUDINARY_API_SECRET,
    secure: true, resource_type: 'image', type: 'upload',
    folder: 'migration', public_id: 'migration/image', overwrite: false,
  });
  assert.equal(image.url, image.secure_url);
  assert.deepEqual(Object.keys(image).sort(), ['public_id', 'secure_url', 'url', 'width', 'height', 'bytes', 'format'].sort());
  assert.doesNotMatch(JSON.stringify(image), /test-secret|must-not-be-returned/);
});

test('отримання метаданих викликає лише image resource за public_id', async () => {
  const { service, calls } = fixture();
  const image = await service.getImageInfo(' migration/image ');
  assert.equal(image.public_id, 'migration/image');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'resource');
  assert.equal(calls[0][1], 'migration/image');
  assert.equal(calls[0][2].resource_type, 'image');
  assert.equal(calls[0][2].type, 'upload');
});

test('видалення за public_id обробляє ok і not found, без реальних запитів', async () => {
  for (const result of ['ok', 'not found']) {
    const { service, calls } = fixture({ destroy: { result } });
    assert.deepEqual(await service.deleteImage('migration/image'), { result });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'destroy');
    assert.equal(calls[0][1], 'migration/image');
    assert.equal(calls[0][2].invalidate, true);
    assert.equal(calls[0][2].resource_type, 'image');
  }
});

test('порожні або некоректні аргументи не доходять до SDK', async () => {
  const { service, calls } = fixture();
  for (const value of ['', '  ', undefined, null, 123]) {
    for (const operation of ['uploadImage', 'getImageInfo', 'deleteImage']) {
      await assert.rejects(service[operation](value), { code: 'CLOUDINARY_INVALID_INPUT', status: 400 });
    }
  }
  for (const options of [{ folder: ' ' }, { public_id: '' }]) {
    await assert.rejects(service.uploadImage('image.jpg', options), { code: 'CLOUDINARY_INVALID_INPUT' });
  }
  assert.equal(calls.length, 0);
});

test('помилки SDK не зберігають секретів, signed URL або cause', async () => {
  const rawError = Object.assign(new Error('secret: test-secret-never-log https://example.test/?signature=private'), {
    http_code: 401, request: { api_secret: env.CLOUDINARY_API_SECRET },
  });
  const fail = async () => { throw rawError; };
  const service = createCloudinaryService({ env, sdk: {
    uploader: { upload: fail, destroy: fail }, api: { resource: fail },
  } });
  for (const operation of ['uploadImage', 'getImageInfo', 'deleteImage']) {
    await assert.rejects(service[operation]('migration/image'), error => {
      assert.ok(error instanceof CloudinaryServiceError);
      assert.equal(error.code, 'CLOUDINARY_REQUEST_FAILED');
      assert.equal(error.status, 401);
      assert.equal(error.cause, undefined);
      assert.equal(error.request, undefined);
      assert.doesNotMatch(JSON.stringify(error) + error.stack, /test-secret|signature=private|example\.test/);
      return true;
    });
  }
});

test('мережеві помилки без HTTP-коду нормалізуються до 502', async () => {
  const { sdk } = fixture();
  sdk.api.resource = async () => { throw { message: 'private network details', http_code: NaN }; };
  await assert.rejects(createCloudinaryService({ env, sdk }).getImageInfo('id'), {
    code: 'CLOUDINARY_REQUEST_FAILED', status: 502, message: 'Cloudinary resource lookup failed.',
  });
});

test('404 верхнього і вкладеного рівнів зберігаються без сирої SDK-помилки', async () => {
  for (const raw of [
    { http_code: 404, message: 'private upload error' },
    { error: { http_code: 404, message: 'private admin error' },
      request_options: { api_secret: env.CLOUDINARY_API_SECRET }, query_params: { signature: 'private-signature' } },
    { http_code: 404, error: { http_code: 404 } },
  ]) {
    const { sdk } = fixture();
    sdk.api.resource = async () => { throw raw; };
    await assert.rejects(createCloudinaryService({ env, sdk }).getImageInfo('id'), error => {
      assert.ok(error instanceof CloudinaryServiceError);
      assert.equal(error.code, 'CLOUDINARY_REQUEST_FAILED');
      assert.equal(error.status, 404);
      assert.equal(error.cause, undefined);
      assert.equal(error.request_options, undefined);
      assert.doesNotMatch(JSON.stringify(error) + error.stack, /test-secret|private-signature|private admin error|private upload error/);
      return true;
    });
  }
});

test('авторизація, мережеві, некоректні та суперечливі помилки не стають 404', async () => {
  for (const [raw, expected] of [
    [{ http_code: 401 }, 401], [{ error: { http_code: 401 } }, 401],
    [{ error: { http_code: 403 } }, 403], [{ error: { http_code: 429 } }, 429],
    [{ error: { http_code: 500 } }, 500],
    [Object.assign(new Error('network timeout 404'), { code: 'ETIMEDOUT' }), 502],
    [Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }), 502],
    [null, 502], ['404', 502], [{ status: 404 }, 502],
    [{ error: { http_code: '404' } }, 502], [{ http_code: '404' }, 502],
    [{ error: { http_code: NaN } }, 502], [{ error: { http_code: 404.5 } }, 502],
    [{ error: { http_code: 200 } }, 502], [{ error: { http_code: 600 } }, 502],
    [{ http_code: 401, error: { http_code: 404 } }, 502],
    [{ http_code: 404, error: { http_code: 403 } }, 502],
    [{ http_code: '401', error: { http_code: 404 } }, 502],
  ]) {
    const { sdk } = fixture();
    sdk.api.resource = async () => { throw raw; };
    await assert.rejects(createCloudinaryService({ env, sdk }).getImageInfo('id'), {
      code: 'CLOUDINARY_REQUEST_FAILED', status: expected,
    });
  }
});

test('невалідні image metadata та небезпечна URL-відповідь відхиляються', async () => {
  for (const invalid of [
    {}, { ...response, resource_type: 'video' }, { ...response, secure_url: 'http://example.test/image.jpg' },
    { ...response, secure_url: 'https://user:password@example.test/image.jpg' },
    { ...response, width: 0 }, { ...response, height: NaN }, { ...response, bytes: -1 },
    { ...response, public_id: '' }, { ...response, format: '' },
  ]) {
    const { service } = fixture({ upload: invalid, resource: invalid });
    await assert.rejects(service.uploadImage('image.jpg'), { code: 'CLOUDINARY_INVALID_RESPONSE' });
    await assert.rejects(service.getImageInfo('id'), { code: 'CLOUDINARY_INVALID_RESPONSE' });
  }
});

test('неочікуваний результат видалення не видається за успіх', async () => {
  const { service } = fixture({ destroy: { result: 'error', message: env.CLOUDINARY_API_SECRET } });
  await assert.rejects(service.deleteImage('id'), {
    code: 'CLOUDINARY_INVALID_RESPONSE', status: 502, message: 'Cloudinary returned an invalid deletion result.',
  });
});

test('різні конфігурації не змінюють глобальний стан SDK і не змішують credentials', async () => {
  const before = { ...cloudinary.config() };
  const { sdk, calls } = fixture();
  const first = createCloudinaryService({ env, sdk });
  const second = createCloudinaryService({ env: { ...env, CLOUDINARY_API_KEY: '654321' }, sdk });
  await Promise.all([first.getImageInfo('first'), second.getImageInfo('second')]);
  assert.equal(calls[0][2].api_key, '123456');
  assert.equal(calls[1][2].api_key, '654321');
  assert.deepEqual(cloudinary.config(), before);
});

test('legacy helper зберігає uploader.upload без експорту сирого SDK', () => {
  assert.equal(typeof legacyCloudinary.uploader.upload, 'function');
  assert.equal(legacyCloudinary.config, undefined);
  assert.equal(legacyCloudinary.api, undefined);
});

test('server-only блокує імпорт без серверної умови виконання', () => {
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e',
    "await import('./src/lib/cloudinary.ts');"], {
    cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /cannot be imported from a Client Component/);
});
