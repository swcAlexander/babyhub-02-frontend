# CONTENT_MIGRATION_MANIFEST_DESIGN.md

## 1. Мета та обмеження

### Підтверджено
- У проекті є цільові доменні моделі: [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts), [src/models/Media.ts](../src/models/Media.ts), [src/models/common.ts](../src/models/common.ts).
- Публічний legacy сайт є єдиним доступним source of truth за умовами поточного етапу: [docs/PUBLIC_CONTENT_SOURCE_AUDIT.md](./PUBLIC_CONTENT_SOURCE_AUDIT.md).
- MongoDB не має бути використаний на цьому етапі; описаний формат є проміжним, read-only і dry-run-орієнтованим.

### Обмеження етапу
- Не змінювати код проєкту, моделі, сервіси, API, маршрути, `.env` або MongoDB.
- Не виконувати імпорт або seed.
- Не створювати робочий HTML-парсер чи імпортер.
- Лише створити документ опису manifest і dry-run архітектури.

### Запропоноване рішення
- Створити manifest, який є незалежним від MongoDB, містить оригінальні legacy URL, raw values і винагороджує результат валідації (`accept` / `review` / `reject`).
- Сформувати dry-run на основі цього manifest без будь-яких записів до MongoDB.

## 2. Перевірені контракти нових моделей

### 2.1. Category
Підтверджено в [src/models/Category.ts](../src/models/Category.ts):
- `name: LocalizedString`
- `slug: LocalizedString`
- `description?: LocalizedString`
- `seo?: SeoMetadata`
- `image?: ObjectId | null`
- `parentCategory?: ObjectId | null`
- `displayOrder: number`
- `status: 'draft' | 'published'`
- `importMeta?: ImportMeta`

Правила локалізації в [src/models/common.ts](../src/models/common.ts):
- `slug.uk` є обов'язковим
- `slug.ru` має бути порожнім лише якщо не задано
- локалізовані строки не можуть бути порожніми

### 2.2. Product
Підтверджено в [src/models/Product.ts](../src/models/Product.ts):
- `category: ObjectId`
- `name: LocalizedString`
- `slug: LocalizedString`
- `shortDescription?: LocalizedString`
- `description?: LocalizedString`
- `attributes?: Array<{ key: LocalizedString; value: LocalizedString }>`
- `images?: ObjectId[]`
- `pricing: { salePrice?: number | null; currency: string; rentalRates: IRentalRate[] }`
- `availability: 'in_stock' | 'on_order' | 'out_of_stock'`
- `seo?: SeoMetadata`
- `featured: boolean`
- `displayOrder: number`
- `status: 'draft' | 'published'`
- `legacyId?: string`
- `importMeta?: ImportMeta`

### 2.3. Media
Підтверджено в [src/models/Media.ts](../src/models/Media.ts):
- `filename`, `url`, `mimeType`, `sizeBytes`, `width`, `height`, `alt`, `storageType`, `importMeta`
- `url` є унікальним
- `filename` також унікальний

### 2.4. Service contract
Підтверджено в [src/services/product.service.ts](../src/services/product.service.ts):
- `getProductBySlug(categorySlug, productSlug, locale)` returns `ProductSummary | null`
- `locale` is strict; no fallback between locales
- products are only returned when `status === 'published'` and belong to a published category

## 3. Архітектура manifest

### 3.1. Принцип
Manifest повинен зберігати тільки те, що реально отримано з legacy HTML або з перевірених публічних сторінок. Всі поля, які не підтверджені, повинні залишатися `null`, `undefined` або `needs_review`.

### 3.2. Ключові структури

```ts
// Demonstration only. Not executable code.
type Locale = 'uk' | 'ru';
type ValidationStatus = 'accept' | 'review' | 'reject';
type LocaleMatchStatus = 'confirmed' | 'unconfirmed' | 'conflict' | 'duplicate';
type Confidence = 'confirmed' | 'partial' | 'unknown';

type SourcePageKey = string;
type EntityKey = string;

type LocalizedValue = {
  uk?: string | null;
  ru?: string | null;
};

type SourceEvidence = {
  url: string;
  sourceType: 'html' | 'meta' | 'form' | 'navigation' | 'sitemap' | 'unknown';
  capturedAt?: string;
  note?: string;
};

type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  status: ValidationStatus;
  message: string;
  evidence?: SourceEvidence[];
  field?: string;
};

type MigrationManifest = {
  manifestVersion: string;
  generatedAt: string;
  source: {
    kind: 'public-legacy-site';
    rootUrl: string;
    notes: string[];
  };
  categories: CategoryManifest[];
  products: ProductManifest[];
  media: MediaManifest[];
  pages: PageManifest[];
  articles?: ArticleManifest[];
  validation: ValidationReport;
};

type CategoryManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  localeMatch: LocaleMatchStatus;
  legacyUrl: string;
  normalizedUrl: string;
  locale: Locale;
  name: LocalizedValue;
  slug: LocalizedValue;
  description?: LocalizedValue;
  parentLegacyUrl?: string | null;
  imageLegacyUrl?: string | null;
  seo?: {
    title?: LocalizedValue;
    description?: LocalizedValue;
    keywords?: string[];
  };
  status: ValidationStatus;
  issues: ValidationIssue[];
  evidence: SourceEvidence[];
};

type ProductManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  localeMatch: LocaleMatchStatus;
  legacyUrl: string;
  normalizedUrl: string;
  categoryEntityKey?: EntityKey | null;
  name: LocalizedValue;
  slug: LocalizedValue;
  shortDescription?: LocalizedValue;
  description?: LocalizedValue;
  attributes?: Array<{ key: LocalizedValue; value: LocalizedValue }>;
  imageLegacyUrls: string[];
  pricingRaw?: {
    rawText?: string | null;
    currency?: string | null;
    type?: 'sale' | 'rental' | 'unknown';
    amount?: number | null;
    periodDays?: number | null;
    isConfirmed: boolean;
  };
  availabilityRaw?: {
    rawText?: string | null;
    normalized?: 'in_stock' | 'on_order' | 'out_of_stock' | null;
    confidence: 'confirmed' | 'partial' | 'unknown';
  };
  seo?: {
    title?: LocalizedValue;
    description?: LocalizedValue;
    keywords?: string[];
  };
  status: ValidationStatus;
  issues: ValidationIssue[];
  evidence: SourceEvidence[];
};

type MediaManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  legacyUrl: string;
  normalizedUrl: string;
  filename?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  alt?: LocalizedValue;
  linkedProductEntityKeys: EntityKey[];
  linkedCategoryEntityKeys: EntityKey[];
  availability: 'available' | 'missing' | 'unknown';
  duplicateOf?: string | null;
  status: ValidationStatus;
  issues: ValidationIssue[];
  evidence: SourceEvidence[];
};

type PageManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  legacyUrl: string;
  pageType: 'about' | 'contact' | 'terms' | 'partners' | 'reviews' | 'news-list' | 'article-list' | 'unknown';
  locale: Locale;
  title?: string | null;
  body?: string | null;
  status: ValidationStatus;
  issues: ValidationIssue[];
  evidence: SourceEvidence[];
};

type ArticleManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  legacyUrl: string;
  locale: Locale;
  title?: string | null;
  body?: string | null;
  linkToParent?: string | null;
  status: ValidationStatus;
  issues: ValidationIssue[];
  evidence: SourceEvidence[];
};

type ValidationReport = {
  totalRecords: number;
  accepted: number;
  reviewRequired: number;
  rejected: number;
  issuesByCode: Record<string, number>;
  blockers: string[];
};
```

### 3.3. Обов'язкові принципи
- `legacyUrl` зберігається унікально для кожного record.
- `sourcePageKey` — це стабільний ключ конкретної мовної сторінки; він не повинен збігатися з логічним ключем сутності.
- `entityKey` — це стабільний ключ логічної сутності, наприклад одного товару або категорії з двома мовними версіями.
- `entityKey` не формуються автоматично з URL або назви; його можна призначити лише після підтвердження відповідності між мовними сторінками.
- `null` позначає відсутність поля, а `review` — поле, яке присутнє, але потребує ручної перевірки.
- raw values зберігаються окремо від normalized fields.

## 4. Source keys та URL normalization

### 4.1. Правила normalization
Підтверджено, що нові моделі очікують normalized slug-значення у [src/models/common.ts](../src/models/common.ts):
- lowercased
- пробіли -> `-`
- кирилиця та інші символи видаляються / нормалізуються
- подвійні дефіси усуваються

Рекомендуємо для legacy manifest:
1. `legacyUrl` зберігати як оригінальний URL.
2. `normalizedUrl` — зберігати нормалізований URL без query/hash.
3. `sourcePageKey` сформувати як стабільний ключ на основі нормалізованого URL + мови + типу сторінки, наприклад:
   - `page:uk:category:avtokrisla`
   - `page:uk:product:avtokreslo-adbor-capri`
4. `entityKey` формувати лише після підтвердження відповідності мовних сторінок, наприклад:
   - `entity:category:avtokrisla`
   - `entity:product:avtokreslo-adbor-capri`

### 4.2. Важливий ризик
- Схожість назв не є достатнім доказом тотожності. Наприклад, два URL `/avtokrisla.html` і `/ru/avtokrisla.html` відносяться до різних мов, але вони не є автоматично одним і тим самим Product/Category записом.
- Той самий URL може бути повторно екстрагований; це не означає, що є нова логічна сутність.

### 4.3. Мовні пари
Формальне правило:
- `sourcePageKey` = normalized legacy URL + locale + entity type
- `entityKey` = логічний ключ сутності, який призначається лише після підтвердження відповідності
- `localeMatch` = `confirmed` | `unconfirmed` | `conflict` | `duplicate`

Приклад підтвердженої відповідності:
- `page:uk:product:avtokreslo-adbor-capri`
- `page:ru:product:avtokreslo-adbor-capri`
- спільний `entityKey`: `entity:product:avtokreslo-adbor-capri`

Якщо будь-яка зі сторінок має відмінні title/slug/price/URL і немає чіткого доказу відповідності, маніфест ставить `localeMatch: 'unconfirmed'` або `conflict`, але не об'єднує записи автоматично.

### 4.4. Запобігання дублям
- `sourcePageKey` має бути унікальним для кожної окремої мовної сторінки.
- повторна екстракція тієї самої сторінки має повертати той самий `sourcePageKey`.
- якщо той самий URL знову з'являється, поле `duplicateOf` або `mergeCandidate` зберігається в manifest, але без автоматичного злиття непідтверджених записів.

### 4.5. Конфлікти
- якщо один URL має дві неузгоджені версії title/slug/price — `review`
- якщо один productPage з'являється в обох мовах з однаковим `sourcePageKey` без підтвердженого словника — `reject` або `review`
- якщо два різні `sourcePageKey` претендують на один `entityKey` без підтвердження — `localeMatch: 'conflict'` і `entityKey` залишається `null` або змінюється лише після ручної перевірки

## 5. Локалізація

### 5.1. Остаточні правила локалізації
Підтверджено в [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md), [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) і [src/models/common.ts](../src/models/common.ts):
- українська — корінь, без `/uk`
- російська — `/ru`
- локалізовані поля `{ uk, ru }`
- `slug.uk` обов'язковий
- `slug.ru` необов'язковий
- strict slug lookup
- автоматичний fallback між мовами заборонений

### 5.2. Обробка типів записів

#### A. Запис з обома мовами
- `name.uk` + `name.ru` зберігаються як `LocalizedValue`
- `slug.uk` і `slug.ru` зберігаються окремо
- якщо `slug.uk` або `slug.ru` порожні -> `review`
- якщо сторінки мають підтверджену відповідність, вони отримують один і той самий `entityKey`

#### B. Запис лише українською
- `name.uk` заповнений; `name.ru` = null
- `slug.uk` обов'язковий
- `slug.ru` = null
- статус = `review` для перевірки, чи не потребує запис ручного російського variant
- `entityKey` може залишатися `null`, якщо немає підтвердженої російської відповіді

#### C. Запис лише російською
- `name.ru` заповнений; `name.uk` = null
- `slug.ru` може бути валідний, але `slug.uk` відсутній
- такий запис не отримує автоматичного українського fallback
- статус = `review` або `reject` залежно від того, чи заповнені інші обов'язкові вимоги моделі

#### D. Порожні локалізовані поля
- `LocalizedValue` може мати `''` / whitespace
- у manifest це має бути нормалізовано до `null`, а не до порожнього рядка

#### E. Конфліктні slug
- якщо `slug.uk` і `slug.ru` дублюють один і той самий значення і це не підтверджено як одна логічна сутність, запис вважається `review`

#### F. Непідтверджена мовна відповідність
- якщо URL або title схожі, але немає підтвердження через `lang`, реальний HTML або інше достовірне джерело, тоді `review`
- автоматичне злиття таких записів заборонено

### 5.3. Заборона fallback
- manifest не повинен автозаповнювати `uk` з `ru` або навпаки
- якщо один із локалізованих полів відсутній, то на етапі dry-run він залишається `null` і проходить перевірку лише як `review`, а не `accept`

## 6. Ціни й оренда

### 6.1. Джерело фактичних даних
Підтверджено на сторінці товару [https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html](https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html):
- авансовий платіж: `600.00 грн` / `500.00 грн`
- за добу: `100 грн`
- за тиждень: `200 грн`
- за 2 тижні: `300 грн`
- за місяць: `450 грн`
- більше місяця: `15 грн/добу`

Це не є одним `salePrice`; це типово орендні тарифи.

### 6.2. Рекомендований manifest для цін

```json
{
  "pricingRaw": {
    "rawText": "авансовий платіж 600.00 грн; 100 грн/доба; 200 грн/тиждень; 450 грн/місяць",
    "currency": "UAH",
    "type": "rental",
    "amount": null,
    "periodDays": null,
    "isConfirmed": false
  }
}
```

### 6.3. Правила
- raw текст зберігається обов'язково
- `currency` зберігається лише якщо підтверджена або очевидна з тексту
- `salePrice` не заповнювати автоматично з `rental` даних
- `rentalRates` в Mongoose model [src/models/Product.ts](../src/models/Product.ts) приймають структуру `{ periodDays, price, unit, currency, deposit, isActive }`
- якщо legacy HTML містить тільки рентальні умови і не містить `salePrice`, then `salePrice` must remain `null` in manifest and `review`

### 6.4. Архітектурний конфлікт
- Legacy data may mix rent, deposit, amount and conditions in one block.
- This is not equivalent to a simple `price` field in the old model [src/app/api/models/item.ts](../src/app/api/models/item.ts).
- The manifest should preserve the ambiguity and not normalize it into a guessed product price.

## 7. Media mapping

### 7.1. Факти
Підтверджено на товарній сторінці: `img src="/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg"`.
Модель `Media` потребує: [src/models/Media.ts](../src/models/Media.ts)
- `filename`
- `url`
- `mimeType`
- `width`
- `height`
- `alt`
- `storageType`
- `importMeta`

### 7.2. MediaManifest structure

```ts
type MediaManifest = {
  sourceKey: string;
  legacyUrl: string;
  normalizedUrl: string;
  filename?: string | null;
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | null;
  width?: number | null;
  height?: number | null;
  alt?: LocalizedValue;
  linkedProductSourceKeys: string[];
  linkedCategorySourceKeys: string[];
  availability: 'available' | 'missing' | 'unknown';
  duplicateOf?: string | null;
  status: ValidationStatus;
  evidence: SourceEvidence[];
};
```

### 7.3. Правила
- `sourceUrl` — absolute legacy URL or relative path normalized to absolute canonical form
- `filename` — збереження тільки якщо можна достовірно витягнути із URL
- `alt` — зберігати тільки якщо підтверджено в HTML attribute
- `storageType` — не заповнювати автоматично, якщо не підтверджено; прив'язка до `local`/`cloudinary`/`s3` лише після доступу до реального media storage
- `duplicateOf` — заповнювати при знаходженні дублікатів по URL / hash candidate
- `availability` ставиться тільки після перевірки, а не на основі припущення

### 7.4. Порядок створення
1. Спочатку зібрати media URLs
2. Потім сформувати MediaManifest
3. Потім пов'язати Product → Media через `linkedProductSourceKeys`
4. Після цього перевірити галерею order і дублікати

## 8. Валідація

### 8.1. Структура ValidationIssue

```ts
type ValidationIssue = {
  code: 'MISSING_REQUIRED_FIELD' | 'INVALID_SLUG' | 'UNMATCHED_LOCALE' | 'AMBIGUOUS_PRICE' | 'MISSING_MEDIA' | 'DUPLICATE_RECORD' | 'UNRESOLVED_RELATION' | 'INVALID_URL';
  severity: 'error' | 'warning' | 'info';
  status: 'accept' | 'review' | 'reject';
  message: string;
  field?: string;
  evidence?: SourceEvidence[];
};
```

### 8.2. Правила статусів

#### Accept
- URL доступний і відомо, що це category/product/page
- required fields підтверджені
- локалізований контент зберігся в відповідному `LocalizedValue`
- посилання на media/relations відомі й є логічно валідними
- ціни і availability не є амбівалентними або надають явну інформацію без припущень
- для записів з двома мовами підтверджено, що вони належать до одного `entityKey`

#### Review
- значення присутні, але є неоднозначність або неповнота
- `slug.uk` є, але `slug.ru` відсутній або не підтверджений
- `localeMatch` = `unconfirmed` або `conflict`
- `priceRaw` є, але не можна з упевненістю визначити `salePrice` або `rentalRate`
- media URL доступний, але `mimeType` / alt / width/height не підтверджені
- запис не є безповоротно непридатним, але потребує ручної перевірки

#### Reject
- відсутній кореневий source або `sourcePageKey`
- URL не може бути пов'язаний жодним чином зі схемою даних
- required fields відсутні в усіх мовах
- product не має хоча б одного валідного candidate category link
- `slug.uk` відсутній у записі, що має бути українськими за правилами моделі
- `entityKey` конфліктує між різними записами без підтвердження
- record contradicts required schema

Примітка: відсутнє необов'язкове поле не блокує запис; відсутнє обов'язкове поле вимагає `review`, а відсутність критичних required-полів або конфліктних ключів може перейти в `reject`.

### 8.3. Типи перевірок
- required поля
- типи даних
- локалізація
- slug validation
- duplicates
- media presence
- URL validity
- category/product linkage
- pricing validity
- status conflicts

### 8.4. Зіставлення з Mongoose-моделями
Підтверджено в [src/models/common.ts](../src/models/common.ts), [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts) і [src/models/Media.ts](../src/models/Media.ts):

- `Category`: required `name`, `slug`, `status`; `slug.uk` обов'язковий; `slug.ru` допустимо пропускати, але не як порожній рядок; `image`, `parentCategory`, `description` є необов'язковими.
- `Product`: required `category`, `name`, `slug`, `pricing`, `status`; `pricing.currency` і `rentalRates` мають бути присутніми в схемі, хоча `salePrice` є необов'язковим. `availability` обмежений enum: `in_stock | on_order | out_of_stock`.
- `Media`: required `filename`, `url`, `storageType`; `alt`, `mimeType`, `width`, `height` є необов'язковими, але якщо вони відсутні, запис не переходить автоматично в `reject`.
- `common`: `LocalizedString` підтримує лише `uk` і `ru`; порожні значення заборонені; автоматичний fallback між мовами заборонений.

Поточна несумісність між legacy source і target schema залишається в pricing:
- legacy HTML часто містить орендні ціни/депозит/період, а `Product.pricing` в моделі передбачає структурований `salePrice` + `rentalRates`.
- це є архітектурним конфліктом, який маніфест має фіксувати як `review`, а не перекладати в догадку про ціну продажу.

## 9. Dry-run architecture

### 9.1. Ціль
Dry-run має:
1. читати manifest;
2. перевіряти структуру;
3. збирати `accept` / `review` / `reject`;
4. формувати ValidationReport;
5. не писати в MongoDB;
6. не створювати нові документи;
7. бути ідемпотентним на повторних прогонках.

### 9.2. Потік dry-run
```text
legacy HTML source
  -> extract candidate records
  -> normalize URLs + locale
  -> assemble CategoryManifest / ProductManifest / MediaManifest
  -> validate required fields + schema rules
  -> detect duplicates + conflicts
  -> generate ValidationReport
  -> export report (CSV/JSON/Markdown) only
```

### 9.3. Формат звіту

```json
{
  "totalRecords": 154,
  "accepted": 78,
  "reviewRequired": 49,
  "rejected": 27,
  "issuesByCode": {
    "MISSING_REQUIRED_FIELD": 14,
    "INVALID_SLUG": 6,
    "AMBIGUOUS_PRICE": 18,
    "MISSING_MEDIA": 9,
    "DUPLICATE_RECORD": 4
  },
  "blockers": [
    "No verified legacy DB export",
    "No confirmed ru/uk pairing for all products",
    "Some category-to-product links are only inferred from URL navigation"
  ]
}
```

## 10. Ідемпотентність

### 10.1. Мета
Повторний dry-run не повинен створювати нові записи або змінювати фактичний стан даних.

### 10.2. Правила
- `sourcePageKey` є стабільним для одного URL + типу сутності + мови
- `entityKey` є стабільним для логічної сутності і не змінюється лише через зміну URL або slug
- `legacyUrl` вважається source of truth для ідентичності сторінки
- `normalizedUrl` і `groupKey` відновлюються deterministically
- `duplicateOf` або `mergeCandidate` зберігається для повторних входжень
- якщо продукт з'являється в new extract як новий, але його `sourcePageKey` уже існує, dry-run має лише оновити report, а не створити новий запис

### 10.3. Ризик без ідемпотентності
- дублікати в category/product manifests
- перевищення кількості products при repeated extraction
- змішання `ru` і `uk` variant в одному `ProductManifest`
- автоматичне злиття `entityKey` без підтвердженої відповідності

## 11. URL redirect mapping

### 11.1. Принцип
Manifest повинен зберігати legacy mappings окремо від runtime `redirect` logic, без їх створення у цьому етапі.

### 11.2. Приклад структури

```json
{
  "legacyUrl": "/avtokrisla.html",
  "normalizedUrl": "avtokrisla",
  "locale": "uk",
  "entityType": "category",
  "candidateRoute": "/catalog/avtokrisla",
  "status": "review",
  "evidence": [
    {
      "url": "https://lutsk.babyservice.ua/avtokrisla.html",
      "sourceType": "html",
      "note": "Category page is visible in legacy site navigation"
    }
  ]
}
```

### 11.3. Обмеження
- нова route map [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md) є планом, а не готовою продукційною логікою
- legacy URL не можна автоматично прийняти як final route без перевірки business rules

## 12. Демонстраційні приклади manifest

### 12.1. Товар із двома підтвердженими мовними сторінками

```json
{
  "sourcePageKey": "page:uk:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "localeMatch": "confirmed",
  "legacyUrl": "/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "uk",
  "name": { "uk": "Автокрісло Adbor Capri (0-10кг)", "ru": null },
  "slug": { "uk": "avtokreslo-adbor-capri", "ru": null },
  "status": "accept"
}
```

```json
{
  "sourcePageKey": "page:ru:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "localeMatch": "confirmed",
  "legacyUrl": "/ru/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "ru",
  "name": { "uk": null, "ru": "Автокресло Adbor Capri (0-10кг)" },
  "slug": { "uk": null, "ru": "avtokreslo-adbor-capri" },
  "status": "accept"
}
```

### 12.2. Дві мовні сторінки з непідтвердженою відповідністю

```json
{
  "sourcePageKey": "page:uk:product:noviy-tovar",
  "entityKey": null,
  "localeMatch": "unconfirmed",
  "legacyUrl": "/noviy-tovar.html",
  "locale": "uk",
  "name": { "uk": "Новий товар", "ru": null },
  "slug": { "uk": "noviy-tovar", "ru": null },
  "status": "review"
}
```

```json
{
  "sourcePageKey": "page:ru:product:noviy-tovar",
  "entityKey": null,
  "localeMatch": "unconfirmed",
  "legacyUrl": "/ru/noviy-tovar.html",
  "locale": "ru",
  "name": { "uk": null, "ru": "Новый товар" },
  "slug": { "uk": null, "ru": "noviy-tovar" },
  "status": "review"
}
```

### 12.3. Повторна екстракція тієї самої сторінки

```json
{
  "sourcePageKey": "page:uk:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "legacyUrl": "/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "uk",
  "duplicateOf": "page:uk:product:avtokreslo-adbor-capri",
  "status": "review"
}
```

Принцип: повторна екстракція має повертати той самий `sourcePageKey`, а не створювати новий запис на основі того самого URL.

### 12.4. Зміна URL існуючого товару

```json
{
  "sourcePageKey": "page:uk:product:avtokreslo-adbor-capri-v2",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "localeMatch": "confirmed",
  "legacyUrl": "/avtokrisla/avtokreslo_adbor_capri_2024.html",
  "normalizedUrl": "avtokrisla/avtokreslo-adbor-capri-2024",
  "previousLegacyUrls": ["/avtokrisla/avtokreslo_adbor_capri.html"],
  "status": "review"
}
```

Правило: зміна URL не створює новий `entityKey`; до підтвердження вона залишається прив'язаною до попередньої логічної сутності.

### 12.5. Конфлікт entityKey

```json
{
  "sourcePageKey": "page:uk:product:konflikt-1",
  "entityKey": "entity:product:common-name",
  "localeMatch": "conflict",
  "legacyUrl": "/product-1.html",
  "status": "review"
}
```

```json
{
  "sourcePageKey": "page:uk:product:konflikt-2",
  "entityKey": "entity:product:common-name",
  "localeMatch": "conflict",
  "legacyUrl": "/product-2.html",
  "status": "review"
}
```

У цьому випадку різні `sourcePageKey` претендують на один і той самий `entityKey`, але відповідність не підтверджена; відбувається ручна перевірка, а не автоматичне об'єднання.

## 13. Архітектурні конфлікти

### Підтверджено
- Legacy HTML not tied to real DB; some data can be inferred but not guaranteed.
- Product schema expects structured `pricing` with `salePrice` + `rentalRates`, while old pages may provide only a rent block and deposit info. This is a structural mismatch, not a model bug. Verified in [src/models/Product.ts](../src/models/Product.ts) and [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).
- `slug` validation requires `slug.uk` mandatory and Russian optional. Verified in [src/models/common.ts](../src/models/common.ts).
- `category` and `product` are separate real entities in new architecture, but legacy site stores them as HTML pages, not as structured records. Verified in [docs/CONTENT_MODEL_MAPPING.md](./CONTENT_MODEL_MAPPING.md).

### Гіпотеза
- Without legacy DB export, some fields cannot be recovered with a safe automatic rule.

### Рішення потрібне
- Business approval on whether `review` records can be kept as incomplete and repaired later, or whether they must be excluded from the import manifest.

## 14. Відкриті питання

1. Чи допустимо приймати `review`-записи для публічних HTML-даних і переносити їх до dry-run без наповнення в MongoDB?
2. Чи потрібен окремий `manual review` pool для `pricing`, `slug`, `media` і `locale` mismatches?
3. Чи всі legacy product pages повинні отримати окремі `ru`/`uk` records, або допускається частковий список?
4. Чи є доступною старша копія або новий export у майбутньому?
5. Чи потрібно зберігати legacy raw values окремо від normalized values у разі форматів, яких новий сайт не очікує?

## 15. Критерії готовності до реалізації

### Готово
- Є доступний public source (
  [https://lutsk.babyservice.ua/](https://lutsk.babyservice.ua/)
  ), і він дає базову структуру контенту.
- Є цільова Mongoose contract для Category, Product, Media.
- Є чітка стратегія `accept` / `review` / `reject`.

### Не готово
- Немає реального legacy DB/export, а отже немає гарантій повного `Product`/`Category`/`Media` dataset.
- Немає confirmed `uk/ru` mappings for all products.
- Немає confirmed data source for `legacyId`, `displayOrder`, media original assets, canonical URLs and thorough SEO metadata.

## 16. Рекомендація для етапу 3.8.4

### Мінімальний наступний крок
- Побудувати dry-run manifest, який збирає:
  - CategoryManifest
  - ProductManifest
  - MediaManifest
  - PageManifest
  - ValidationIssue
  - ValidationReport
- Не виконувати запис до MongoDB.
- Не запускати HTML-парсер як продакшн-імпортер; лише валідатор для candidate dataset.

### Рекомендуемый output 3.8.4
- Manifest JSON/CSV з кандидатами
- перший ValidationReport
- список записів `review`
- список `reject` на підставі відсутніх required полів

## 17. Підтвердження джерел

- Legacy public site: [https://lutsk.babyservice.ua/](https://lutsk.babyservice.ua/)
- Content audit: [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md)
- Public source audit: [docs/PUBLIC_CONTENT_SOURCE_AUDIT.md](./PUBLIC_CONTENT_SOURCE_AUDIT.md)
- Mongoose model: [src/models/Product.ts](../src/models/Product.ts)
- Category model: [src/models/Category.ts](../src/models/Category.ts)
- Media model: [src/models/Media.ts](../src/models/Media.ts)
- Common locale schema: [src/models/common.ts](../src/models/common.ts)
- Service contract: [src/services/product.service.ts](../src/services/product.service.ts)
- Redirect strategy: [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md)

## 18. Підсумок

### Перевірений факт
- Публічний legacy сайт містить достатньо структури для формування стартового manifest.
- Цільова модель даних вже описана, і вона чітко визначає required поля, locale rules, media mapping і pricing contract.

### Запропоноване рішення
- Не імпортувати в MongoDB, а спочатку створити read-only manifest + validation pipeline.
- Зберігати raw legacy values і результати валідації окремо.
- Класифікувати записи як `accept`, `review`, `reject` без автоматичного запису в базу.

### Непідтверджене припущення
- Якщо доступ до legacy DB / export не з'явиться, повна автоматична міграція не є безпечною і потребуватиме значної ручної верифікації.

### Питання для погодження
- Чи дозволяється приймати `review` записи в manifest для публічної міграції?
- Чи є допустимим підхід “manifest + review queue” без legacy DB export?
- Чи потрібен окремий owner-approval для `pricing`/`media`/`locale` conflicts?
