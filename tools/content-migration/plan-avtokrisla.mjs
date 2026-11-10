// Read-only category orchestration. Writes only a NEW local report, never journals.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { buildImportDocuments, validateImportDocuments, runPreparedImport, importId } from './prepare-import.mjs';
import { runPhotoMigration, fetchPhoto } from './migrate-product-photo.mjs';
import { parseTargetArguments, loadTargetConfiguration, openTargetConnection, safetyError } from './migration-target.mjs';
import { validateManifest } from './validate-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'tools/content-migration/output');
const hash = value => createHash('sha256').update(value).digest('hex');
const SAFE = new Set(['DUPLICATE_IDENTITY', 'EXISTING_DOCUMENT_CONFLICT', 'CATEGORY_LINK_MISMATCH',
  'UNREVIEWED_SOURCE', 'PHOTO_SOURCE_PRODUCT_MISMATCH', 'PHOTO_MIGRATION_LOCKED', 'LOCK_IDENTITY_CONFLICT',
  'JOURNAL_IDENTITY_CONFLICT', 'JOURNAL_STATE_CONFLICT', 'JOURNAL_UNREADABLE', 'MEDIA_DUPLICATE_CONFLICT',
  'MEDIA_IDENTITY_CONFLICT', 'MEDIA_WITHOUT_TARGET_PRODUCT', 'TARGET_PRODUCT_MISMATCH', 'TARGET_PRODUCT_CONFLICT',
  'TARGET_CATEGORY_MISMATCH', 'PUBLISHED_PRODUCT_IMMUTABLE', 'CLOUD_IMAGE_CONFLICT', 'PHOTO_UNAVAILABLE_OR_REDIRECT',
  'PHOTO_MIME_MISMATCH', 'PHOTO_SIZE_LIMIT', 'PHOTO_SIZE_MISMATCH', 'PHOTO_BODY_MISSING', 'INVALID_JPEG',
  'INVALID_JPEG_DIMENSIONS', 'UNSAFE_PHOTO_URL']);
const safeCode = error => SAFE.has(error.code) ? error.code : 'READ_ONLY_PLAN_FAILED';

export const parsePlanArguments = args => {
  const selection = parseTargetArguments(args, { maxPositional: 1 });
  if (selection.confirmed || selection.confirmDatabase !== undefined || !selection.target) throw safetyError('READ_ONLY_TARGET_REQUIRED');
  return { target: selection.target, reportPath: path.resolve(selection.positional[0]
    ?? path.join(output, `avtokrisla-dry-run-${selection.target}-3821.json`)) };
};

// Defense in depth: even an accidental write through a reused helper fails locally.
export const forbidDriverMutations = () => {
  let attempts = 0;
  const saved = [];
  for (const [prototype, names] of [
    [mongoose.mongo.Collection.prototype, ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne',
      'deleteOne', 'deleteMany', 'bulkWrite', 'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete',
      'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename']],
    [mongoose.mongo.Db.prototype, ['createCollection', 'dropCollection', 'dropDatabase', 'createIndex']],
    [mongoose.mongo.ClientSession.prototype, ['startTransaction', 'withTransaction']],
  ]) for (const name of names) {
    if (typeof prototype[name] !== 'function') continue;
    saved.push([prototype, name, prototype[name]]);
    prototype[name] = () => { attempts++; throw safetyError('MUTATION_FORBIDDEN'); };
  }
  return { attempts: () => attempts, restore: () => saved.forEach(([prototype, name, value]) => { prototype[name] = value; }) };
};

const main = async () => {
  const { target, reportPath } = parsePlanArguments(process.argv.slice(2));
  try { await fs.access(reportPath); throw safetyError('REPORT_ALREADY_EXISTS'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const protectedPaths = ['.env', 'tools/content-migration/output/product-photo-journal-main-v1.json',
    'tools/content-migration/output/product-photo-journal-v1.json', 'tools/content-migration/output/candidate-manifest.json'];
  const protectedHashes = async () => Promise.all(protectedPaths.map(async name => hash(await fs.readFile(path.join(root, name)))));
  const filesBefore = await protectedHashes();
  const manifestPath = path.join(output, 'avtokrisla-uk-manifest-3821.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const validation = validateManifest(manifest, 'tools/content-migration/output/avtokrisla-uk-manifest-3821.json');
  if (validation.structuralValidation.status !== 'valid') throw safetyError('INVALID_MANIFEST');
  const [{ default: Category }, { default: Product }, { default: Media }] = await Promise.all([
    import('../../src/models/Category.ts'), import('../../src/models/Product.ts'), import('../../src/models/Media.ts'),
  ]);
  const models = { Category, Product, Media, mongoose };
  const env = dotenv.parse(await fs.readFile(path.join(root, '.env'), 'utf8'));
  if (!env.CLOUDINARY_CLOUD_NAME?.trim()) throw safetyError('PHOTO_ACCOUNT_REQUIRED');
  const account = hash(env.CLOUDINARY_CLOUD_NAME.trim());
  const configuration = await loadTargetConfiguration({ target });
  const guard = forbidDriverMutations();
  let connection;
  try {
    connection = await openTargetConnection(models, configuration);
    // Snapshots cover only the new catalog and its locks, never legacy user documents.
    const catalogSnapshot = async () => {
      const result = {};
      for (const name of ['categories', 'products', 'media', 'content_migration_locks']) {
        const docs = await connection.db.collection(name).find({}).sort({ _id: 1 }).toArray();
        result[name] = { count: docs.length, sha256: hash(JSON.stringify(docs)) };
      }
      return result;
    };
    const before = await catalogSnapshot();
    const report = { stage: '3.8.21', mode: 'dry-run', generatedAt: new Date().toISOString(), target,
      database: connection.db.databaseName, sourceManifest: path.relative(root, manifestPath).replaceAll('\\', '/'),
      validation, category: null, products: [], photos: [], mongoWrites: 0, uploads: 0, cloudResource: 'not-checked-in-dry-run' };
    for (const record of manifest.products) {
      const pair = { ...manifest, products: [record] };
      const prepared = buildImportDocuments(pair, models);
      const errors = await validateImportDocuments(prepared);
      const candidates = await connection.db.collection('products').find({ $or: [
        { _id: importId(models, 'Product', record.slug.uk, target) },
        { 'slug.uk': record.slug.uk }, { 'importMeta.legacyUrl': record.legacyUrl },
      ] }).limit(3).toArray();
      const product = { name: record.name.uk, legacyUrl: record.legacyUrl, slug: record.slug.uk,
        category: 'avtokrisla', action: 'blocked', issues: [...record.issues],
        databaseMatches: candidates.map(doc => ({ id: String(doc._id), slug: doc.slug?.uk,
          legacyUrl: doc.importMeta?.legacyUrl, categoryId: String(doc.category), status: doc.status })),
        validationErrors: errors };
      if (record.status === 'accept' && !errors.length) {
        try {
          const result = await runPreparedImport(prepared, models, { target, configuration,
            openConnection: async () => ({ db: connection.db, model: connection.model.bind(connection), close: async () => {} }) });
          product.action = result.planned.products;
          product.productId = result.productId;
          if (!report.category) report.category = { action: result.planned.categories, id: result.categoryId,
            slug: 'avtokrisla', legacyUrl: manifest.categories[0].legacyUrl };
        } catch (error) { product.issues.push({ code: safeCode(error) }); }
      }
      report.products.push(product);
      for (const url of record.imageLegacyUrls) {
        if (product.action === 'blocked') {
          // Inventory the source image, but do not offer any upload plan for a blocked identity.
          let photo;
          try { const { bytes, ...metadata } = await fetchPhoto(fetch, url); photo = metadata; }
          catch (error) { photo = { error: safeCode(error) }; }
          report.photos.push({ product: record.legacyUrl, sourceUrl: url, action: 'blocked',
            dependency: 'PRODUCT_IDENTITY_REVIEW_REQUIRED', photo });
          continue;
        }
        try {
          const result = await runPhotoMigration({ target, prepared, photoUrl: url, connection, models, account,
            cloudinary: { checkConfiguration() {} } }); // Deliberately has no upload/delete/lookup methods.
          report.photos.push({ product: record.legacyUrl, action: result.existingMedia ? 'reuse'
            : result.dependency ? 'wait-for-product-import' : 'create-after-confirmed-upload', ...result });
        } catch (error) { report.photos.push({ product: record.legacyUrl, sourceUrl: url, action: 'blocked', issue: safeCode(error) }); }
      }
    }
    // Preflight the entire accepted batch with the same transactional importer used by its future write mode.
    const ready = JSON.parse(await fs.readFile(path.join(output, 'avtokrisla-uk-ready-3821.json'), 'utf8'));
    report.batch = await runPreparedImport(buildImportDocuments(ready, models), models, { target, configuration, batch: true,
      openConnection: async () => ({ db: connection.db, model: connection.model.bind(connection), close: async () => {} }) });
    const after = await catalogSnapshot();
    const filesAfter = await protectedHashes();
    report.verification = { catalogBefore: before, catalogAfter: after,
      catalogUnchanged: JSON.stringify(before) === JSON.stringify(after),
      protectedFiles: protectedPaths.map((name, index) => ({ path: name, unchanged: filesBefore[index] === filesAfter[index] })),
      mutationAttempts: guard.attempts() };
    if (!report.verification.catalogUnchanged || filesBefore.some((value, index) => value !== filesAfter[index]) || guard.attempts()) {
      throw safetyError('READ_ONLY_VERIFICATION_FAILED');
    }
    report.summary = { products: report.products.length, newProducts: report.products.filter(item => item.action === 'create-draft').length,
      reusedProducts: report.products.filter(item => item.action === 'reuse').length,
      blockedProducts: report.products.filter(item => item.action === 'blocked').length,
      photos: report.photos.length, reusedPhotos: report.photos.filter(item => item.action === 'reuse').length,
      dependentPhotos: report.photos.filter(item => item.action === 'wait-for-product-import').length,
      blockedPhotos: report.photos.filter(item => item.action === 'blocked').length };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ report: path.relative(root, reportPath).replaceAll('\\', '/'), ...report.summary,
      mongoWrites: 0, uploads: 0, mutationAttempts: guard.attempts(), catalogUnchanged: true }));
  } finally {
    try { if (connection) await connection.close(); } finally { guard.restore(); }
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const safe = new Set(['READ_ONLY_TARGET_REQUIRED', 'REPORT_ALREADY_EXISTS', 'INVALID_MANIFEST', 'PHOTO_ACCOUNT_REQUIRED',
      'READ_ONLY_VERIFICATION_FAILED', 'UNSAFE_DATABASE', 'UNSAFE_DATABASE_URI', 'DB_HOST_REQUIRED', 'DB_HOST_TEST_REQUIRED',
      'TARGET_REQUIRED', 'INVALID_ARGUMENTS', 'MAIN_DATABASE_CONFIRMATION_REQUIRED', 'TARGET_ENV_UNAVAILABLE']);
    console.error(JSON.stringify({ error: safe.has(error.code) ? error.code : safeCode(error) }));
    process.exitCode = 1;
  });
}
