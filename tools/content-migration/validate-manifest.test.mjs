import assert from 'node:assert/strict';
import test from 'node:test';
import { validateManifest, validateManifestJson } from './validate-manifest.mjs';

const category = () => ({
  sourcePageKey: 'page:uk:category:seats',
  entityKey: 'entity:category:uk:seats',
  localeMatch: 'unconfirmed',
  legacyUrl: 'https://legacy.example/seats.html',
  normalizedUrl: '/seats.html',
  locale: 'uk',
  name: { uk: 'Дитячі крісла', ru: null },
  slug: { uk: 'seats', ru: null },
  status: 'accept',
  issues: [],
  evidence: [{ url: 'https://legacy.example/seats.html', sourceType: 'html' }],
});

const product = () => ({
  sourcePageKey: 'page:uk:product:seat-one',
  entityKey: 'entity:product:uk:seat-one',
  localeMatch: 'unconfirmed',
  legacyUrl: 'https://legacy.example/seats/seat-one.html',
  normalizedUrl: '/seats/seat-one.html',
  locale: 'uk',
  categoryEntityKey: 'entity:category:uk:seats',
  name: { uk: 'Крісло один', ru: null },
  slug: { uk: 'seat-one', ru: null },
  imageLegacyUrls: [],
  pricingRaw: {
    type: 'sale',
    amount: 1000,
    currency: 'UAH',
    isConfirmed: true,
  },
  availabilityRaw: {
    normalized: 'in_stock',
    confidence: 'confirmed',
  },
  status: 'accept',
  issues: [],
  evidence: [{ url: 'https://legacy.example/seats/seat-one.html', sourceType: 'html' }],
});

const manifest = () => ({
  manifestVersion: '0.1.0',
  generatedAt: '2026-11-10T00:00:00.000Z',
  source: {
    kind: 'public-legacy-site',
    rootUrl: 'https://legacy.example/',
    notes: [],
  },
  categories: [category()],
  products: [product()],
  media: [],
  pages: [],
});

const recordResult = (report, collection, index = 0) =>
  report.migrationReadiness.records.find((record) => record.collection === collection && record.index === index);

test('підтверджений Product проходить обидва рівні перевірки', () => {
  const report = validateManifest(manifest());
  const result = recordResult(report, 'products');

  assert.equal(report.structuralValidation.status, 'valid');
  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.readinessStatus, 'accept');
  assert.equal(result.status, 'accept');
});

test('непідтверджена ціна дає review без структурної помилки', () => {
  const candidate = manifest();
  candidate.products[0].pricingRaw.isConfirmed = false;
  const report = validateManifest(candidate);
  const result = recordResult(report, 'products');

  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.status, 'review');
  assert.ok(result.issues.some((issue) => issue.code === 'PRICE_NOT_CONFIRMED'));
});

test('неповна орендна ціна отримує окремі причини і не перетворюється на salePrice', () => {
  const candidate = manifest();
  candidate.products[0].pricingRaw = {
    type: 'rental',
    isConfirmed: false,
    amount: null,
    currency: null,
    periodDays: null,
    unit: null,
  };
  const result = recordResult(validateManifest(candidate), 'products');
  const codes = result.issues.map((issue) => issue.code);

  assert.ok(codes.includes('PRICE_NOT_CONFIRMED'));
  assert.ok(codes.includes('PRICE_AMOUNT_MISSING'));
  assert.ok(codes.includes('PRICE_CURRENCY_UNCONFIRMED'));
  assert.ok(codes.includes('RENTAL_PERIOD_UNCONFIRMED'));
  assert.ok(codes.includes('RENTAL_UNIT_UNCONFIRMED'));
  assert.equal(Object.hasOwn(candidate.products[0].pricingRaw, 'salePrice'), false);
});

test('відсутня підтверджена availability дає review', () => {
  const candidate = manifest();
  candidate.products[0].availabilityRaw = { normalized: null, confidence: 'unknown' };
  const result = recordResult(validateManifest(candidate), 'products');

  assert.equal(result.status, 'review');
  assert.ok(result.issues.some((issue) => issue.code === 'AVAILABILITY_UNCONFIRMED'));
});

test('uk/ru пара без доказів не зливається; кожен статус лишається незалежним від структурних помилок', () => {
  const candidate = manifest();
  candidate.products.push({
    ...product(),
    sourcePageKey: 'page:ru:product:seat-one',
    legacyUrl: 'https://legacy.example/ru/seats/seat-one.html',
    normalizedUrl: '/ru/seats/seat-one.html',
    locale: 'ru',
    name: { uk: null, ru: 'Крісло один' },
    slug: { uk: null, ru: 'seat-one' },
  });
  const report = validateManifest(candidate);
  const uk = recordResult(report, 'products', 0);
  const ru = recordResult(report, 'products', 1);

  assert.equal(uk.status, 'review');
  assert.equal(ru.status, 'reject');
  assert.equal(ru.structuralStatus, 'invalid');
  assert.equal(uk.identity.localeMatch, 'unconfirmed');
  assert.equal(uk.identity.effectiveEntityKey, null);
  assert.ok(uk.issues.some((issue) => issue.code === 'UNCONFIRMED_LOCALE_PAIR'));
});

test('явне ручне підтвердження дозволяє підтвердити localeMatch', () => {
  const candidate = manifest();
  const evidence = {
    verified: true,
    method: 'manual',
    reference: 'manual-check-2026-11-10-01',
  };
  candidate.products[0].evidence.push({
    id: evidence.reference,
    url: candidate.products[0].legacyUrl,
    sourceType: 'manual',
  });
  candidate.products[0].localeMatch = 'confirmed';
  candidate.products[0].localeMatchEvidence = evidence;
  candidate.products.push({
    ...product(),
    sourcePageKey: 'page:ru:product:seat-one',
    legacyUrl: 'https://legacy.example/ru/seats/seat-one.html',
    normalizedUrl: '/ru/seats/seat-one.html',
    locale: 'ru',
    localeMatch: 'confirmed',
    localeMatchEvidence: evidence,
    evidence: [{
      id: evidence.reference,
      url: 'https://legacy.example/ru/seats/seat-one.html',
      sourceType: 'manual',
    }],
    name: { uk: null, ru: 'Крісло один' },
    slug: { uk: 'seat-one', ru: 'seat-one' },
  });
  const report = validateManifest(candidate);
  const uk = recordResult(report, 'products', 0);

  assert.equal(uk.identity.localeMatch, 'confirmed');
  assert.equal(uk.identity.effectiveEntityKey, 'entity:product:uk:seat-one');
  assert.equal(uk.issues.some((issue) => issue.code === 'UNCONFIRMED_LOCALE_PAIR'), false);
});

test('самостійний український Product не потребує російської версії', () => {
  const result = recordResult(validateManifest(manifest()), 'products');

  assert.equal(result.status, 'accept');
  assert.equal(result.issues.some((issue) => issue.code === 'UNCONFIRMED_LOCALE_PAIR'), false);
});

test('localeMatch confirmed без підтвердженої пари скидається до unconfirmed', () => {
  const candidate = manifest();
  candidate.products[0].localeMatch = 'confirmed';
  const result = recordResult(validateManifest(candidate), 'products');

  assert.equal(result.status, 'review');
  assert.equal(result.identity.localeMatch, 'unconfirmed');
  assert.equal(result.identity.effectiveEntityKey, null);
  assert.ok(result.issues.some((issue) => issue.code === 'LOCALE_MATCH_EVIDENCE_MISSING'));
});

test('дублікат sourcePageKey призводить до reject обох записів', () => {
  const candidate = manifest();
  candidate.products.push({
    ...product(),
    entityKey: 'entity:product:uk:seat-two',
    legacyUrl: 'https://legacy.example/seats/seat-two.html',
    normalizedUrl: '/seats/seat-two.html',
  });
  const report = validateManifest(candidate);

  assert.equal(report.structuralValidation.status, 'invalid');
  assert.equal(recordResult(report, 'products', 0).status, 'reject');
  assert.equal(recordResult(report, 'products', 1).status, 'reject');
  assert.ok(report.structuralValidation.errors.some((error) => error.code === 'DUPLICATE_SOURCE_PAGE_KEY'));
});

test('конфлікт entityKey у межах однієї мови призводить до reject', () => {
  const candidate = manifest();
  candidate.products.push({
    ...product(),
    sourcePageKey: 'page:uk:product:seat-two',
    legacyUrl: 'https://legacy.example/seats/seat-two.html',
    normalizedUrl: '/seats/seat-two.html',
  });
  const report = validateManifest(candidate);

  assert.equal(recordResult(report, 'products', 0).status, 'reject');
  assert.equal(recordResult(report, 'products', 1).status, 'reject');
  assert.ok(report.structuralValidation.errors.some((error) => error.code === 'ENTITY_KEY_CONFLICT'));
});

test('відсутній slug.uk у Category та Product є structural reject', () => {
  const candidate = manifest();
  candidate.categories[0].slug = { uk: null, ru: 'seats' };
  candidate.products[0].slug = { uk: null, ru: 'seat-one' };
  const report = validateManifest(candidate);

  assert.equal(report.structuralValidation.status, 'invalid');
  assert.equal(recordResult(report, 'categories').status, 'reject');
  assert.equal(recordResult(report, 'products').status, 'reject');
  assert.ok(report.structuralValidation.errors.filter((error) => error.code === 'REQUIRED_TARGET_FIELD_MISSING').length === 2);
});

test('Media без MIME, width, height та checksum не отримує reject', () => {
  const candidate = manifest();
  const mediaUrl = 'https://legacy.example/images/seat.jpg';
  candidate.products[0].imageLegacyUrls = [mediaUrl];
  candidate.media.push({
    sourcePageKey: 'page:uk:product:seat-one',
    entityKey: 'entity:media:seat-one',
    legacyUrl: mediaUrl,
    normalizedUrl: mediaUrl,
    filename: 'seat.jpg',
    storageType: 'local',
    linkedProductEntityKeys: ['entity:product:uk:seat-one'],
    linkedCategoryEntityKeys: [],
    availability: 'unknown',
    issues: [],
    evidence: [{ url: mediaUrl, sourceType: 'html' }],
    status: 'accept',
  });
  const result = recordResult(validateManifest(candidate), 'media');

  assert.equal(result.structuralStatus, 'valid');
  assert.notEqual(result.status, 'reject');
});

test('відсутній у manifest filename дає лише readiness review для моделі Media', () => {
  const candidate = manifest();
  const mediaUrl = 'https://legacy.example/images/seat.jpg';
  candidate.products[0].imageLegacyUrls = [mediaUrl];
  candidate.media.push({
    sourcePageKey: 'page:uk:product:seat-one',
    legacyUrl: mediaUrl,
    normalizedUrl: mediaUrl,
    storageType: 'local',
    linkedProductEntityKeys: ['entity:product:uk:seat-one'],
    linkedCategoryEntityKeys: [],
    availability: 'unknown',
    issues: [],
    evidence: [{ url: mediaUrl, sourceType: 'html' }],
    status: 'accept',
  });
  const report = validateManifest(candidate);
  const result = recordResult(report, 'media');

  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.status, 'review');
  assert.ok(result.issues.some((issue) => issue.code === 'MEDIA_FILENAME_MISSING'));
});

test('відсутній storageType дає readiness review без structural reject', () => {
  const candidate = manifest();
  const mediaUrl = 'https://legacy.example/images/seat.jpg';
  candidate.products[0].imageLegacyUrls = [mediaUrl];
  candidate.media.push({
    sourcePageKey: 'page:uk:product:seat-one',
    legacyUrl: mediaUrl,
    normalizedUrl: mediaUrl,
    filename: 'seat.jpg',
    linkedProductEntityKeys: ['entity:product:uk:seat-one'],
    linkedCategoryEntityKeys: [],
    availability: 'unknown',
    issues: [],
    evidence: [{ url: mediaUrl, sourceType: 'html' }],
    status: 'accept',
  });
  const report = validateManifest(candidate);
  const result = recordResult(report, 'media');

  assert.equal(result.structuralStatus, 'valid');
  assert.equal(result.status, 'review');
  assert.ok(result.issues.some((issue) => issue.code === 'MEDIA_STORAGE_TYPE_UNCONFIRMED'));
});

test('дублікат URL Media потребує review для явної дедуплікації', () => {
  const candidate = manifest();
  const mediaUrl = 'https://legacy.example/images/seat.jpg';
  candidate.products[0].imageLegacyUrls = [mediaUrl];
  const media = {
    sourcePageKey: 'page:uk:product:seat-one',
    legacyUrl: mediaUrl,
    normalizedUrl: mediaUrl,
    filename: 'seat.jpg',
    storageType: 'local',
    linkedProductEntityKeys: ['entity:product:uk:seat-one'],
    linkedCategoryEntityKeys: [],
    availability: 'unknown',
    issues: [],
    evidence: [{ url: mediaUrl, sourceType: 'html' }],
    status: 'accept',
  };
  candidate.media.push({ ...media, entityKey: 'entity:media:seat-one:a' });
  candidate.media.push({ ...media, entityKey: 'entity:media:seat-one:b' });
  const report = validateManifest(candidate);

  assert.equal(report.structuralValidation.status, 'valid');
  assert.equal(recordResult(report, 'media', 0).status, 'review');
  assert.ok(recordResult(report, 'media', 0).issues.some((issue) => issue.code === 'MEDIA_URL_DUPLICATE'));
});

test('один Media URL, використаний різними source pages, не є автоматичною помилкою', () => {
  const candidate = manifest();
  const mediaUrl = 'https://legacy.example/images/shared.jpg';
  const secondProduct = {
    ...product(),
    sourcePageKey: 'page:uk:product:seat-two',
    entityKey: 'entity:product:uk:seat-two',
    legacyUrl: 'https://legacy.example/seats/seat-two.html',
    normalizedUrl: '/seats/seat-two.html',
    categoryEntityKey: 'entity:category:uk:seats',
    imageLegacyUrls: [mediaUrl],
  };
  candidate.products[0].imageLegacyUrls = [mediaUrl];
  candidate.products.push(secondProduct);
  for (const [sourcePageKey, entityKey] of [
    ['page:uk:product:seat-one', 'entity:product:uk:seat-one'],
    ['page:uk:product:seat-two', 'entity:product:uk:seat-two'],
  ]) {
    candidate.media.push({
      sourcePageKey,
      entityKey: 'entity:media:shared-image',
      legacyUrl: mediaUrl,
      normalizedUrl: mediaUrl,
      filename: 'shared.jpg',
      storageType: 'local',
      linkedProductEntityKeys: [entityKey],
      linkedCategoryEntityKeys: [],
      availability: 'unknown',
      issues: [],
      evidence: [{ url: mediaUrl, sourceType: 'html' }],
      status: 'accept',
    });
  }
  const report = validateManifest(candidate);

  assert.equal(report.structuralValidation.status, 'valid');
  assert.equal(recordResult(report, 'media', 0).status, 'accept');
  assert.equal(recordResult(report, 'media', 1).status, 'accept');
  assert.equal(recordResult(report, 'media', 0).issues.some((issue) => issue.code === 'MEDIA_URL_DUPLICATE'), false);
});

test('різні URL з однаковим Media filename є структурним конфліктом', () => {
  const candidate = manifest();
  const firstUrl = 'https://legacy.example/images/one/seat.jpg';
  const secondUrl = 'https://legacy.example/images/two/seat.jpg';
  candidate.products[0].imageLegacyUrls = [firstUrl, secondUrl];
  for (const [index, url] of [firstUrl, secondUrl].entries()) {
    candidate.media.push({
      sourcePageKey: 'page:uk:product:seat-one',
      entityKey: `entity:media:seat-one:${index}`,
      legacyUrl: url,
      normalizedUrl: url,
      filename: 'seat.jpg',
      storageType: 'local',
      linkedProductEntityKeys: ['entity:product:uk:seat-one'],
      linkedCategoryEntityKeys: [],
      availability: 'unknown',
      issues: [],
      evidence: [{ url, sourceType: 'html' }],
      status: 'accept',
    });
  }
  const report = validateManifest(candidate);

  assert.equal(report.structuralValidation.status, 'invalid');
  assert.equal(recordResult(report, 'media', 0).status, 'reject');
  assert.equal(recordResult(report, 'media', 1).status, 'reject');
  assert.ok(report.structuralValidation.errors.some((error) => error.code === 'MEDIA_FILENAME_CONFLICT'));
});

test('некоректний JSON фіксується як структурна помилка', () => {
  const report = validateManifestJson('{not json');

  assert.equal(report.structuralValidation.status, 'invalid');
  assert.equal(report.structuralValidation.errors[0].code, 'INVALID_JSON');
  assert.equal(report.summary.totalRecords, 0);
});
