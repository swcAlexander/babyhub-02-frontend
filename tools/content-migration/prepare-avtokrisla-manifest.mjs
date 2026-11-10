// Stage 3.8.21: offline extraction from the explicitly fetched category snapshots.
// No MongoDB, Cloudinary or network access; never replaces an existing artifact.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { normalizeSlugValue } from '../../src/models/common.ts';

const output = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
const origin = 'https://lutsk.babyservice.ua';
const text = value => value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const cards = html => [...html.matchAll(/<a class="title" href="([^"]+)">([\s\S]*?)<\/a>/g)]
  .map(match => ({ path: match[1], name: text(match[2]) }));
const evidence = [];
const readSnapshot = async name => {
  const html = await fs.readFile(path.join(output, name), 'utf8');
  evidence.push({ file: `tools/content-migration/output/${name}`, sha256: createHash('sha256').update(html).digest('hex') });
  return html;
};
const categoryHtml = await readSnapshot('avtokrisla-category-3821.html');
const pages = [cards(categoryHtml)];
for (const page of [2, 3, 4]) pages.push(cards(await readSnapshot(`avtokrisla-page-${page}-3821.html`)));
const all = cards(await readSnapshot('avtokrisla-page-all-3821.html'));
const listed = pages.flat();
if (listed.length !== 20 || new Set(listed.map(card => card.path)).size !== 20
  || JSON.stringify(listed) !== JSON.stringify(all)) throw new Error('CATEGORY_PAGINATION_MISMATCH');
const pagination = [...categoryHtml.matchAll(/href="([^"]*\/avtokrisla\/page-[^"]+)"/g)].map(match => match[1]);
if (pagination.some(url => !/\/page-(2|3|4|all)\.html$/.test(url))) throw new Error('UNREVIEWED_PAGINATION');

const historical = JSON.parse(await fs.readFile(path.join(output, 'candidate-manifest.json'), 'utf8'));
const category = structuredClone(historical.categories.find(record => record.locale === 'uk'));
category.name = { uk: 'Автокрісла' };
category.localeMatch = 'unconfirmed'; // Standalone UK records, no claim of a verified RU pair.
const products = [];
const media = [];
const excludedImages = [];
// Verified by a manual HTTPS GET in this stage: 404 text/html, no redirect.
const missingPhoto = origin + '/image/BabyServiseLcbuster1.jpg';
for (const card of listed) {
  if (!/^\/avtokrisla\/(?!page-)[^/]+\.html$/.test(card.path)) throw new Error('UNSAFE_PRODUCT_PATH');
  const html = await readSnapshot(`3821-${card.path.split('/').at(-1).replace('.html', '')}.html`);
  if (!/lang="ua-ua"/.test(html) || !/<span>укр<\/span>/.test(html)) throw new Error('UK_SOURCE_REQUIRED');
  const legacyUrl = origin + card.path;
  const slug = normalizeSlugValue(card.path.split('/').at(-1).replace('.html', ''));
  const old = historical.products.find(record => record.legacyUrl === legacyUrl);
  const description = text(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '');
  const images = [...new Set([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => new URL(match[1], origin).href))];
  const imageLegacyUrls = images.filter(url => /^https:\/\/lutsk\.babyservice\.ua\/(images\/prods|image)\/[^/]+\.jpg$/i.test(url));
  excludedImages.push(...images.filter(url => !imageLegacyUrls.includes(url)).map(url => ({ product: legacyUrl, url, reason: 'service-image-or-logo' })));
  const conflict = card.path.includes('avtokreslo_nanya_sp_lx');
  const issues = conflict ? [{ code: 'SOURCE_MODEL_IDENTITY_CONFLICT', severity: 'error', status: 'review',
    message: 'Category/breadcrumb/description/photo identify 4Baby Weelmo (9-25kg), but URL/title/H1 identify Nanya SP LX (9-36kg). Manual identity decision required; no automatic renaming.' }] : [];
  const record = {
    ...(old ?? {}), sourcePageKey: `page:uk:product:${slug}`, entityKey: `entity:product:${slug}`,
    locale: 'uk', localeMatch: 'unconfirmed', legacyUrl, normalizedUrl: card.path,
    categoryEntityKey: category.entityKey, name: { uk: card.name }, slug: { uk: slug },
    ...(description ? { shortDescription: { uk: description }, description: { uk: description } } : {}),
    imageLegacyUrls, pricingRaw: { type: 'rental', amount: null, currency: null, periodDays: null, unit: null, isConfirmed: false },
    availabilityRaw: { rawText: null, normalized: null, confidence: 'unknown' },
    status: conflict ? 'review' : 'accept', issues,
    evidence: [{ url: legacyUrl, sourceType: 'html', note: 'UK marker, category title, product photos and description checked in stage 3.8.21; no RU extraction.' }],
    sourceIdentity: { categoryName: card.name, h1: text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ''),
      breadcrumb: text(html.match(/<div class="brdcrmbs">([\s\S]*?)<\/div>/)?.[1] ?? '') },
  };
  products.push(record);
  imageLegacyUrls.forEach((url, index) => media.push({
    sourcePageKey: record.sourcePageKey, entityKey: `${record.entityKey}:media:${index}`,
    legacyUrl: url, normalizedUrl: url, filename: new URL(url).pathname.split('/').at(-1),
    alt: { uk: card.name }, linkedProductEntityKeys: [record.entityKey], linkedCategoryEntityKeys: [],
    availability: url === missingPhoto ? 'missing' : 'unknown', duplicateOf: null,
    status: url === missingPhoto ? 'review' : record.status,
    issues: url === missingPhoto ? [{ code: 'SOURCE_PHOTO_HTTP_404', severity: 'error', status: 'review',
      message: 'HTTPS GET returned 404 text/html without redirect in stage 3.8.21; excluded from executable photo selection.' }] : issues,
    evidence: [{ url: legacyUrl, sourceType: 'html', note: 'Product image or inline product photo; logo excluded. Bytes checked separately by photo dry-run.' }],
  }));
}
const manifest = {
  manifestVersion: '0.1.0-dry-run', generatedAt: new Date().toISOString(),
  source: { kind: 'public-legacy-site', rootUrl: origin + '/', notes: [
    'Stage 3.8.21: UK avtokrisla only; historical control manifest reused, never replaced.',
    'Pages 1-4 (6+6+6+2) exactly match page-all (20); no RU records.',
    'Unconfirmed rental price remains deferred 0 UAH in importMeta; no invented tariff.',
  ] },
  categories: [category], products, media, pages: [],
  extraction: { categoryUrl: origin + '/avtokrisla.html', pageCounts: pages.map(page => page.length), allCount: all.length,
    snapshots: evidence, excludedImages, blockedProducts: products.filter(record => record.status === 'review').map(record => record.legacyUrl) },
};
await fs.writeFile(path.join(output, 'avtokrisla-uk-manifest-3821.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
const ready = { ...manifest,
  products: products.filter(record => record.status === 'accept').map(record => ({ ...record,
    imageLegacyUrls: record.imageLegacyUrls.filter(url => url !== missingPhoto) })),
  media: media.filter(record => record.status === 'accept') };
await fs.writeFile(path.join(output, 'avtokrisla-uk-ready-3821.json'), JSON.stringify(ready, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ products: products.length, ready: ready.products.length, photos: media.length, blocked: products.length - ready.products.length }));
