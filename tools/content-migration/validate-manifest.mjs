import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');
const LOCALES = new Set(['uk', 'ru']);
const STATUSES = new Set(['accept', 'review', 'reject']);
const ENTITY_COLLECTIONS = new Set(['categories', 'products']);

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const getRecordLocale = (record) => {
  if (LOCALES.has(record?.locale)) return record.locale;
  const sourceKeyMatch = typeof record?.sourcePageKey === 'string'
    ? record.sourcePageKey.match(/^page:(uk|ru):/)
    : null;
  if (sourceKeyMatch) return sourceKeyMatch[1];
  if (!isHttpUrl(record?.legacyUrl)) return null;
  return new URL(record.legacyUrl).pathname.startsWith('/ru/') ? 'ru' : 'uk';
};
const isHttpUrl = (value, base) => {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = base ? new URL(value, base) : new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const makeIssue = (code, severity, status, message, field) => ({
  code,
  severity,
  status,
  message,
  ...(field ? { field } : {}),
});

const createEmptyReport = (sourceManifest) => ({
  validatorVersion: '2.0.0',
  sourceManifest,
  structuralValidation: {
    status: 'invalid',
    recordsChecked: 0,
    errors: [],
  },
  migrationReadiness: {
    status: 'ready',
    totalRecords: 0,
    accepted: 0,
    reviewRequired: 0,
    issuesByCode: {},
    records: [],
  },
  summary: {
    totalRecords: 0,
    accepted: 0,
    reviewRequired: 0,
    rejected: 0,
  },
});

const pushStructuralError = (report, recordResult, code, message, field) => {
  const error = {
    code,
    message,
    ...(recordResult?.sourcePageKey ? { sourcePageKey: recordResult.sourcePageKey } : {}),
    ...(recordResult ? { collection: recordResult.collection, index: recordResult.index } : {}),
    ...(field ? { field } : {}),
  };
  report.structuralValidation.errors.push(error);
  if (recordResult) {
    recordResult.structuralIssues.push(makeIssue(code, 'error', 'reject', message, field));
  }
};

const validateLocalizedValue = (value, result, report, field) => {
  if (value === undefined || value === null) return;
  if (!isObject(value)) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', `${field} must be an object.`, field);
    return;
  }

  for (const locale of Object.keys(value)) {
    if (!LOCALES.has(locale)) {
      pushStructuralError(report, result, 'INVALID_FIELD', `${field} contains unsupported locale "${locale}".`, `${field}.${locale}`);
    }
  }
  for (const locale of LOCALES) {
    if (value[locale] !== undefined && value[locale] !== null && typeof value[locale] !== 'string') {
      pushStructuralError(report, result, 'INVALID_FIELD_TYPE', `${field}.${locale} must be a string or null.`, `${field}.${locale}`);
    }
  }
};

const validateOptionalString = (value, result, report, field, { url = false, base } = {}) => {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', `${field} must be a string or null.`, field);
  } else if (url && !isHttpUrl(value, base)) {
    pushStructuralError(report, result, 'INVALID_URL', `${field} must be a valid HTTP(S) URL or path.`, field);
  }
};

const validateSeo = (seo, result, report) => {
  if (seo === undefined || seo === null) return;
  if (!isObject(seo)) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'seo must be an object or null.', 'seo');
    return;
  }
  validateLocalizedValue(seo.title, result, report, 'seo.title');
  validateLocalizedValue(seo.description, result, report, 'seo.description');
  if (seo.keywords !== undefined
    && (!Array.isArray(seo.keywords) || seo.keywords.some((keyword) => typeof keyword !== 'string'))) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'seo.keywords must be an array of strings.', 'seo.keywords');
  }
};

const validateCommonRecord = (record, result, report, { normalizedUrl = false } = {}) => {
  if (!isObject(record)) {
    pushStructuralError(report, result, 'INVALID_RECORD', 'Record must be an object.');
    return false;
  }

  result.sourcePageKey = record.sourcePageKey;
  if (!isNonEmptyString(record.sourcePageKey)) {
    pushStructuralError(report, result, 'MISSING_SOURCE_PAGE_KEY', 'A non-empty sourcePageKey is required.', 'sourcePageKey');
  }
  if (record.entityKey !== undefined && record.entityKey !== null && !isNonEmptyString(record.entityKey)) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'entityKey must be a non-empty string or null.', 'entityKey');
  }
  if (!isHttpUrl(record.legacyUrl)) {
    pushStructuralError(report, result, 'INVALID_URL', 'legacyUrl must be an absolute HTTP(S) URL.', 'legacyUrl');
  }
  if (normalizedUrl && !isHttpUrl(record.normalizedUrl, record.legacyUrl)) {
    pushStructuralError(report, result, 'INVALID_URL', 'normalizedUrl must be a valid HTTP(S) URL or path.', 'normalizedUrl');
  }
  if (!STATUSES.has(record.status)) {
    pushStructuralError(report, result, 'INVALID_ENUM', 'status must be accept, review, or reject.', 'status');
  }
  if (!Array.isArray(record.issues)) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'issues must be an array.', 'issues');
  } else {
    record.issues.forEach((issue, issueIndex) => {
      if (!isObject(issue)
        || !isNonEmptyString(issue.code)
        || !isNonEmptyString(issue.message)
        || !['error', 'warning', 'info'].includes(issue.severity)
        || !STATUSES.has(issue.status)) {
        pushStructuralError(report, result, 'INVALID_ISSUE', 'Each issue must have valid code, message, severity, and status.', `issues.${issueIndex}`);
      }
    });
  }
  if (!Array.isArray(record.evidence)) {
    pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'evidence must be an array.', 'evidence');
  } else {
    record.evidence.forEach((evidence, evidenceIndex) => {
      if (!isObject(evidence)
        || !isHttpUrl(evidence.url)
        || !['html', 'meta', 'form', 'navigation', 'sitemap', 'unknown', 'manual'].includes(evidence.sourceType)
        || (evidence.note !== undefined && typeof evidence.note !== 'string')
        || (evidence.id !== undefined && !isNonEmptyString(evidence.id))) {
        pushStructuralError(report, result, 'INVALID_EVIDENCE', 'Each evidence entry must have a valid URL and sourceType.', `evidence.${evidenceIndex}`);
      }
    });
  }
  if (record.localeMatch !== undefined && !['confirmed', 'unconfirmed', 'conflict', 'duplicate'].includes(record.localeMatch)) {
    pushStructuralError(report, result, 'INVALID_ENUM', 'localeMatch has an unsupported value.', 'localeMatch');
  }
  if (record.localeMatchEvidence !== undefined && record.localeMatchEvidence !== null) {
    if (!isObject(record.localeMatchEvidence)
      || record.localeMatchEvidence.verified !== true
      || !['manual', 'explicit'].includes(record.localeMatchEvidence.method)
      || !isNonEmptyString(record.localeMatchEvidence.reference)) {
      pushStructuralError(report, result, 'INVALID_LOCALE_MATCH_EVIDENCE', 'localeMatchEvidence must contain verified: true, method, and a reference.', 'localeMatchEvidence');
    }
  }
  return true;
};

const validateRecordShape = (record, result, report) => {
  const validObject = validateCommonRecord(record, result, report, {
    normalizedUrl: ['categories', 'products', 'media'].includes(result.collection),
  });
  if (!validObject) return;

  if (['categories', 'pages', 'articles'].includes(result.collection) && !LOCALES.has(record.locale)) {
    pushStructuralError(report, result, 'INVALID_ENUM', 'locale must be uk or ru.', 'locale');
  }
  if (result.collection === 'products'
    && record.locale !== undefined
    && record.locale !== null
    && !LOCALES.has(record.locale)) {
    pushStructuralError(report, result, 'INVALID_ENUM', 'locale must be uk or ru when present.', 'locale');
  }

  if (result.collection === 'categories') {
    validateLocalizedValue(record.name, result, report, 'name');
    validateLocalizedValue(record.slug, result, report, 'slug');
    const sourceLocale = getRecordLocale(record);
    if (sourceLocale && (!isObject(record.slug) || !isNonEmptyString(record.slug[sourceLocale]))) {
      pushStructuralError(report, result, 'REQUIRED_SOURCE_LOCALE_SLUG_MISSING', `Category source record requires a non-empty slug.${sourceLocale}.`, `slug.${sourceLocale}`);
    }
    validateLocalizedValue(record.description, result, report, 'description');
    validateSeo(record.seo, result, report);
    validateOptionalString(record.parentLegacyUrl, result, report, 'parentLegacyUrl', { url: true, base: record.legacyUrl });
    validateOptionalString(record.imageLegacyUrl, result, report, 'imageLegacyUrl', { url: true, base: record.legacyUrl });
  }

  if (result.collection === 'products') {
    validateLocalizedValue(record.name, result, report, 'name');
    validateLocalizedValue(record.slug, result, report, 'slug');
    const sourceLocale = getRecordLocale(record);
    if (sourceLocale && (!isObject(record.slug) || !isNonEmptyString(record.slug[sourceLocale]))) {
      pushStructuralError(report, result, 'REQUIRED_SOURCE_LOCALE_SLUG_MISSING', `Product source record requires a non-empty slug.${sourceLocale}.`, `slug.${sourceLocale}`);
    }
    validateLocalizedValue(record.shortDescription, result, report, 'shortDescription');
    validateLocalizedValue(record.description, result, report, 'description');
    validateSeo(record.seo, result, report);
    if (record.attributes !== undefined) {
      if (!Array.isArray(record.attributes)) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'attributes must be an array.', 'attributes');
      } else {
        record.attributes.forEach((attribute, index) => {
          if (!isObject(attribute)) {
            pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'Each attribute must be an object.', `attributes.${index}`);
            return;
          }
          validateLocalizedValue(attribute.key, result, report, `attributes.${index}.key`);
          validateLocalizedValue(attribute.value, result, report, `attributes.${index}.value`);
        });
      }
    }
    if (record.categoryEntityKey !== undefined && record.categoryEntityKey !== null && !isNonEmptyString(record.categoryEntityKey)) {
      pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'categoryEntityKey must be a non-empty string or null.', 'categoryEntityKey');
    }
    if (record.imageLegacyUrls !== undefined) {
      if (!Array.isArray(record.imageLegacyUrls)) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'imageLegacyUrls must be an array.', 'imageLegacyUrls');
      } else {
        record.imageLegacyUrls.forEach((url, urlIndex) => {
          if (!isHttpUrl(url, record.legacyUrl)) {
            pushStructuralError(report, result, 'INVALID_URL', 'Each imageLegacyUrls entry must be a valid HTTP(S) URL or path.', `imageLegacyUrls.${urlIndex}`);
          }
        });
      }
    }
    if (record.pricingRaw !== undefined && record.pricingRaw !== null) {
      const pricing = record.pricingRaw;
      if (!isObject(pricing)) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw must be an object or null.', 'pricingRaw');
      } else {
        if (pricing.isConfirmed !== undefined && typeof pricing.isConfirmed !== 'boolean') {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.isConfirmed must be a boolean.', 'pricingRaw.isConfirmed');
        }
        if (pricing.amount !== undefined && pricing.amount !== null && !isFiniteNumber(pricing.amount)) {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.amount must be a number or null.', 'pricingRaw.amount');
        }
        if (pricing.periodDays !== undefined && pricing.periodDays !== null && !isFiniteNumber(pricing.periodDays)) {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.periodDays must be a number or null.', 'pricingRaw.periodDays');
        }
        if (pricing.currency !== undefined && pricing.currency !== null && typeof pricing.currency !== 'string') {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.currency must be a string or null.', 'pricingRaw.currency');
        }
        if (pricing.unit !== undefined && pricing.unit !== null && typeof pricing.unit !== 'string') {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.unit must be a string or null.', 'pricingRaw.unit');
        }
        if (pricing.rawText !== undefined && pricing.rawText !== null && typeof pricing.rawText !== 'string') {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'pricingRaw.rawText must be a string or null.', 'pricingRaw.rawText');
        }
        if (pricing.type !== undefined && !['sale', 'rental', 'unknown'].includes(pricing.type)) {
          pushStructuralError(report, result, 'INVALID_ENUM', 'pricingRaw.type has an unsupported value.', 'pricingRaw.type');
        }
      }
    }
    if (record.availabilityRaw !== undefined && record.availabilityRaw !== null) {
      const availability = record.availabilityRaw;
      if (!isObject(availability)) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'availabilityRaw must be an object or null.', 'availabilityRaw');
      } else {
        if (availability.rawText !== undefined && availability.rawText !== null && typeof availability.rawText !== 'string') {
          pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'availabilityRaw.rawText must be a string or null.', 'availabilityRaw.rawText');
        }
        if (availability.normalized !== undefined
          && availability.normalized !== null
          && !['in_stock', 'on_order', 'out_of_stock'].includes(availability.normalized)) {
          pushStructuralError(report, result, 'INVALID_ENUM', 'availabilityRaw.normalized has an unsupported value.', 'availabilityRaw.normalized');
        }
        if (availability.confidence !== undefined && !['confirmed', 'partial', 'unknown'].includes(availability.confidence)) {
          pushStructuralError(report, result, 'INVALID_ENUM', 'availabilityRaw.confidence has an unsupported value.', 'availabilityRaw.confidence');
        }
      }
    }
  }

  if (result.collection === 'media') {
    if (record.filename !== undefined && record.filename !== null && typeof record.filename !== 'string') {
      pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'filename must be a string or null.', 'filename');
    }
    if (record.storageType !== undefined
      && record.storageType !== null
      && !['local', 'cloudinary', 's3'].includes(record.storageType)) {
      pushStructuralError(report, result, 'INVALID_ENUM', 'storageType has an unsupported value.', 'storageType');
    }
    for (const field of ['linkedProductEntityKeys', 'linkedCategoryEntityKeys']) {
      if (!Array.isArray(record[field]) || record[field].some((key) => !isNonEmptyString(key))) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', `${field} must be an array of non-empty strings.`, field);
      }
    }
    if (!['available', 'missing', 'unknown'].includes(record.availability)) {
      pushStructuralError(report, result, 'INVALID_ENUM', 'Media availability has an unsupported value.', 'availability');
    }
    if (record.mimeType !== undefined && record.mimeType !== null && typeof record.mimeType !== 'string') {
      pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'mimeType must be a string or null.', 'mimeType');
    }
    for (const field of ['width', 'height']) {
      if (record[field] !== undefined && record[field] !== null && (!isFiniteNumber(record[field]) || record[field] < 0)) {
        pushStructuralError(report, result, 'INVALID_FIELD_TYPE', `${field} must be a non-negative number or null.`, field);
      }
    }
    validateLocalizedValue(record.alt, result, report, 'alt');
    if (record.duplicateOf !== undefined && record.duplicateOf !== null && !isNonEmptyString(record.duplicateOf)) {
      pushStructuralError(report, result, 'INVALID_FIELD_TYPE', 'duplicateOf must be a non-empty string or null.', 'duplicateOf');
    }
  }

  if (result.collection === 'pages' && ![
    'about', 'contact', 'terms', 'partners', 'reviews', 'news-list', 'article-list', 'unknown',
  ].includes(record.pageType)) {
    pushStructuralError(report, result, 'INVALID_ENUM', 'pageType has an unsupported value.', 'pageType');
  }
  if (result.collection === 'pages' || result.collection === 'articles') {
    validateOptionalString(record.title, result, report, 'title');
    validateOptionalString(record.body, result, report, 'body');
  }
  if (result.collection === 'articles') {
    validateOptionalString(record.linkToParent, result, report, 'linkToParent');
  }
};

const pathForLocalePair = (record) => {
  try {
    return new URL(record.legacyUrl).pathname.replace(/^\/ru(?=\/)/, '').replace(/\/+$/, '') || '/';
  } catch {
    return null;
  }
};

const hasVerifiedPairEvidence = (left, right) => {
  const a = left.localeMatchEvidence;
  const b = right.localeMatchEvidence;
  const leftHasEvidence = Array.isArray(left.evidence) && left.evidence.some((item) => item?.id === a?.reference);
  const rightHasEvidence = Array.isArray(right.evidence) && right.evidence.some((item) => item?.id === b?.reference);
  return left.localeMatch === 'confirmed'
    && right.localeMatch === 'confirmed'
    && a?.verified === true
    && b?.verified === true
    && ['manual', 'explicit'].includes(a.method)
    && a.method === b.method
    && isNonEmptyString(a.reference)
    && a.reference === b.reference
    && leftHasEvidence
    && rightHasEvidence;
};

const addReadinessIssue = (result, code, message, field) => {
  result.readinessIssues.push(makeIssue(code, 'warning', 'review', message, field));
};

const validateMigrationReadiness = (result, record, context) => {
  const locale = getRecordLocale(record);
  const name = record.name;
  const slug = record.slug;
  const hasName = isObject(name)
    && ['uk', 'ru'].some((key) => isNonEmptyString(name[key]));

  if (ENTITY_COLLECTIONS.has(result.collection)) {
    if (!locale) {
      addReadinessIssue(result, 'SOURCE_LOCALE_UNCONFIRMED', 'The source page locale cannot be determined.', 'locale');
    }
    if (!hasName) {
      addReadinessIssue(result, 'NAME_MISSING', 'No non-empty localized name is available for the target model.', 'name');
    } else if (locale && !isNonEmptyString(name[locale])) {
      addReadinessIssue(result, 'SOURCE_LOCALE_NAME_MISSING', `name.${locale} is not confirmed for this source page.`, `name.${locale}`);
    }
    if (!isNonEmptyString(record.slug?.uk)
      && !context.confirmedEntityKeysWithUkSlug.has(context.identityPairs.get(result)?.effectiveEntityKey)) {
      addReadinessIssue(result, 'TARGET_UK_SLUG_MISSING', 'A ready MongoDB entity requires a confirmed slug.uk; no value was inferred from another language.', 'slug.uk');
    }
  }

  if (result.collection === 'categories') {
    if (record.entityKey && context.uncertainEntityKeys.has(record.entityKey)) {
      addReadinessIssue(result, 'ENTITY_KEY_UNCONFIRMED', 'This entityKey is shared by an unconfirmed locale pair.', 'entityKey');
    }
  }

  if (result.collection === 'products') {
    const categoryKey = record.categoryEntityKey;
    if (!isNonEmptyString(categoryKey)) {
      addReadinessIssue(result, 'CATEGORY_RELATION_MISSING', 'A target Product requires a category relation.', 'categoryEntityKey');
    } else if (context.uncertainEntityKeys.has(categoryKey)) {
      addReadinessIssue(result, 'CATEGORY_IDENTITY_UNCONFIRMED', 'The referenced category entity has an unconfirmed locale identity.', 'categoryEntityKey');
    }

    const pricing = record.pricingRaw;
    if (!isObject(pricing)) {
      addReadinessIssue(result, 'PRICING_DATA_MISSING', 'No pricing data can be mapped to the target Product pricing schema.', 'pricingRaw');
    } else {
      if (pricing.isConfirmed !== true) {
        addReadinessIssue(result, 'PRICE_NOT_CONFIRMED', 'Pricing is explicitly unconfirmed or lacks confirmation.', 'pricingRaw.isConfirmed');
      }
      if (!isFiniteNumber(pricing.amount) || pricing.amount < 0) {
        addReadinessIssue(result, 'PRICE_AMOUNT_MISSING', 'A non-negative numeric price is required; no value was invented.', 'pricingRaw.amount');
      }
      if (!isNonEmptyString(pricing.currency)) {
        addReadinessIssue(result, 'PRICE_CURRENCY_UNCONFIRMED', 'A confirmed currency is required.', 'pricingRaw.currency');
      }
      if (!['sale', 'rental'].includes(pricing.type)) {
        addReadinessIssue(result, 'PRICE_TYPE_AMBIGUOUS', 'Pricing type must be confirmed as sale or rental.', 'pricingRaw.type');
      } else if (pricing.type === 'rental') {
        if (!isFiniteNumber(pricing.periodDays) || pricing.periodDays < 1) {
          addReadinessIssue(result, 'RENTAL_PERIOD_UNCONFIRMED', 'Rental pricing requires a confirmed period; it cannot be converted to salePrice.', 'pricingRaw.periodDays');
        }
        if (!isNonEmptyString(pricing.unit)) {
          addReadinessIssue(result, 'RENTAL_UNIT_UNCONFIRMED', 'The target rentalRates schema requires a confirmed unit.', 'pricingRaw.unit');
        }
      }
    }

    const availability = record.availabilityRaw;
    if (!isObject(availability)
      || availability.confidence !== 'confirmed'
      || !['in_stock', 'on_order', 'out_of_stock'].includes(availability.normalized)) {
      addReadinessIssue(result, 'AVAILABILITY_UNCONFIRMED', 'Product availability must be explicitly confirmed; no default was applied.', 'availabilityRaw');
    }
  }

  if (result.collection === 'media') {
    if (!isNonEmptyString(record.filename)) {
      addReadinessIssue(result, 'MEDIA_FILENAME_MISSING', 'The target Media model requires a filename; none was invented.', 'filename');
    }
    if (!['local', 'cloudinary', 's3'].includes(record.storageType)) {
      addReadinessIssue(result, 'MEDIA_STORAGE_TYPE_UNCONFIRMED', 'The target Media model requires a confirmed storageType; none was inferred.', 'storageType');
    }
    if (!Array.isArray(record.linkedProductEntityKeys) || record.linkedProductEntityKeys.length === 0) {
      addReadinessIssue(result, 'MEDIA_PRODUCT_RELATION_MISSING', 'Media must be linked to a Product for migration readiness.', 'linkedProductEntityKeys');
    } else if (record.linkedProductEntityKeys.some((key) => context.uncertainEntityKeys.has(key))) {
      addReadinessIssue(result, 'MEDIA_PRODUCT_IDENTITY_UNCONFIRMED', 'Media links to a Product identity with an unconfirmed locale match.', 'linkedProductEntityKeys');
    }
  }
};

const validateRoot = (manifest, report) => {
  if (!isObject(manifest)) {
    pushStructuralError(report, null, 'INVALID_MANIFEST', 'Manifest root must be an object.');
    return;
  }
  if (!isNonEmptyString(manifest.manifestVersion)) {
    pushStructuralError(report, null, 'INVALID_REQUIRED_FIELD', 'manifestVersion is required.', 'manifestVersion');
  }
  if (!isNonEmptyString(manifest.generatedAt) || Number.isNaN(Date.parse(manifest.generatedAt))) {
    pushStructuralError(report, null, 'INVALID_FIELD_TYPE', 'generatedAt must be a valid date string.', 'generatedAt');
  }
  if (!isObject(manifest.source)
    || manifest.source.kind !== 'public-legacy-site'
    || !isHttpUrl(manifest.source.rootUrl)
    || !Array.isArray(manifest.source.notes)
    || manifest.source.notes.some((note) => typeof note !== 'string')) {
    pushStructuralError(report, null, 'INVALID_REQUIRED_FIELD', 'source must contain kind, an HTTP(S) rootUrl, and string notes.', 'source');
  }
  for (const collection of ['categories', 'products', 'media', 'pages']) {
    if (!Array.isArray(manifest[collection])) {
      pushStructuralError(report, null, 'INVALID_REQUIRED_FIELD', `${collection} must be an array.`, collection);
    }
  }
  if (manifest.articles !== undefined && !Array.isArray(manifest.articles)) {
    pushStructuralError(report, null, 'INVALID_FIELD_TYPE', 'articles must be an array when present.', 'articles');
  }
};

export const validateManifest = (manifest, sourceManifest = 'candidate-manifest.json') => {
  const report = createEmptyReport(sourceManifest);
  validateRoot(manifest, report);
  if (!isObject(manifest)) return report;

  const collections = ['categories', 'products', 'media', 'pages', 'articles'];
  const results = [];
  for (const collection of collections) {
    if (!Array.isArray(manifest[collection])) continue;
    manifest[collection].forEach((record, index) => {
      const result = {
        collection,
        index,
        sourcePageKey: isObject(record) ? record.sourcePageKey : null,
        structuralIssues: [],
        readinessIssues: [],
      };
      results.push(result);
      validateRecordShape(record, result, report);
    });
  }

  const sourceKeyGroups = new Map();
  for (const result of results) {
    if (!isNonEmptyString(result.sourcePageKey)) continue;
    const group = sourceKeyGroups.get(result.sourcePageKey) || [];
    group.push(result);
    sourceKeyGroups.set(result.sourcePageKey, group);
  }
  for (const [sourcePageKey, group] of sourceKeyGroups) {
    const pageRecords = group.filter((result) => result.collection !== 'media');
    if (pageRecords.length > 1) {
      for (const result of pageRecords) {
        pushStructuralError(report, result, 'DUPLICATE_SOURCE_PAGE_KEY', `sourcePageKey "${sourcePageKey}" is not unique.`, 'sourcePageKey');
      }
    }
  }

  const byEntityKey = new Map();
  results.forEach((result) => {
    const record = manifest[result.collection]?.[result.index];
    if (!isObject(record) || !isNonEmptyString(record.entityKey)) return;
    const group = byEntityKey.get(record.entityKey) || [];
    group.push({ result, record });
    byEntityKey.set(record.entityKey, group);
  });

  const uncertainEntityKeys = new Set();
  for (const [entityKey, group] of byEntityKey) {
    const collectionsInGroup = new Set(group.map(({ result }) => result.collection));
    if (collectionsInGroup.size > 1) {
      for (const { result } of group) {
        pushStructuralError(report, result, 'ENTITY_KEY_CONFLICT', `entityKey "${entityKey}" is used by different record types.`, 'entityKey');
      }
      continue;
    }

    const collection = group[0]?.result.collection;
    if (ENTITY_COLLECTIONS.has(collection)) {
      const localeCounts = new Map();
      for (const entry of group) {
        const locale = getRecordLocale(entry.record);
        localeCounts.set(locale, (localeCounts.get(locale) || 0) + 1);
      }
      if ([...localeCounts.values()].some((count) => count > 1)) {
        for (const { result } of group) {
          pushStructuralError(report, result, 'ENTITY_KEY_CONFLICT', `entityKey "${entityKey}" identifies multiple records in the same locale.`, 'entityKey');
        }
      }
    } else if (collection === 'media') {
      const urls = new Set(group.map(({ record }) => record.normalizedUrl));
      if (urls.size > 1) {
        for (const { result } of group) {
          pushStructuralError(report, result, 'ENTITY_KEY_CONFLICT', `Media entityKey "${entityKey}" refers to different URLs.`, 'entityKey');
        }
      }
    }
  }

  const identityPairs = new Map();
  for (let leftIndex = 0; leftIndex < results.length; leftIndex += 1) {
    const leftResult = results[leftIndex];
    const left = manifest[leftResult.collection]?.[leftResult.index];
    if (!isObject(left) || !ENTITY_COLLECTIONS.has(leftResult.collection)) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < results.length; rightIndex += 1) {
      const rightResult = results[rightIndex];
      const right = manifest[rightResult.collection]?.[rightResult.index];
      if (!isObject(right)
        || leftResult.collection !== rightResult.collection
        || getRecordLocale(left) === getRecordLocale(right)
        || !LOCALES.has(getRecordLocale(left))
        || !LOCALES.has(getRecordLocale(right))) continue;
      const sameEntityKey = isNonEmptyString(left.entityKey) && left.entityKey === right.entityKey;
      const leftPath = pathForLocalePair(left);
      const samePath = leftPath !== null && leftPath === pathForLocalePair(right);
      if (!sameEntityKey && !samePath) continue;

      const verified = sameEntityKey && hasVerifiedPairEvidence(left, right);
      if (verified) {
        identityPairs.set(leftResult, { effectiveEntityKey: left.entityKey, localeMatch: 'confirmed' });
        identityPairs.set(rightResult, { effectiveEntityKey: right.entityKey, localeMatch: 'confirmed' });
      } else {
        uncertainEntityKeys.add(left.entityKey);
        uncertainEntityKeys.add(right.entityKey);
        addReadinessIssue(leftResult, 'UNCONFIRMED_LOCALE_PAIR', 'A possible uk/ru counterpart exists, but no explicit or manually verified matching evidence supports merging.', 'localeMatch');
        addReadinessIssue(rightResult, 'UNCONFIRMED_LOCALE_PAIR', 'A possible uk/ru counterpart exists, but no explicit or manually verified matching evidence supports merging.', 'localeMatch');
      }
    }
  }

  const categoryKeys = new Set(
    results
      .filter((result) => result.collection === 'categories')
      .map((result) => manifest.categories?.[result.index]?.entityKey)
      .filter(isNonEmptyString)
  );
  const productKeys = new Set(
    results
      .filter((result) => result.collection === 'products')
      .map((result) => manifest.products?.[result.index]?.entityKey)
      .filter(isNonEmptyString)
  );
  const productSourceKeys = new Set(
    results
      .filter((result) => result.collection === 'products')
      .map((result) => manifest.products?.[result.index]?.sourcePageKey)
      .filter(isNonEmptyString)
  );
  const mediaUrls = new Set(
    (manifest.media || [])
      .filter(isObject)
      .flatMap((record) => [record.legacyUrl, record.normalizedUrl])
      .filter(isNonEmptyString)
  );
  const mediaByUrl = new Map();
  const mediaByFilename = new Map();
  for (const result of results.filter((item) => item.collection === 'media')) {
    const record = manifest.media?.[result.index];
    if (!isObject(record)) continue;
    for (const [map, value] of [[mediaByUrl, record.normalizedUrl], [mediaByFilename, record.filename]]) {
      if (!isNonEmptyString(value)) continue;
      const group = map.get(value) || [];
      group.push(result);
      map.set(value, group);
    }
  }
  for (const [url, group] of mediaByUrl) {
    const recordsBySourcePage = new Map();
    for (const result of group) {
      const sourcePageKey = manifest.media?.[result.index]?.sourcePageKey;
      const records = recordsBySourcePage.get(sourcePageKey) || [];
      records.push(result);
      recordsBySourcePage.set(sourcePageKey, records);
    }
    for (const records of recordsBySourcePage.values()) {
      if (records.length > 1) {
        for (const result of records) {
          addReadinessIssue(result, 'MEDIA_URL_DUPLICATE', `Media URL "${url}" occurs more than once on the same source page and requires explicit deduplication.`, 'normalizedUrl');
        }
      }
    }
  }
  for (const [filename, group] of mediaByFilename) {
    const urls = new Set(group.map((result) => manifest.media?.[result.index]?.normalizedUrl));
    if (urls.size > 1) {
      for (const result of group) {
        pushStructuralError(report, result, 'MEDIA_FILENAME_CONFLICT', `Media filename "${filename}" identifies different URLs.`, 'filename');
      }
    }
  }

  for (const result of results) {
    const record = manifest[result.collection]?.[result.index];
    if (!isObject(record)) continue;

    if (result.collection === 'products' && isNonEmptyString(record.categoryEntityKey) && !categoryKeys.has(record.categoryEntityKey)) {
      pushStructuralError(report, result, 'BROKEN_RELATION', 'categoryEntityKey does not reference a category entity.', 'categoryEntityKey');
    }
    if (result.collection === 'products' && Array.isArray(record.imageLegacyUrls)) {
      record.imageLegacyUrls.forEach((url, urlIndex) => {
        if (isNonEmptyString(url) && !mediaUrls.has(url)) {
          pushStructuralError(report, result, 'BROKEN_RELATION', 'imageLegacyUrls entry does not reference a media record.', `imageLegacyUrls.${urlIndex}`);
        }
      });
    }
    if (result.collection === 'media') {
      if (isNonEmptyString(record.sourcePageKey) && !productSourceKeys.has(record.sourcePageKey)) {
        pushStructuralError(report, result, 'BROKEN_RELATION', 'Media sourcePageKey does not reference a Product source page.', 'sourcePageKey');
      }
      for (const key of record.linkedProductEntityKeys || []) {
        if (!productKeys.has(key)) {
          pushStructuralError(report, result, 'BROKEN_RELATION', 'linkedProductEntityKeys contains an unknown Product entityKey.', 'linkedProductEntityKeys');
        }
      }
      for (const key of record.linkedCategoryEntityKeys || []) {
        if (!categoryKeys.has(key)) {
          pushStructuralError(report, result, 'BROKEN_RELATION', 'linkedCategoryEntityKeys contains an unknown Category entityKey.', 'linkedCategoryEntityKeys');
        }
      }
      if (isNonEmptyString(record.duplicateOf) && !sourceKeyGroups.has(record.duplicateOf)) {
        pushStructuralError(report, result, 'BROKEN_RELATION', 'duplicateOf does not reference a sourcePageKey.', 'duplicateOf');
      }
    }
  }

  const confirmedEntityKeysWithUkSlug = new Set();
  for (const [result, identity] of identityPairs) {
    const record = manifest[result.collection]?.[result.index];
    if (getRecordLocale(record) === 'uk' && isNonEmptyString(record.slug?.uk)) {
      confirmedEntityKeysWithUkSlug.add(identity.effectiveEntityKey);
    }
  }

  const context = { uncertainEntityKeys, identityPairs, confirmedEntityKeysWithUkSlug };
  for (const result of results) {
    const record = manifest[result.collection]?.[result.index];
    if (isObject(record)) validateMigrationReadiness(result, record, context);
  }

  for (const result of results) {
    const record = manifest[result.collection]?.[result.index];
    const hasConfirmedPair = identityPairs.has(result);
    const hasUnconfirmedPair = result.readinessIssues.some((issue) => issue.code === 'UNCONFIRMED_LOCALE_PAIR');
    const claimsUnverifiedPair = isObject(record) && record.localeMatch === 'confirmed' && !hasConfirmedPair;
    if (claimsUnverifiedPair && !hasUnconfirmedPair) {
      addReadinessIssue(result, 'LOCALE_MATCH_EVIDENCE_MISSING', 'localeMatch requires a paired record and explicit or manually verified matching evidence.', 'localeMatch');
    }

    const identity = isObject(record)
      ? identityPairs.get(result) || {
          effectiveEntityKey: uncertainEntityKeys.has(record.entityKey) || claimsUnverifiedPair ? null : record.entityKey ?? null,
          localeMatch: hasUnconfirmedPair || claimsUnverifiedPair
            ? 'unconfirmed'
            : record.localeMatch ?? null,
        }
      : { effectiveEntityKey: null, localeMatch: null };

    const structuralStatus = result.structuralIssues.length === 0 ? 'valid' : 'invalid';
    const readinessStatus = result.readinessIssues.length === 0 ? 'accept' : 'review';
    const status = structuralStatus === 'invalid' ? 'reject' : readinessStatus;
    result.status = status;
    result.structuralStatus = structuralStatus;
    result.readinessStatus = readinessStatus;
    result.identity = identity;
    result.issues = [...result.structuralIssues, ...result.readinessIssues];
    delete result.structuralIssues;
    delete result.readinessIssues;
  }

  report.structuralValidation.recordsChecked = results.length;
  report.structuralValidation.status = report.structuralValidation.errors.length === 0 ? 'valid' : 'invalid';

  const statuses = { accept: 0, review: 0, reject: 0 };
  const issuesByCode = {};
  for (const result of results) {
    statuses[result.status] += 1;
    for (const issue of result.issues) {
      issuesByCode[issue.code] = (issuesByCode[issue.code] || 0) + 1;
    }
  }
  report.migrationReadiness = {
    status: statuses.review > 0 || statuses.reject > 0 ? 'review' : 'ready',
    totalRecords: results.length,
    accepted: statuses.accept,
    reviewRequired: statuses.review,
    issuesByCode,
    records: results,
  };
  report.summary = {
    totalRecords: results.length,
    accepted: statuses.accept,
    reviewRequired: statuses.review,
    rejected: statuses.reject,
  };
  return report;
};

export const validateManifestJson = (jsonText, sourceManifest = 'candidate-manifest.json') => {
  let manifest;
  try {
    manifest = JSON.parse(jsonText);
  } catch (error) {
    const report = createEmptyReport(sourceManifest);
    report.structuralValidation.errors.push({
      code: 'INVALID_JSON',
      message: error instanceof Error ? error.message : 'JSON parsing failed.',
    });
    return report;
  }
  return validateManifest(manifest, sourceManifest);
};

const main = async () => {
  const inputPath = path.resolve(process.argv[2] || path.join(OUTPUT_DIR, 'candidate-manifest.json'));
  const outputPath = path.resolve(process.argv[3] || path.join(OUTPUT_DIR, 'validation-report-v2.json'));
  const sourceManifest = path.relative(process.cwd(), inputPath).replace(/\\/g, '/');
  const jsonText = await fs.readFile(inputPath, 'utf8');
  const report = validateManifestJson(jsonText, sourceManifest);
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    output: path.relative(process.cwd(), outputPath).replace(/\\/g, '/'),
    structuralValidation: report.structuralValidation.status,
    summary: report.summary,
  }, null, 2));
  if (report.structuralValidation.status !== 'valid') process.exitCode = 1;
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
