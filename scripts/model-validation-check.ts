import mongoose from 'mongoose';

import Category from '../src/models/Category';
import Product from '../src/models/Product';
import Page from '../src/models/Page';
import Article from '../src/models/Article';
import News from '../src/models/News';
import Review from '../src/models/Review';
import Media from '../src/models/Media';
import SiteSettings from '../src/models/SiteSettings';
import User from '../src/models/User';

const importedModels = [Category, Product, Page, Article, News, Review, Media, SiteSettings, User];
const expectedModelNames = ['Category', 'Product', 'Page', 'Article', 'News', 'Review', 'Media', 'SiteSettings', 'User'];

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const getSlugValidationPath = (error: mongoose.Error.ValidationError | undefined) => {
  if (!error || !error.errors) return null;

  const paths = Object.keys(error.errors).filter((key) => key === 'slug' || key.startsWith('slug.'));
  return paths[0] ?? null;
};

const makeSlug = (uk?: string, ru?: string) => ({
  ...(uk !== undefined ? { uk } : {}),
  ...(ru !== undefined ? { ru } : {}),
});

const validSlugCaseSet = {
  category: [
    new Category({ name: { uk: 'Категорія' }, slug: makeSlug('kategoria'), status: 'published' }),
    new Category({ name: { uk: 'Категорія', ru: 'Категория' }, slug: makeSlug('kategoria', 'kategoria-ru'), status: 'published' }),
  ],
  product: [
    new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, slug: makeSlug('product'), pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }),
    new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар', ru: 'Товар' }, slug: makeSlug('product', 'product-ru'), pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }),
  ],
  page: [new Page({ pageType: 'about', title: { uk: 'Про нас' }, slug: makeSlug('about'), status: 'published' })],
  article: [new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), status: 'published' })],
  news: [new News({ title: { uk: 'Новина' }, slug: makeSlug('news'), status: 'published' })],
};

const invalidSlugCaseSet = {
  category: [
    { label: 'only ru', document: new Category({ name: { uk: 'Категорія' }, slug: makeSlug(undefined, 'kategoria-ru'), status: 'published' }) },
    { label: 'empty object', document: new Category({ name: { uk: 'Категорія' }, slug: {}, status: 'published' }) },
    { label: 'empty uk', document: new Category({ name: { uk: 'Категорія' }, slug: makeSlug(''), status: 'published' }) },
    { label: 'whitespace uk', document: new Category({ name: { uk: 'Категорія' }, slug: makeSlug('   '), status: 'published' }) },
    { label: 'missing slug', document: new Category({ name: { uk: 'Категорія' }, status: 'published' }) },
  ],
  product: [
    { label: 'only ru', document: new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, slug: makeSlug(undefined, 'product-ru'), pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }) },
    { label: 'empty object', document: new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, slug: {}, pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }) },
    { label: 'empty uk', document: new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, slug: makeSlug(''), pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }) },
    { label: 'whitespace uk', document: new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, slug: makeSlug('   '), pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }) },
    { label: 'missing slug', document: new Product({ category: new mongoose.Types.ObjectId(), name: { uk: 'Товар' }, pricing: { currency: 'UAH', rentalRates: [] }, status: 'published' }) },
  ],
  page: [
    { label: 'only ru', document: new Page({ pageType: 'about', title: { uk: 'Про нас' }, slug: makeSlug(undefined, 'about-ru'), status: 'published' }) },
    { label: 'empty object', document: new Page({ pageType: 'about', title: { uk: 'Про нас' }, slug: {}, status: 'published' }) },
    { label: 'empty uk', document: new Page({ pageType: 'about', title: { uk: 'Про нас' }, slug: makeSlug(''), status: 'published' }) },
    { label: 'whitespace uk', document: new Page({ pageType: 'about', title: { uk: 'Про нас' }, slug: makeSlug('   '), status: 'published' }) },
    { label: 'missing slug', document: new Page({ pageType: 'about', title: { uk: 'Про нас' }, status: 'published' }) },
  ],
  article: [
    { label: 'only ru', document: new Article({ title: { uk: 'Стаття' }, slug: makeSlug(undefined, 'article-ru'), status: 'published' }) },
    { label: 'empty object', document: new Article({ title: { uk: 'Стаття' }, slug: {}, status: 'published' }) },
    { label: 'empty uk', document: new Article({ title: { uk: 'Стаття' }, slug: makeSlug(''), status: 'published' }) },
    { label: 'whitespace uk', document: new Article({ title: { uk: 'Стаття' }, slug: makeSlug('   '), status: 'published' }) },
    { label: 'missing slug', document: new Article({ title: { uk: 'Стаття' }, status: 'published' }) },
  ],
  news: [
    { label: 'only ru', document: new News({ title: { uk: 'Новина' }, slug: makeSlug(undefined, 'news-ru'), status: 'published' }) },
    { label: 'empty object', document: new News({ title: { uk: 'Новина' }, slug: {}, status: 'published' }) },
    { label: 'empty uk', document: new News({ title: { uk: 'Новина' }, slug: makeSlug(''), status: 'published' }) },
    { label: 'whitespace uk', document: new News({ title: { uk: 'Новина' }, slug: makeSlug('   '), status: 'published' }) },
    { label: 'missing slug', document: new News({ title: { uk: 'Новина' }, status: 'published' }) },
  ],
};

const checkSlugRules = () => {
  const modelNames = ['Category', 'Product', 'Page', 'Article', 'News'] as const;
  let successCount = 0;
  let failureCount = 0;

  for (const modelName of modelNames) {
    const modelKey = modelName.toLowerCase();
    const validCases = validSlugCaseSet[modelKey as keyof typeof validSlugCaseSet];
    const invalidCases = invalidSlugCaseSet[modelKey as keyof typeof invalidSlugCaseSet];

    for (const validCase of validCases) {
      const error = validCase.validateSync();
      if (error) {
        failureCount += 1;
        console.error(`${modelName} valid case failed: ${error.message}`);
      } else {
        successCount += 1;
      }
    }

    for (const invalidCase of invalidCases) {
      const error = invalidCase.document.validateSync();
      if (!error) {
        failureCount += 1;
        console.error(`${modelName} invalid case '${invalidCase.label}' unexpectedly passed validation`);
        continue;
      }

      const slugErrorPath = getSlugValidationPath(error);
      if (!slugErrorPath) {
        failureCount += 1;
        console.error(`${modelName} invalid case '${invalidCase.label}' failed but the error was not on the slug field: ${error.message}`);
        continue;
      }

      successCount += 1;
    }
  }

  console.log(`Slug validation checks: ${successCount} successful, ${failureCount} failed`);
  assert(failureCount === 0, 'Slug validation checks failed');
};

const checkLocalizedTextRules = () => {
  let passCount = 0;

  const validOptionalMissingRu = new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), content: { uk: 'Зміст' }, status: 'published' });
  assert(!validOptionalMissingRu.validateSync(), 'Optional localized field without ru should remain valid');
  passCount += 1;

  const emptyStringInvalid = new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), content: { uk: '', ru: 'текст' }, status: 'published' });
  assert(Boolean(emptyStringInvalid.validateSync()), 'Empty localized text should fail validation');
  passCount += 1;

  const whitespaceInvalid = new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), content: { uk: '   ', ru: 'текст' }, status: 'published' });
  assert(Boolean(whitespaceInvalid.validateSync()), 'Whitespace-only localized text should fail validation');
  passCount += 1;

  const nullOptionalAllowed = new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), content: null as any, status: 'published' });
  assert(!nullOptionalAllowed.validateSync(), 'Optional localized field with null should be valid');
  passCount += 1;

  const undefinedOptionalAllowed = new Article({ title: { uk: 'Стаття' }, slug: makeSlug('article'), content: undefined, status: 'published' });
  assert(!undefinedOptionalAllowed.validateSync(), 'Optional localized field with undefined should be valid');
  passCount += 1;

  console.log(`Localized text validation checks passed (${passCount} checks)`);
};

const checkModelRegistration = () => {
  const names = importedModels.map((model) => model.modelName);
  const missing = expectedModelNames.filter((name) => !names.includes(name));
  assert(missing.length === 0, `Missing compiled models: ${missing.join(', ')}`);

  const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
  assert(duplicates.length === 0, `Duplicate model registration detected: ${duplicates.join(', ')}`);

  const reloaded = [
    require.resolve('../src/models/Category'),
    require.resolve('../src/models/Product'),
    require.resolve('../src/models/Page'),
    require.resolve('../src/models/Article'),
    require.resolve('../src/models/News'),
    require.resolve('../src/models/Review'),
    require.resolve('../src/models/Media'),
    require.resolve('../src/models/SiteSettings'),
    require.resolve('../src/models/User'),
  ];

  for (const modulePath of reloaded) {
    delete require.cache[modulePath];
    require(modulePath);
  }

  const reloadedNames = mongoose.modelNames();
  const remainingMissing = expectedModelNames.filter((name) => !reloadedNames.includes(name));
  assert(remainingMissing.length === 0, `Models missing after reloading: ${remainingMissing.join(', ')}`);

  console.log('Model registration checks passed');
};

const inspectIndexes = () => {
  const indexTargets = {
    Category: Category.schema.indexes(),
    Product: Product.schema.indexes(),
    Page: Page.schema.indexes(),
    Article: Article.schema.indexes(),
    News: News.schema.indexes(),
    Review: Review.schema.indexes(),
    Media: Media.schema.indexes(),
    SiteSettings: SiteSettings.schema.indexes(),
    User: User.schema.indexes(),
  };

  for (const [modelName, entries] of Object.entries(indexTargets)) {
    console.log(`\n${modelName} indexes:`);
    for (const [keys, options] of entries) {
      console.log({ keys, unique: Boolean(options.unique), sparse: Boolean(options.sparse), partialFilterExpression: options.partialFilterExpression ?? null });
    }
  }

  const siteSettingsIndex = SiteSettings.schema.indexes().find((entry) => {
    const [keys, options] = entry;
    return Object.keys((keys as Record<string, number>) ?? {}).some((key) => key === 'isActive') && Boolean(options.partialFilterExpression);
  });

  const slugIndexCount = ['Category', 'Product', 'Page', 'Article', 'News']
    .map((name) => indexTargets[name as keyof typeof indexTargets])
    .flat()
    .filter(([keys]) => {
      const keyMap = keys as Record<string, number>;
      return Object.keys(keyMap).some((key) => key.includes('.uk') || key.includes('.ru'));
    }).length;

  assert(slugIndexCount >= 10, 'Slug unique indexes not found');
  assert(Boolean(siteSettingsIndex), 'SiteSettings active-index restriction not found');
  console.log('\nIndex definition checks passed');
};

const inspectCollectionNames = () => {
  const legacyItemModel = mongoose.models.Item || mongoose.model('Item', new mongoose.Schema({ title: String }, { versionKey: false }));
  const legacyUserModel = mongoose.models.user || mongoose.model('user', new mongoose.Schema({ email: String }, { versionKey: false }));
  const legacyArticleModel = mongoose.models.article || mongoose.model('article', new mongoose.Schema({ title: String }, { versionKey: false }));

  const mapping = [
    { model: 'Category', collection: Category.collection.name },
    { model: 'Product', collection: Product.collection.name },
    { model: 'Page', collection: Page.collection.name },
    { model: 'Article', collection: Article.collection.name },
    { model: 'News', collection: News.collection.name },
    { model: 'Review', collection: Review.collection.name },
    { model: 'Media', collection: Media.collection.name },
    { model: 'SiteSettings', collection: SiteSettings.collection.name },
    { model: 'User', collection: User.collection.name },
    { model: 'legacy Item', collection: legacyItemModel.collection.name },
    { model: 'legacy user', collection: legacyUserModel.collection.name },
    { model: 'legacy article', collection: legacyArticleModel.collection.name },
  ];

  console.log('\nCollection name mapping:');
  console.table(mapping);

  const sharedCollections = Object.entries(
    mapping.reduce<Record<string, string[]>>((acc, entry) => {
      if (!acc[entry.collection]) {
        acc[entry.collection] = [];
      }
      acc[entry.collection].push(entry.model);
      return acc;
    }, {})
  )
    .filter(([, models]) => models.length > 1)
    .map(([collection, models]) => ({ collection, models: models.join(', ') }));

  if (sharedCollections.length === 0) {
    console.log('No shared collection names were detected between new and legacy models.');
  } else {
    console.table(sharedCollections);
  }
};

const main = () => {
  checkSlugRules();
  checkLocalizedTextRules();
  checkModelRegistration();
  inspectIndexes();
  inspectCollectionNames();
  console.log('\nAll isolated Mongoose checks passed without MongoDB connection');
};

main();
