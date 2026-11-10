import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');
export const TEST_DATABASE = 'db-babyhub-test';
const ENV_PATH = path.resolve(__dirname, '../../.env');
const safetyError = (code) => Object.assign(new Error(code), { code });

export const assertTestDatabase = (databaseName) => {
  if (databaseName !== TEST_DATABASE) throw safetyError('UNSAFE_DATABASE');
};

export const loadImportConfiguration = async ({ readFile = fs.readFile } = {}) => {
  let values;
  try {
    values = dotenv.parse(await readFile(ENV_PATH, 'utf8'));
  } catch {
    throw safetyError('TEST_ENV_UNAVAILABLE');
  }
  const uri = values.DB_HOST_TEST?.trim();
  if (!uri) throw safetyError('DB_HOST_TEST_REQUIRED');
  // Never fall back to DB_HOST, MONGODB_URI or inherited environment variables.
  return Object.freeze({ uri, dbName: TEST_DATABASE });
};

export const parseImportArguments = (args) => {
  const positional = [];
  let confirmed = false;
  for (const arg of args) {
    if (arg === '--confirm-import' && !confirmed) confirmed = true;
    else if (arg.startsWith('--')) throw safetyError('INVALID_ARGUMENTS');
    else positional.push(arg);
  }
  if (positional.length > 2) throw safetyError('INVALID_ARGUMENTS');
  return {
    confirmed,
    inputPath: path.resolve(positional[0] || path.join(OUTPUT_DIR, 'candidate-manifest.json')),
    outputPath: path.resolve(positional[1] || path.join(OUTPUT_DIR, 'import-dry-run-v1.json')),
  };
};
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

export const assertImportScope = (prepared) => {
  if (prepared.issues.length || prepared.categories.length !== 1 || prepared.products.length !== 1) {
    throw safetyError('SINGLE_PAIR_REQUIRED');
  }
  for (const { record, document } of [...prepared.categories, ...prepared.products]) {
    if (sourceLocale(record) !== 'uk' || document.status !== 'draft') throw safetyError('UK_DRAFT_REQUIRED');
    const legacyUrl = document.importMeta?.legacyUrl;
    if (typeof legacyUrl !== 'string' || !/^https?:\/\//.test(legacyUrl)) {
      throw safetyError('SOURCE_IDENTITY_REQUIRED');
    }
  }
  if (String(prepared.products[0].document.category) !== String(prepared.categories[0].document._id)) {
    throw safetyError('CATEGORY_LINK_MISMATCH');
  }
};

export const openTestConnection = async (models, configuration) => {
  assertTestDatabase(configuration.dbName);
  const connection = models.mongoose.createConnection(configuration.uri, {
    dbName: TEST_DATABASE,
    autoCreate: false,
    autoIndex: false,
    bufferCommands: false,
    serverSelectionTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    return connection;
  } catch (error) {
    await connection.close().catch(() => {});
    throw error;
  }
};

// The mandatory unique _id index also protects simultaneous runs of the same slug,
// even in a new collection without the optional model indexes.
const importId = (models, type, slug) => new models.mongoose.Types.ObjectId(
  createHash('sha256').update(`babyhub-test-import-v1:${type}:${slug}`).digest('hex').slice(0, 24),
);

const findExisting = async (Model, document, session) => {
  const matches = await Model.find({ $or: [
    { _id: document._id },
    { 'slug.uk': document.slug.uk },
    { 'importMeta.legacyUrl': document.importMeta.legacyUrl },
  ] }).session(session).limit(2).exec();
  if (matches.length > 1) throw safetyError('DUPLICATE_IDENTITY');
  const existing = matches[0];
  if (existing) {
    if (existing.slug?.uk !== document.slug.uk
      || existing.importMeta?.legacyUrl !== document.importMeta.legacyUrl
      || existing.status !== 'draft') throw safetyError('EXISTING_DOCUMENT_CONFLICT');
    await existing.validate();
  }
  return existing;
};

export const runPreparedImport = async (prepared, models, {
  confirmed = false,
  configuration,
  openConnection = openTestConnection,
} = {}) => {
  assertImportScope(prepared);
  if ((await validateImportDocuments(prepared)).length) throw safetyError('INVALID_DOCUMENTS');
  // This branch must not read .env, open connections, start sessions or write documents.
  if (confirmed !== true) return { mode: 'dry-run', created: { categories: 0, products: 0 } };
  const target = configuration ?? await loadImportConfiguration();
  assertTestDatabase(target.dbName);
  if (!target.uri) throw safetyError('DB_HOST_TEST_REQUIRED');

  const connection = await openConnection(models, target);
  let session;
  try {
    assertTestDatabase(connection.db?.databaseName);
    const Category = connection.model('Category', models.Category.schema);
    const Product = connection.model('Product', models.Product.schema);
    session = await connection.startSession();
    return await session.withTransaction(async () => {
      assertTestDatabase(connection.db?.databaseName);
      const category = new Category(prepared.categories[0].document.toObject());
      category._id = importId(models, 'Category', category.slug.uk);
      const existingCategory = await findExisting(Category, category, session);
      if (existingCategory) category._id = existingCategory._id;

      const product = new Product(prepared.products[0].document.toObject());
      product._id = importId(models, 'Product', product.slug.uk);
      product.category = category._id;
      const existingProduct = await findExisting(Product, product, session);
      if (existingProduct && String(existingProduct.category) !== String(category._id)) {
        throw safetyError('CATEGORY_LINK_MISMATCH');
      }

      // Validate both final documents with their resolved IDs before the first insert.
      await category.validate();
      await product.validate();
      assertTestDatabase(connection.db?.databaseName);
      if (!existingCategory) await Category.create([category.toObject()], { session });
      if (!existingProduct) await Product.create([product.toObject()], { session });

      return {
        mode: 'confirmed-import',
        database: connection.db.databaseName,
        created: { categories: existingCategory ? 0 : 1, products: existingProduct ? 0 : 1 },
        reused: { categories: existingCategory ? 1 : 0, products: existingProduct ? 1 : 0 },
        categoryId: String(category._id),
        productId: String(existingProduct?._id ?? product._id),
      };
    }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    try {
      if (session) await session.endSession();
    } finally {
      await connection.close();
    }
  }
};

const main = async () => {
  const { inputPath, outputPath, confirmed } = parseImportArguments(process.argv.slice(2));
  const manifest = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const models = await loadModels();
  const prepared = buildImportDocuments(manifest, models);
  assertImportScope(prepared);
  const validationErrors = await validateImportDocuments(prepared);
  const report = {
    mode: confirmed ? 'confirmed-import' : 'dry-run',
    targetDatabase: TEST_DATABASE,
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
  const result = await runPreparedImport(prepared, models, { confirmed });
  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    // Driver errors may contain credentials/URIs. Only emit our fixed safety codes.
    const safeCodes = new Set([
      'UNSAFE_DATABASE', 'TEST_ENV_UNAVAILABLE', 'DB_HOST_TEST_REQUIRED', 'INVALID_ARGUMENTS',
      'SINGLE_PAIR_REQUIRED', 'UK_DRAFT_REQUIRED', 'SOURCE_IDENTITY_REQUIRED',
      'CATEGORY_LINK_MISMATCH', 'DUPLICATE_IDENTITY', 'EXISTING_DOCUMENT_CONFLICT', 'INVALID_DOCUMENTS',
    ]);
    console.error(JSON.stringify({ error: safeCodes.has(error.code) ? error.code : 'IMPORT_PREPARATION_FAILED' }));
    process.exitCode = 1;
  });
}
