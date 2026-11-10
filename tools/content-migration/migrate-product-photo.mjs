import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { createCloudinaryService, CloudinaryServiceError } from '../../src/lib/cloudinary.ts';
import { assertImportScope, buildImportDocuments, validateImportDocuments } from './prepare-import.mjs';
import { targetFor, assertTargetDatabase, assertWriteAuthorization, parseTargetArguments,
  loadTargetConfiguration, openTargetConnection } from './migration-target.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const TARGET = Object.freeze({
  slug: 'avtokreslo-adbor-capri',
  legacyUrl: 'https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html',
  photoUrl: 'https://lutsk.babyservice.ua/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg',
});
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const photoIdentity = (target) => {
  const specification = targetFor(target);
  // Preserve existing test ownership/recovery; main has a separate identity and namespace.
  const key = sha256(`${target === 'test' ? 'baby-service-photo-v1' : 'baby-service-photo-main-v1'}:${TARGET.photoUrl}`);
  return Object.freeze({ publicId: `${specification.namespace}/legacy-photo-${key}`,
    mediaId: key.slice(0, 24), filename: `legacy-photo-${key}.jpg` });
};
export const photoJournalPath = (target) => {
  targetFor(target);
  return path.join(ROOT, 'tools/content-migration/output',
    target === 'test' ? 'product-photo-journal-v1.json' : 'product-photo-journal-main-v1.json');
};
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
class PhotoMigrationError extends Error {
  constructor(code) { super(code); this.name = 'PhotoMigrationError'; this.code = code; }
}
const fail = (code) => { throw new PhotoMigrationError(code); };

export const parsePhotoArguments = (args) => {
  const { positional, ...selection } = parseTargetArguments(args);
  return selection;
};

export const inspectJpeg = (bytes) => {
  if (bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) fail('INVALID_JPEG');
  let offset = 2;
  let dimensions;
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 0xff) fail('INVALID_JPEG');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda) {
      if (!dimensions || offset + 2 > bytes.length) fail('INVALID_JPEG');
      const length = bytes.readUInt16BE(offset);
      if (length < 6 || offset + length >= bytes.length - 2) fail('INVALID_JPEG');
      return dimensions;
    }
    if (offset + 2 > bytes.length) fail('INVALID_JPEG');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length - 2) fail('INVALID_JPEG');
    if (frameMarkers.has(marker)) {
      if (length < 8) fail('INVALID_JPEG');
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height || width > 10000 || height > 10000) fail('INVALID_JPEG_DIMENSIONS');
      dimensions = { width, height };
    }
    offset += length;
  }
  fail('INVALID_JPEG');
};

export const fetchPhoto = async (fetchImpl = fetch) => {
  if (new URL(TARGET.photoUrl).protocol !== 'https:') fail('UNSAFE_PHOTO_URL');
  const response = await fetchImpl(TARGET.photoUrl, {
    redirect: 'manual', signal: AbortSignal.timeout(15000), headers: { Accept: 'image/jpeg' },
  });
  try {
    if (response.status !== 200 || response.url !== TARGET.photoUrl) fail('PHOTO_UNAVAILABLE_OR_REDIRECT');
    const mime = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (mime !== 'image/jpeg') fail('PHOTO_MIME_MISMATCH');
    const declared = response.headers.get('content-length');
    if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) < 1
      || Number(declared) > MAX_PHOTO_BYTES)) fail('PHOTO_SIZE_LIMIT');
    if (!response.body) fail('PHOTO_BODY_MISSING');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_PHOTO_BYTES) fail('PHOTO_SIZE_LIMIT');
      chunks.push(Buffer.from(chunk));
    }
    if (!size || (declared !== null && !response.headers.get('content-encoding') && Number(declared) !== size)) {
      fail('PHOTO_SIZE_MISMATCH');
    }
    const bytes = Buffer.concat(chunks);
    return { bytes, sizeBytes: size, mimeType: mime, format: 'jpg', sha256: sha256(bytes), ...inspectJpeg(bytes) };
  } finally {
    if (response.body && !response.body.locked) await response.body.cancel().catch(() => {});
  }
};

export const createPhotoJournal = (journalPath = photoJournalPath('test')) => ({
  async read() {
    try { return JSON.parse(await fs.readFile(journalPath, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return null; fail('JOURNAL_UNREADABLE'); }
  },
  async save(record) {
    // Flush before atomic replacement. Only fixed, non-secret metadata is serialized.
    const temporary = `${journalPath}.${randomUUID()}.tmp`;
    const handle = await fs.open(temporary, 'wx');
    try { await handle.writeFile(JSON.stringify(record, null, 2), 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, journalPath);
  },
});

const createPhotoOperations = ({ target, prepared }) => {
  targetFor(target);
  assertImportScope(prepared);
  const entry = prepared.products[0];
  const category = prepared.categories[0].document;
  if (entry.document.slug.uk !== TARGET.slug || entry.document.importMeta?.legacyUrl !== TARGET.legacyUrl ||
      entry.record.legacyUrl !== TARGET.legacyUrl ||
      !entry.record.imageLegacyUrls?.includes(TARGET.photoUrl)) fail('PHOTO_SOURCE_PRODUCT_MISMATCH');
  const specification = { ...TARGET, database: targetFor(target).dbName, productId: null };
  return buildOperations(specification, photoIdentity(target),
    target === 'test' ? 'baby-service-photo-v1' : `baby-service-photo-main-v1:${photoIdentity(target).mediaId}`,
    target, category);
};

const buildOperations = (TARGET, IDENTITY, TOOL, target, category) => {
  const productFilter = () => ({
    ...(TARGET.productId ? { _id: new mongoose.Types.ObjectId(TARGET.productId) } : {}),
    'slug.uk': TARGET.slug, 'importMeta.legacyUrl': TARGET.legacyUrl, status: 'draft',
  });

  const guardTarget = async (connection, session, allowMissing = false) => {
    assertTargetDatabase(connection.db?.databaseName, target);
    const collection = connection.db.collection('products');
    const product = await collection.findOne(productFilter(), { session });
    const matches = await collection.countDocuments({ $or: [
      ...(TARGET.productId ? [{ _id: new mongoose.Types.ObjectId(TARGET.productId) }] : []),
      { 'slug.uk': TARGET.slug }, { 'importMeta.legacyUrl': TARGET.legacyUrl },
    ] }, { session });
    if (!product) {
      if (allowMissing && matches === 0) return null;
      fail('TARGET_PRODUCT_MISMATCH');
    }
    if (matches !== 1 || !Array.isArray(product.images)
      || new Set(product.images.map(String)).size !== product.images.length) fail('TARGET_PRODUCT_CONFLICT');
    const linkedCategory = await connection.db.collection('categories').findOne({
      _id: product.category, 'slug.uk': category.slug.uk,
      'importMeta.legacyUrl': category.importMeta.legacyUrl, status: 'draft',
    }, { session });
    if (!linkedCategory) fail('TARGET_CATEGORY_MISMATCH');
    TARGET.productId = String(product._id);
    return product;
  };

  const provenance = (photo, account) => JSON.stringify({ tool: TOOL, publicId: IDENTITY.publicId, sourceSha256: photo.sha256, account });
  const journalBase = (photo, account) => ({
    version: 1, database: TARGET.database, productId: TARGET.productId, sourceUrl: TARGET.photoUrl,
    ...IDENTITY, sourceSha256: photo.sha256, sourceBytes: photo.sizeBytes, width: photo.width, height: photo.height, account,
  });
  const assertJournal = (record, base) => {
    if (!record) return;
    for (const [field, value] of Object.entries(base)) if (record[field] !== value) fail('JOURNAL_IDENTITY_CONFLICT');
    if (!['upload-intent', 'uploaded', 'committed'].includes(record.phase)) fail('JOURNAL_STATE_CONFLICT');
  };
  const assertCloudImage = (image, photo) => {
    if (!image || image.public_id !== IDENTITY.publicId || image.format !== 'jpg'
      || image.width !== photo.width || image.height !== photo.height || image.bytes !== photo.sizeBytes) fail('CLOUD_IMAGE_CONFLICT');
    let url;
    try { url = new URL(image.secure_url); } catch { fail('CLOUD_IMAGE_CONFLICT'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
      || url.hostname !== 'res.cloudinary.com') fail('CLOUD_IMAGE_CONFLICT');
  };
  const sameCloudImage = (a, b) => ['public_id', 'secure_url', 'width', 'height', 'bytes', 'format'].every(k => a?.[k] === b?.[k]);
  const imageRecord = (image) => Object.fromEntries(['public_id', 'secure_url', 'width', 'height', 'bytes', 'format'].map(k => [k, image[k]]));

  const mediaPayload = (photo, account, image) => ({
    _id: new mongoose.Types.ObjectId(IDENTITY.mediaId), filename: IDENTITY.filename,
    originalName: new URL(TARGET.photoUrl).pathname.split('/').at(-1), url: image.secure_url,
    mimeType: 'image/jpeg', sizeBytes: photo.sizeBytes, width: photo.width, height: photo.height,
    storageType: 'cloudinary',
    importMeta: { source: provenance(photo, account), legacyUrl: TARGET.photoUrl },
  });
  const findMedia = async (connection, photo, account, image, session) => {
    const candidates = await connection.db.collection('media').find({ $or: [
      { _id: new mongoose.Types.ObjectId(IDENTITY.mediaId) }, { filename: IDENTITY.filename },
      { 'importMeta.legacyUrl': TARGET.photoUrl }, ...(image ? [{ url: image.secure_url }] : []),
    ] }, { session }).limit(2).toArray();
    if (candidates.length > 1) fail('MEDIA_DUPLICATE_CONFLICT');
    const media = candidates[0];
    if (media && (String(media._id) !== IDENTITY.mediaId || media.filename !== IDENTITY.filename
      || media.importMeta?.legacyUrl !== TARGET.photoUrl || media.importMeta?.source !== provenance(photo, account)
      || media.storageType !== 'cloudinary' || media.mimeType !== 'image/jpeg'
      || media.sizeBytes !== photo.sizeBytes || media.width !== photo.width || media.height !== photo.height
      || (image && media.url !== image.secure_url))) fail('MEDIA_IDENTITY_CONFLICT');
    return media;
  };

  const acquireLock = async (connection, owner) => {
    await guardTarget(connection);
    try {
      const result = await connection.db.collection('content_migration_locks').updateOne(
        { _id: TOOL, owner: null, sourceUrl: TARGET.photoUrl },
        { $set: { owner }, $setOnInsert: { productId: TARGET.productId } }, { upsert: true },
      );
      if (!result.acknowledged || result.matchedCount + result.upsertedCount !== 1) fail('LOCK_NOT_ACQUIRED');
    } catch (error) { if (error.code === 11000) fail('PHOTO_MIGRATION_LOCKED'); throw error; }
  };

  return { TARGET, IDENTITY, TOOL, productFilter, guardTarget, journalBase, assertJournal,
    assertCloudImage, sameCloudImage, imageRecord, mediaPayload, findMedia, acquireLock };
};

export const runPhotoMigration = async ({
  confirmed = false, target, confirmDatabase, prepared, connection, models, cloudinary, account,
  journal, fetchImpl = fetch,
}) => {
  assertWriteAuthorization({ confirmed, target, confirmDatabase });
  const selectedTarget = target ?? 'test'; // Legacy dry-run only; writes require explicit target above.
  if ((await validateImportDocuments(prepared)).length) fail('INVALID_DOCUMENTS');
  const { TARGET, IDENTITY, TOOL, productFilter, guardTarget, journalBase, assertJournal,
    assertCloudImage, sameCloudImage, imageRecord, mediaPayload, findMedia, acquireLock } =
    createPhotoOperations({ target: selectedTarget, prepared });
  journal ??= createPhotoJournal(photoJournalPath(selectedTarget));
  const product = await guardTarget(connection, undefined, confirmed !== true);
  cloudinary.checkConfiguration();
  const photo = await fetchPhoto(fetchImpl);
  const base = journalBase(photo, account);
  const previewImage = { public_id: IDENTITY.publicId, secure_url: `https://res.cloudinary.com/preview/image/upload/${IDENTITY.publicId}.jpg`, width: photo.width, height: photo.height, bytes: photo.sizeBytes, format: 'jpg' };
  // The required URL is a clearly marked placeholder for model validation, never persisted.
  await new models.Media(mediaPayload(photo, account, previewImage)).validate();
  const before = await findMedia(connection, photo, account);
  if (!product && before) fail('MEDIA_WITHOUT_TARGET_PRODUCT');
  const saved = await journal.read();
  assertJournal(saved, base);
  const lock = await connection.db.collection('content_migration_locks').findOne({ _id: TOOL });
  if (lock?.owner != null) fail('PHOTO_MIGRATION_LOCKED');
  if (lock && (lock.sourceUrl !== TARGET.photoUrl || lock.productId !== TARGET.productId)) fail('LOCK_IDENTITY_CONFLICT');
  if (confirmed !== true) return {
    mode: 'dry-run', database: TARGET.database, productId: TARGET.productId, sourceUrl: TARGET.photoUrl,
    target: selectedTarget, dependency: product ? null : 'PRODUCT_IMPORT_REQUIRED',
    lock: lock ? 'available-existing' : 'absent', journalPath: path.relative(ROOT, photoJournalPath(selectedTarget)).replaceAll('\\', '/'),
    planned: { media: before ? 'reuse' : 'create-after-confirmed-upload', productImage: !product
      ? 'wait-for-product-import' : product.images.some(id => String(id) === IDENTITY.mediaId) ? 'reuse-link' : 'add-link' },
    ...IDENTITY, photo: { mimeType: photo.mimeType, format: photo.format, sizeBytes: photo.sizeBytes,
      width: photo.width, height: photo.height, sha256: photo.sha256 },
    mediaModelValidation: 'valid-with-preview-url', existingMedia: Boolean(before), journalPhase: saved?.phase ?? null,
    cloudResource: 'not-checked-in-dry-run', uploads: 0, mongoWrites: 0,
  };

  const owner = randomUUID();
  await acquireLock(connection, owner);
  try {
    await guardTarget(connection);
    let record = await journal.read();
    assertJournal(record, base);
    let existing = await findMedia(connection, photo, account);
    let image;
    try { image = await cloudinary.getImageInfo(IDENTITY.publicId); }
    catch (error) {
      if (!(error instanceof CloudinaryServiceError && error.code === 'CLOUDINARY_REQUEST_FAILED' && error.status === 404)) throw error;
    }
    let uploaded = false;
    if (image) {
      assertCloudImage(image, photo);
      const fromMedia = existing && existing.url === image.secure_url;
      const fromJournal = ['uploaded', 'committed'].includes(record?.phase) && sameCloudImage(record.image, image);
      if (!fromMedia && !fromJournal) fail('CLOUD_RESOURCE_UNKNOWN_ORIGIN');
    } else {
      if (existing || (record && record.phase !== 'upload-intent')) fail('MISSING_OR_AMBIGUOUS_CLOUD_RESOURCE');
      await guardTarget(connection);
      await journal.save({ ...base, phase: 'upload-intent' });
      await guardTarget(connection);
      // Upload the exact bytes that passed validation, avoiding a second remote fetch/TOCTOU.
      image = await cloudinary.uploadImage(`data:image/jpeg;base64,${photo.bytes.toString('base64')}`, { public_id: IDENTITY.publicId });
      uploaded = true;
      assertCloudImage(image, photo);
    }
    await guardTarget(connection);
    record = { ...base, phase: 'uploaded', image: imageRecord(image) };
    await journal.save(record); // Durable ownership evidence before any Media/Product write.

    const session = await connection.startSession();
    let result;
    try {
      result = await session.withTransaction(async () => {
        const product = await guardTarget(connection, session);
        existing = await findMedia(connection, photo, account, image, session);
        const payload = mediaPayload(photo, account, image);
        const now = new Date();
        const mediaDocument = new models.Media({ ...payload, createdAt: now, updatedAt: now });
        await mediaDocument.validate();
        const nextImages = product.images.some(id => String(id) === IDENTITY.mediaId)
          ? product.images : [...product.images, payload._id];
        await models.Product.hydrate({ ...product, images: nextImages }).validate();
        await guardTarget(connection, session);
        if (!existing) await connection.db.collection('media').insertOne(mediaDocument.toObject(), { session });
        await guardTarget(connection, session);
        const update = await connection.db.collection('products').updateOne(productFilter(),
          { $addToSet: { images: payload._id } }, { session });
        const expectedModified = nextImages.length === product.images.length ? 0 : 1;
        if (!update.acknowledged || update.matchedCount !== 1 || update.modifiedCount !== expectedModified) fail('PRODUCT_UPDATE_FAILED');
        const checked = await guardTarget(connection, session);
        if (checked.images.length !== nextImages.length
          || checked.images.filter(id => String(id) === IDENTITY.mediaId).length !== 1) fail('PRODUCT_LINK_VERIFICATION_FAILED');
        const checkedMedia = await findMedia(connection, photo, account, image, session);
        if (!checkedMedia) fail('MEDIA_VERIFICATION_FAILED');
        return { createdMedia: existing ? 0 : 1, productModified: update.modifiedCount };
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } });
    } finally { await session.endSession(); }
    const persistedProduct = await guardTarget(connection);
    if (persistedProduct.images.filter(id => String(id) === IDENTITY.mediaId).length !== 1
      || !await findMedia(connection, photo, account, image)) fail('POST_COMMIT_VERIFICATION_FAILED');
    await journal.save({ ...record, phase: 'committed' });
    return { mode: 'confirmed-import', database: TARGET.database, productId: TARGET.productId,
      ...IDENTITY, uploads: uploaded ? 1 : 0, ...result };
  } finally {
    // No TTL takeover: a crashed owner must be investigated, never automatically replaced.
    await guardTarget(connection);
    const release = await connection.db.collection('content_migration_locks').updateOne(
      { _id: TOOL, owner, sourceUrl: TARGET.photoUrl }, { $set: { owner: null } },
    );
    if (!release.acknowledged || release.matchedCount !== 1) fail('LOCK_RELEASE_FAILED');
  }
};

const main = async () => {
  const { confirmed, target, confirmDatabase } = parsePhotoArguments(process.argv.slice(2));
  const config = await loadTargetConfiguration({ target: target ?? 'test' });
  const env = dotenv.parse(await fs.readFile(path.join(ROOT, '.env'), 'utf8'));
  const cloudinary = createCloudinaryService({ env });
  cloudinary.checkConfiguration();
  const [{ default: Media }, { default: Product }, { default: Category }] = await Promise.all([
    import('../../src/models/Media.ts'), import('../../src/models/Product.ts'), import('../../src/models/Category.ts'),
  ]);
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'tools/content-migration/output/candidate-manifest.json'), 'utf8'));
  const prepared = buildImportDocuments(manifest, { Category, Product, mongoose });
  assertImportScope(prepared);
  const connection = await openTargetConnection({ mongoose }, config);
  try {
    const result = await runPhotoMigration({ confirmed, target, confirmDatabase, prepared,
      connection, models: { Media, Product }, cloudinary,
      account: sha256(env.CLOUDINARY_CLOUD_NAME.trim()) });
    console.log(JSON.stringify(result, null, 2));
  } finally { await connection.close(); }
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const safe = new Set(['TARGET_REQUIRED', 'MAIN_DATABASE_CONFIRMATION_REQUIRED', 'INVALID_ARGUMENTS',
      'UNSAFE_DATABASE', 'UNSAFE_DATABASE_URI', 'TARGET_ENV_UNAVAILABLE', 'DB_HOST_REQUIRED', 'DB_HOST_TEST_REQUIRED']);
    console.error(JSON.stringify({ error: error instanceof PhotoMigrationError || safe.has(error.code)
      ? error.code : 'PHOTO_MIGRATION_FAILED' }));
    process.exitCode = 1;
  });
}
