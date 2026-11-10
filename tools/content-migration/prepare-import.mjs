import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { safetyError, targetFor, assertTargetDatabase, assertWriteAuthorization,
  parseTargetArguments, loadTargetConfiguration, openTargetConnection } from './migration-target.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');
export const TEST_DATABASE = 'db-babyhub-test';

export const assertTestDatabase = (databaseName) => {
  if (databaseName !== TEST_DATABASE) throw safetyError('UNSAFE_DATABASE');
};

export const loadImportConfiguration = loadTargetConfiguration;

export const parseImportArguments = (args) => {
  const batch = args.includes('--batch');
  if (args.filter(arg => arg === '--batch').length > 1) throw safetyError('INVALID_ARGUMENTS');
  const { positional, ...selection } = parseTargetArguments(args.filter(arg => arg !== '--batch'), { maxPositional: 2 });
  return {
    ...selection,
    batch,
    inputPath: path.resolve(positional[0] || path.join(OUTPUT_DIR, 'candidate-manifest.json')),
    outputPath: path.resolve(positional[1] || path.join(OUTPUT_DIR,
      batch ? `import-batch-dry-run-${selection.target ?? 'local'}-v1.json`
        : selection.target ? `import-dry-run-${selection.target}-v1.json` : 'import-dry-run-v1.json')),
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

export const assertImportScope = (prepared, { batch = false } = {}) => {
  if (prepared.issues.length || prepared.categories.length !== 1 || prepared.products.length < 1
    || prepared.products.length > (batch ? 50 : 1)) {
    throw safetyError('SINGLE_PAIR_REQUIRED');
  }
  for (const { record, document } of [...prepared.categories, ...prepared.products]) {
    if (record.status === 'review' || record.status === 'reject' || record.issues?.some(issue => issue.severity === 'error')) {
      throw safetyError('UNREVIEWED_SOURCE');
    }
    if (sourceLocale(record) !== 'uk' || document.status !== 'draft') throw safetyError('UK_DRAFT_REQUIRED');
    const legacyUrl = document.importMeta?.legacyUrl;
    if (typeof legacyUrl !== 'string' || !/^https?:\/\//.test(legacyUrl)) {
      throw safetyError('SOURCE_IDENTITY_REQUIRED');
    }
  }
  for (const entries of [prepared.categories, prepared.products]) {
    for (const field of ['legacyUrl', 'slug', 'entityKey']) {
      const values = entries.map(({ record, document }) => field === 'legacyUrl' ? document.importMeta.legacyUrl
        : field === 'slug' ? document.slug.uk : record.entityKey);
      if (values.some(value => !value) || new Set(values).size !== values.length) throw safetyError('DUPLICATE_IDENTITY');
    }
  }
  if (prepared.products.some(({ document }) => String(document.category) !== String(prepared.categories[0].document._id))) {
    throw safetyError('CATEGORY_LINK_MISMATCH');
  }
};

export const openTestConnection = async (models, configuration) => {
  assertTestDatabase(configuration.dbName);
  return openTargetConnection(models, { ...configuration, target: 'test' });
};

// The mandatory unique _id index also protects simultaneous runs of the same slug,
// even in a new collection without the optional model indexes.
export const importId = (models, type, slug, target) => new models.mongoose.Types.ObjectId(
  createHash('sha256').update(`babyhub-${target}-import-v1:${type}:${slug}`).digest('hex').slice(0, 24),
);

const findExisting = async (Model, document, session, target) => {
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
      || !['draft', ...(target === 'main' ? ['published'] : [])].includes(existing.status)) throw safetyError('EXISTING_DOCUMENT_CONFLICT');
    await existing.validate();
  }
  return existing;
};

export const runPreparedImport = async (prepared, models, {
  confirmed = false,
  target,
  confirmDatabase,
  configuration,
  openConnection = openTargetConnection,
  batch = false,
} = {}) => {
  assertWriteAuthorization({ confirmed, target, confirmDatabase });
  assertImportScope(prepared, { batch });
  if ((await validateImportDocuments(prepared)).length) throw safetyError('INVALID_DOCUMENTS');
  // This branch must not read .env, open connections, start sessions or write documents.
  if (confirmed !== true && target === undefined) return { mode: 'dry-run', created: { categories: 0, products: 0 } };
  const config = configuration ?? await loadImportConfiguration({ target });
  if (config.target !== target) throw safetyError('UNSAFE_DATABASE');
  assertTargetDatabase(config.dbName, target);
  if (!config.uri) throw safetyError(`${targetFor(target).variable}_REQUIRED`);

  const connection = await openConnection(models, config);
  let session;
  try {
    assertTargetDatabase(connection.db?.databaseName, target);
    const Category = connection.model('Category', models.Category.schema);
    const Product = connection.model('Product', models.Product.schema);
    const execute = async () => {
      assertTargetDatabase(connection.db?.databaseName, target);
      const category = new Category(prepared.categories[0].document.toObject());
      category._id = importId(models, 'Category', category.slug.uk, target);
      const existingCategory = await findExisting(Category, category, session, target);
      if (existingCategory) category._id = existingCategory._id;

      const resolved = [];
      for (const entry of prepared.products) {
        const product = new Product(entry.document.toObject());
        product._id = importId(models, 'Product', product.slug.uk, target);
        product.category = category._id;
        const existingProduct = await findExisting(Product, product, session, target);
        if (existingProduct && String(existingProduct.category) !== String(category._id)) {
          throw safetyError('CATEGORY_LINK_MISMATCH');
        }
        await product.validate();
        resolved.push({ product, existingProduct });
      }
      const { product, existingProduct } = resolved[0];
      const products = resolved.map(({ product, existingProduct }) => ({
        legacyUrl: product.importMeta.legacyUrl, slug: product.slug.uk,
        productId: String(existingProduct?._id ?? product._id),
        action: existingProduct ? 'reuse' : 'create-draft', existingStatus: existingProduct?.status ?? null,
      }));

      // Validate both final documents with their resolved IDs before the first insert.
      await category.validate();
      await product.validate();
      assertTargetDatabase(connection.db?.databaseName, target);
      if (confirmed !== true) return {
        mode: 'dry-run', target, database: connection.db.databaseName,
        planned: { categories: existingCategory ? 'reuse' : 'create-draft', products: batch ? {
          createDraft: resolved.filter(item => !item.existingProduct).length,
          reuse: resolved.filter(item => item.existingProduct).length,
        } : existingProduct ? 'reuse' : 'create-draft' },
        categoryId: String(category._id), productId: String(existingProduct?._id ?? product._id),
        ...(batch ? { products, categoryAction: existingCategory ? 'reuse' : 'create-draft' } : {}),
        mongoWrites: 0,
      };
      if (!existingCategory) await Category.create([category.toObject()], { session });
      for (const { product, existingProduct } of resolved) {
        if (!existingProduct) await Product.create([product.toObject()], { session });
      }

      return {
        mode: 'confirmed-import',
        target,
        database: connection.db.databaseName,
        created: { categories: existingCategory ? 0 : 1, products: resolved.filter(item => !item.existingProduct).length },
        reused: { categories: existingCategory ? 1 : 0, products: resolved.filter(item => item.existingProduct).length },
        categoryId: String(category._id),
        productId: String(existingProduct?._id ?? product._id),
        ...(batch ? { products } : {}),
      };
    };
    if (confirmed !== true) return await execute();
    session = await connection.startSession();
    return await session.withTransaction(execute,
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
  } finally {
    try {
      if (session) await session.endSession();
    } finally {
      await connection.close();
    }
  }
};

const main = async () => {
  const { inputPath, outputPath, confirmed, target, confirmDatabase, batch } = parseImportArguments(process.argv.slice(2));
  const manifest = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const models = await loadModels();
  const prepared = buildImportDocuments(manifest, models);
  assertImportScope(prepared, { batch });
  const validationErrors = await validateImportDocuments(prepared);
  const report = {
    mode: confirmed ? 'confirmed-import' : 'dry-run',
    target: target ?? null,
    targetDatabase: target ? targetFor(target).dbName : TEST_DATABASE,
    databaseChecked: false,
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
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), { encoding: 'utf8', ...(batch ? { flag: 'wx' } : {}) });
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
  const result = await runPreparedImport(prepared, models, { confirmed, target, confirmDatabase, batch });
  report.databaseChecked = Boolean(target);
  report.result = result;
  if (target) {
    report.categories[0].payload._id = result.categoryId;
    for (const product of report.products) {
      product.payload._id = batch ? result.products.find(item => item.legacyUrl === product.payload.importMeta.legacyUrl).productId : result.productId;
      product.payload.category = result.categoryId;
    }
  }
  await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    // Driver errors may contain credentials/URIs. Only emit our fixed safety codes.
    const safeCodes = new Set([
      'UNSAFE_DATABASE', 'TEST_ENV_UNAVAILABLE', 'DB_HOST_TEST_REQUIRED', 'INVALID_ARGUMENTS',
      'SINGLE_PAIR_REQUIRED', 'UK_DRAFT_REQUIRED', 'SOURCE_IDENTITY_REQUIRED',
      'CATEGORY_LINK_MISMATCH', 'DUPLICATE_IDENTITY', 'EXISTING_DOCUMENT_CONFLICT', 'INVALID_DOCUMENTS',
      'TARGET_REQUIRED', 'MAIN_DATABASE_CONFIRMATION_REQUIRED', 'TARGET_ENV_UNAVAILABLE',
      'DB_HOST_REQUIRED', 'UNSAFE_DATABASE_URI',
      'UNREVIEWED_SOURCE',
    ]);
    console.error(JSON.stringify({ error: safeCodes.has(error.code) ? error.code : 'IMPORT_PREPARATION_FAILED' }));
    process.exitCode = 1;
  });
}
