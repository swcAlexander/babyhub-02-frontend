import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './validate-manifest.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.join(__dirname, 'output');

const ALLOWED_URLS = [
  'https://lutsk.babyservice.ua/avtokrisla.html',
  'https://lutsk.babyservice.ua/ru/avtokrisla.html',
  'https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html',
  'https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html',
];

const HEADERS = {
  'User-Agent': 'BabyServiceMigrationDryRun/1.0 (+https://lutsk.babyservice.ua)',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const normalizeSlug = (value) => {
  if (!value) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const stripTags = (value) => String(value || '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim();

const canonicalUrl = (value) => {
  try {
    const normalized = new URL(value, 'https://lutsk.babyservice.ua');
    return normalized.href.replace(/#.*$/, '').replace(/[?].*$/, '');
  } catch {
    return value;
  }
};

const getLocale = (url) => {
  const normalized = new URL(url);
  return normalized.pathname.startsWith('/ru/') ? 'ru' : 'uk';
};

const getBaseSlug = (url) => {
  const normalized = new URL(url);
  const segments = normalized.pathname
    .replace(/\/$/, '')
    .split('/')
    .filter(Boolean)
    .filter((segment) => segment !== 'ru');
  const last = segments.at(-1) || '';
  return normalizeSlug(last.replace(/\.html$/i, ''));
};

const getSourcePageKey = (kind, url) => {
  const slug = getBaseSlug(url);
  return `page:${getLocale(url)}:${kind}:${slug}`;
};

const getMeta = (html, name) => {
  const regex = new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const match = html.match(regex);
  if (match) return stripTags(match[1]);
  const aliasRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`, 'i');
  const aliasMatch = html.match(aliasRegex);
  return aliasMatch ? stripTags(aliasMatch[1]) : '';
};

const getTitle = (html) => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripTags(titleMatch ? titleMatch[1] : '');
};

const getH1 = (html) => {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return stripTags(match ? match[1] : '');
};

const getImageUrls = (html) => {
  const matches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const unique = [...new Set(matches.filter(Boolean))];
  return unique.map((src) => canonicalUrl(src));
};

const getAnchorLinks = (html) => {
  const matches = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return matches
    .map((match) => ({ href: match[1], text: stripTags(match[2]) }))
    .filter((entry) => entry.href && /\.html$/i.test(entry.href));
};

const getPriceText = (html) => {
  const text = stripTags(html);
  const terms = ['грн', 'доба', 'тиждень', 'місяць', 'аванс', 'оренда', 'прокат', 'uah', 'цена', 'ціна'];
  const hits = terms.filter((term) => text.toLowerCase().includes(term.toLowerCase()));
  if (hits.length === 0) return null;

  const lower = text.toLowerCase();
  const candidate = terms
    .map((term) => {
      const index = lower.indexOf(term.toLowerCase());
      return index >= 0 ? [index, term] : null;
    })
    .filter(Boolean)
    .sort((a, b) => a[0] - b[0])[0];

  if (!candidate) return null;

  const index = candidate[0];
  return text.slice(Math.max(0, index - 180), index + 500).replace(/\s+/g, ' ').trim();
};

const parseCategoryPage = (url, html) => {
  const locale = getLocale(url);
  const sourcePageKey = getSourcePageKey('category', url);
  const title = getTitle(html) || getH1(html);
  const description = getMeta(html, 'description');
  const slug = getBaseSlug(url);
  const localizedName = locale === 'uk' ? { uk: title || null, ru: null } : { uk: null, ru: title || null };
  const localizedSlug = locale === 'uk' ? { uk: slug || null, ru: null } : { uk: null, ru: slug || null };
  const localizedDescription = locale === 'uk' ? { uk: description || null, ru: null } : { uk: null, ru: description || null };

  return {
    sourcePageKey,
    entityKey: null,
    localeMatch: 'unconfirmed',
    legacyUrl: url,
    normalizedUrl: new URL(url).pathname.replace(/\/$/, ''),
    locale,
    name: localizedName,
    slug: localizedSlug,
    description: localizedDescription,
    status: 'accept',
    issues: [],
    evidence: [{ url, sourceType: 'html', note: 'Legacy category page extracted from public HTML.' }],
  };
};

const parseProductPage = (url, html) => {
  const locale = getLocale(url);
  const sourcePageKey = getSourcePageKey('product', url);
  const title = getTitle(html) || getH1(html);
  const metaDescription = getMeta(html, 'description');
  const images = getImageUrls(html);
  const slug = getBaseSlug(url);
  const localizedName = locale === 'uk' ? { uk: title || null, ru: null } : { uk: null, ru: title || null };
  const localizedSlug = locale === 'uk' ? { uk: slug || null, ru: null } : { uk: null, ru: slug || null };
  const localizedDescription = locale === 'uk' ? { uk: metaDescription || null, ru: null } : { uk: null, ru: metaDescription || null };

  const priceText = getPriceText(html);
  const pricingRaw = priceText
    ? {
        rawText: priceText,
        currency: /грн|uah|₴/i.test(priceText) ? 'UAH' : null,
        type: /доба|тиждень|місяць|оренда|прокат|аванс/i.test(priceText) ? 'rental' : 'unknown',
        amount: null,
        periodDays: null,
        isConfirmed: false,
      }
    : {
        rawText: null,
        currency: null,
        type: 'unknown',
        amount: null,
        periodDays: null,
        isConfirmed: false,
      };

  return {
    sourcePageKey,
    entityKey: null,
    localeMatch: 'unconfirmed',
    legacyUrl: url,
    normalizedUrl: new URL(url).pathname.replace(/\/$/, ''),
    categoryEntityKey: null,
    name: localizedName,
    slug: localizedSlug,
    shortDescription: localizedDescription,
    description: localizedDescription,
    imageLegacyUrls: images,
    pricingRaw,
    availabilityRaw: {
      rawText: null,
      normalized: null,
      confidence: 'unknown',
    },
    status: 'review',
    issues: [],
    evidence: [{ url, sourceType: 'html', note: 'Public product page extracted from legacy HTML.' }],
  };
};

const parseMedia = (url, html, productEntityKey) => {
  const images = getImageUrls(html);
  return images.map((imageUrl) => ({
    sourcePageKey: getSourcePageKey('product', url),
    entityKey: null,
    legacyUrl: canonicalUrl(imageUrl),
    normalizedUrl: canonicalUrl(imageUrl),
    filename: (() => {
      try {
        const parsed = new URL(imageUrl);
        return path.basename(parsed.pathname) || null;
      } catch {
        return null;
      }
    })(),
    mimeType: null,
    width: null,
    height: null,
    alt: { uk: null, ru: null },
    linkedProductEntityKeys: productEntityKey ? [productEntityKey] : [],
    linkedCategoryEntityKeys: [],
    availability: 'available',
    duplicateOf: null,
    status: 'review',
    issues: [],
    evidence: [{ url: canonicalUrl(imageUrl), sourceType: 'html', note: 'Image URL extracted from legacy product HTML.' }],
  }));
};

const matchesRobotsDisallow = (url, rule) => {
  if (!rule || rule === ' ') return false;
  const cleaned = rule.trim();
  if (!cleaned || cleaned === '/') return true;

  const normalized = cleaned.replace(/\*/g, '.*').replace(/\$$/, '');
  const pathName = new URL(url).pathname;
  const regexSource = `^${normalized}$`;

  try {
    const regex = new RegExp(regexSource, 'i');
    return regex.test(pathName);
  } catch {
    return false;
  }
};

const checkRobotsAccess = (robotsText, urls) => {
  if (!robotsText) return;
  const disallows = robotsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^Disallow:/i.test(line))
    .map((line) => line.replace(/^Disallow:\s*/i, ''));

  for (const url of urls) {
    const match = disallows.some((rule) => matchesRobotsDisallow(url, rule));
    if (match) {
      throw new Error(`Robots rules disallow extraction for: ${url}`);
    }
  }
};

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const robots = await fetch('https://lutsk.babyservice.ua/robots.txt', { headers: HEADERS }).then((res) => res.text()).catch(() => '');
  checkRobotsAccess(robots, ALLOWED_URLS);

  const pageData = {};
  for (const url of ALLOWED_URLS) {
    const html = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) }).then((res) => res.text());
    pageData[url] = html;
  }

  const categoryRecords = [];
  const productRecords = [];
  const mediaRecords = [];

  for (const url of ALLOWED_URLS) {
    const html = pageData[url];
    const normalized = new URL(url);
    const isCategory = normalized.pathname.endsWith('.html') && !normalized.pathname.includes('/avtokrisla/');
    const isProduct = normalized.pathname.includes('/avtokrisla/') && normalized.pathname.endsWith('.html');

    if (isCategory) {
      const category = parseCategoryPage(url, html);
      categoryRecords.push(category);
      continue;
    }

    if (isProduct) {
      const product = parseProductPage(url, html);
      productRecords.push(product);

      const productMedia = parseMedia(url, html, product.entityKey);
      for (const mediaItem of productMedia) {
        mediaRecords.push(mediaItem);
      }
    }
  }

  const manifest = {
    manifestVersion: '0.1.0-dry-run',
    generatedAt: new Date().toISOString(),
    source: {
      kind: 'public-legacy-site',
      rootUrl: 'https://lutsk.babyservice.ua/',
      notes: [
        'Control sample only: category and product URLs from the public legacy site.',
        'No MongoDB connection, importer or content write operations were executed.',
      ],
    },
    categories: categoryRecords,
    products: productRecords,
    media: mediaRecords,
    pages: [],
  };
  const validation = validateManifest(manifest);
  for (const result of validation.migrationReadiness.records) {
    const record = manifest[result.collection]?.[result.index];
    if (!record) continue;
    record.status = result.status;
    record.issues = result.issues;
  }
  manifest.validation = validation;

  await fs.writeFile(path.join(OUTPUT_DIR, 'candidate-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(path.join(OUTPUT_DIR, 'validation-report.json'), JSON.stringify(manifest.validation, null, 2), 'utf8');

  console.log(JSON.stringify({
    categories: categoryRecords.length,
    products: productRecords.length,
    media: mediaRecords.length,
    validation: manifest.validation.summary,
  }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
