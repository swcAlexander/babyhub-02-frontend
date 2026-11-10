import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');
const DEFAULTS_APPLIED = {
  availability: 'in_stock',
  currency: 'UAH',
  price: 0,
  status: 'draft',
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !path.extname(specifier) && context.parentURL?.startsWith('file:')) {
      const resolvedPath = `${fileURLToPath(new URL(specifier, context.parentURL))}.ts`;
      if (existsSync(resolvedPath)) {
        return nextResolve(pathToFileURL(resolvedPath).href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const loadModels = async () => {
  const [categoryModule, productModule, mongooseModule] = await Promise.all([
    import(pathToFileURL(path.resolve(__dirname, '../../src/models/Category.ts')).href),
    import(pathToFileURL(path.resolve(__dirname, '../../src/models/Product.ts')).href),
    import('mongoose'),
  ]);
  return {
    Category: categoryModule.default,
    Product: productModule.default,
    mongoose: mongooseModule.default,
  };
};

const localizedUk = (value) => {
  const uk = typeof value?.uk === 'string' ? value.uk.trim() : '';
  return uk ? { uk } : undefined;
};

const sourceLocale = (record) => {
  if (record?.locale === 'uk' || record?.locale === 'ru') return record.locale;
  const match = typeof record?.sourcePageKey === 'string'
    ? record.sourcePageKey.match(/^page:(uk|ru):/)
    : null;
  return match?.[1] ?? null;
};

const metadataFor = (record, defaultsApplied = []) => ({
  source: [
    'candidate-manifest',
    ...(defaultsApplied.length ? [`defaults applied: ${defaultsApplied.join(', ')}`] : []),
  ].join('; '),
  legacyUrl: record.legacyUrl,
});

export const buildImportDocuments = (manifest, { Category, Product, mongoose }) => {
  const categories = [];
  const categoryIds = new Map();
  const issues = [];

  for (const record of manifest.categories || []) {
    if (sourceLocale(record) !== 'uk') continue;
    const payload = {
      name: localizedUk(record.name),
      slug: localizedUk(record.slug),
      ...(localizedUk(record.description) ? { description: localizedUk(record.description) } : {}),
      status: DEFAULTS_APPLIED.status,
      importMeta: metadataFor(record, ['status=draft']),
    };
    const document = new Category(payload);
    categories.push({ record, document });
    if (typeof record.entityKey === 'string') {
      if (categoryIds.has(record.entityKey)) {
        issues.push({
          sourcePageKey: record.sourcePageKey ?? null,
          code: 'DUPLICATE_UK_CATEGORY_ENTITY_KEY',
          message: 'Multiple Ukrainian Category sources share one entityKey; automatic merging is not allowed.',
        });
      } else {
        categoryIds.set(record.entityKey, document._id);
      }
    }
  }

  const products = [];
  for (const record of manifest.products || []) {
    if (sourceLocale(record) !== 'uk') continue;
    const categoryId = categoryIds.get(record.categoryEntityKey);
    if (!categoryId) {
      issues.push({
        sourcePageKey: record.sourcePageKey ?? null,
        code: 'CATEGORY_SOURCE_NOT_FOUND',
        message: 'A matching Ukrainian Category source record is required; no category was inferred.',
      });
      continue;
    }

    const pricing = record.pricingRaw;
    const confirmedPrice = pricing?.isConfirmed === true
      && typeof pricing.amount === 'number'
      && Number.isFinite(pricing.amount)
      && pricing.amount >= 0;
    const confirmedCurrency = pricing?.isConfirmed === true
      && typeof pricing.currency === 'string'
      && pricing.currency.trim().length > 0;
    const currency = confirmedCurrency ? pricing.currency.trim().toUpperCase() : DEFAULTS_APPLIED.currency;
    const rental = pricing?.type === 'rental';
    const confirmedUnit = pricing?.isConfirmed === true
      && typeof pricing.unit === 'string'
      && pricing.unit.trim().length > 0;
    const price = confirmedPrice ? pricing.amount : DEFAULTS_APPLIED.price;
    const defaultsApplied = ['availability=in_stock', 'status=draft'];
    if (!confirmedCurrency) defaultsApplied.push(`currency=${DEFAULTS_APPLIED.currency}`);
    if (!confirmedPrice) defaultsApplied.push(`price=${DEFAULTS_APPLIED.price}`);
    if (rental && !confirmedUnit) {
      defaultsApplied.push(`rentalRates=[] (unit unconfirmed; deferred price=${price} ${currency})`);
    }
    const pricingPayload = rental
      ? {
          currency,
          rentalRates: confirmedUnit ? [{
            ...(Number.isFinite(pricing.periodDays) && pricing.periodDays >= 1
              ? { periodDays: pricing.periodDays }
              : {}),
            unit: pricing.unit.trim(),
            price,
            currency,
          }] : [],
        }
      : {
          salePrice: price,
          currency,
          rentalRates: [],
        };
    const payload = {
      category: categoryId,
      name: localizedUk(record.name),
      slug: localizedUk(record.slug),
      ...(localizedUk(record.shortDescription) ? { shortDescription: localizedUk(record.shortDescription) } : {}),
      ...(localizedUk(record.description) ? { description: localizedUk(record.description) } : {}),
      pricing: pricingPayload,
      availability: DEFAULTS_APPLIED.availability,
      status: DEFAULTS_APPLIED.status,
      importMeta: metadataFor(record, defaultsApplied),
    };
    products.push({ record, document: new Product(payload) });
  }

  return { categories, products, issues, defaultsApplied: DEFAULTS_APPLIED, mongoose };
};

const validationErrorsFor = async (documents) => {
  const errors = [];
  for (const { record, document } of documents) {
    try {
      await document.validate();
    } catch (error) {
      for (const [field, detail] of Object.entries(error.errors || {})) {
        errors.push({
          sourcePageKey: record.sourcePageKey,
          field,
          message: detail.message,
        });
      }
    }
  }
  return errors;
};

export const validateImportDocuments = async (prepared) => {
  const categoryErrors = await validationErrorsFor(prepared.categories);
  const productErrors = await validationErrorsFor(prepared.products);
  return [...categoryErrors, ...productErrors];
};

const serializeDocuments = (entries) => entries.map(({ record, document }) => ({
  sourcePageKey: record.sourcePageKey,
  entityKey: record.entityKey ?? null,
  payload: document.toObject({ depopulate: true, versionKey: false }),
}));

const importTransaction = async (prepared, models) => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required when --confirm-import is provided.');

  await models.mongoose.connect(uri);
  const session = await models.mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await models.Category.create(
        prepared.categories.map(({ document }) => document.toObject()),
        { session },
      );
      await models.Product.create(
        prepared.products.map(({ document }) => document.toObject()),
        { session },
      );
    });
  } finally {
    await session.endSession();
    await models.mongoose.disconnect();
  }
};

const main = async () => {
  const inputPath = path.resolve(process.argv[2] || path.join(OUTPUT_DIR, 'candidate-manifest.json'));
  const outputPath = path.resolve(process.argv[3] || path.join(OUTPUT_DIR, 'import-dry-run-v1.json'));
  const confirmed = process.argv.includes('--confirm-import');
  const manifest = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const models = await loadModels();
  const prepared = buildImportDocuments(manifest, models);
  const validationErrors = await validateImportDocuments(prepared);
  const report = {
    mode: confirmed ? 'confirmed-import' : 'dry-run',
    sourceManifest: path.relative(process.cwd(), inputPath).replace(/\\/g, '/'),
    defaultsApplied: prepared.defaultsApplied,
    issues: prepared.issues,
    validation: {
      status: validationErrors.length === 0 && prepared.issues.length === 0 ? 'valid' : 'invalid',
      errors: validationErrors,
    },
    categories: serializeDocuments(prepared.categories),
    products: serializeDocuments(prepared.products),
  };
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    output: path.relative(process.cwd(), outputPath).replace(/\\/g, '/'),
    mode: report.mode,
    validation: report.validation.status,
    categories: report.categories.length,
    products: report.products.length,
    errors: validationErrors.length + prepared.issues.length,
  }, null, 2));

  if (validationErrors.length > 0 || prepared.issues.length > 0) {
    process.exitCode = 1;
    return;
  }
  if (confirmed) await importTransaction(prepared, models);
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
