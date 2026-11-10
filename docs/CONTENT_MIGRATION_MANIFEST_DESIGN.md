# CONTENT_MIGRATION_MANIFEST_DESIGN.md

## 1. Мета та обмеження

### Підтверджено
- У проекті є цільові доменні моделі: [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts), [src/models/Media.ts](../src/models/Media.ts), [src/models/common.ts](../src/models/common.ts).
- Публічний legacy сайт є єдиним доступним source of truth за умовами поточного етапу: [docs/PUBLIC_CONTENT_SOURCE_AUDIT.md](./PUBLIC_CONTENT_SOURCE_AUDIT.md).
- MongoDB не має бути використаний на цьому етапі; описаний формат є проміжним, read-only і dry-run-орієнтованим.

### Обмеження етапу 3.8.4 (історична межа первинного проєктування)
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
- `slug.uk` є обов'язковим для `Category` і `Product`
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
  id?: string;
  url: string;
  sourceType: 'html' | 'meta' | 'form' | 'navigation' | 'sitemap' | 'unknown' | 'manual';
  capturedAt?: string;
  note?: string;
};

type LocaleMatchEvidence = {
  verified: true;
  method: 'explicit' | 'manual';
  reference: string;
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
  localeMatchEvidence?: LocaleMatchEvidence | null;
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
  localeMatchEvidence?: LocaleMatchEvidence | null;
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
    unit?: string | null;
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
  storageType?: 'local' | 'cloudinary' | 's3' | null;
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
  validatorVersion: string;
  sourceManifest: string;
  structuralValidation: {
    status: 'valid' | 'invalid';
    recordsChecked: number;
    errors: Array<{ code: string; message: string; collection?: string; index?: number; field?: string }>;
  };
  migrationReadiness: {
    status: 'ready' | 'review';
    totalRecords: number;
    accepted: number;
    reviewRequired: number;
    issuesByCode: Record<string, number>;
    records: Array<{
      collection: string;
      index: number;
      sourcePageKey: string | null;
      status: ValidationStatus;
      structuralStatus: 'valid' | 'invalid';
      readinessStatus: 'accept' | 'review';
      identity: { effectiveEntityKey: string | null; localeMatch: LocaleMatchStatus | null };
      issues: ValidationIssue[];
    }>;
  };
  summary: {
    totalRecords: number;
    accepted: number;
    reviewRequired: number;
    rejected: number;
  };
};
```

### 3.3. Обов'язкові принципи
- `legacyUrl` зберігається унікально для кожного record.
- `sourcePageKey` — це стабільний ключ конкретної мовної сторінки; він не повинен збігатися з логічним ключем сутності.
- `entityKey` — це стабільний ключ логічної сутності, наприклад одного товару або категорії з двома мовними версіями.
- `entityKey` не генерується автоматично з URL або назви. Для окремої сторінки він може бути її підтвердженою логічною ідентичністю; спільний `entityKey` для різних мов дозволений лише після підтвердження відповідності між сторінками.
- Кожен source-запис `Category` або `Product` має містити непорожній `slug` своєї мови (`slug.uk` чи `slug.ru`); це structural validation окремої сторінки. Готова сутність MongoDB окремо потребує непорожній `slug.uk` на рівні migration readiness. Для `Media` поле `slug` моделлю не передбачене.
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
4. `entityKey` не виводити зі slug чи назви; окрему ідентичність призначати лише після перевірки, а спільний ключ для мовних сторінок — лише після підтвердження їх відповідності, наприклад:
   - `entity:category:avtokrisla`
   - `entity:product:avtokreslo-adbor-capri`

### 4.2. Важливий ризик
- Схожість назв не є достатнім доказом тотожності. Наприклад, два URL `/avtokrisla.html` і `/ru/avtokrisla.html` відносяться до різних мов, але вони не є автоматично одним і тим самим Product/Category записом.
- Той самий URL може бути повторно екстрагований; це не означає, що є нова логічна сутність.

### 4.3. Мовні пари
Формальне правило:
- `sourcePageKey` = normalized legacy URL + locale + entity type
- `entityKey` = ключ підтвердженої логічної сутності; спільний між локалями — лише після підтвердження відповідності
- `localeMatch` = `confirmed` | `unconfirmed` | `conflict` | `duplicate`
- `localeMatchEvidence` містить `verified: true`, метод `explicit` або `manual` та спільний непорожній `reference`.

Підтвердження спирається на конкретне джерело: наприклад, явне посилання мовної версії/`hreflang` у перевіреній HTML-сторінці або зафіксовану ручну перевірку. Запис доказу має `id`, на який посилається `localeMatchEvidence.reference`; обидві сторінки пари містять цей доказ. Для ручного зіставлення `sourceType` доказу — `manual`, а `note` коротко описує, що саме перевірено. Валідатор перевіряє однаковий `reference` і наявність відповідного `evidence.id` у обох записах, але не може самостійно встановити достовірність висновку людини.

Схожість slug, назви, структури URL або однаковий шаблон маршруту не є доказом. Такі ознаки можуть лише вказати на пару-кандидат для перевірки. Без належного доказу обидва записи мають `localeMatch: 'unconfirmed'`, readiness `review`, а спільний `effectiveEntityKey` не присвоюється. `entityKey` не можна розділяти між uk/ru кандидатами на підставі лише схожості.

Приклад підтвердженої відповідності:
- `page:uk:product:avtokreslo-adbor-capri`
- `page:ru:product:avtokreslo-adbor-capri`
- спільний `entityKey`: `entity:product:avtokreslo-adbor-capri`
- в обох записах `localeMatch: 'confirmed'`, однакові `localeMatchEvidence` і `evidence.id`, що вказує на перевірене джерело відповідності.

Якщо будь-яка зі сторінок має відмінні title/slug/price/URL і немає чіткого доказу відповідності, маніфест ставить `localeMatch: 'unconfirmed'` або `conflict`, але не об'єднує записи автоматично.

### 4.4. Запобігання дублям
- `sourcePageKey` має бути унікальним для кожної окремої мовної сторінки.
- повторна екстракція тієї самої сторінки має повертати той самий `sourcePageKey`.
- якщо той самий URL знову з'являється, поле `duplicateOf` або `mergeCandidate` зберігається в manifest, але без автоматичного злиття непідтверджених записів.

### 4.5. Конфлікти
- повторний `sourcePageKey` у кількох сторінкових записах — структурний `reject`; різні версії вмісту потрібно розв'язати до валідації, а не трактувати як окремі мовні сутності
- спільний `entityKey` для різних типів записів або кількох сторінок тієї самої мови — структурний `reject`
- можливий uk/ru pair із тим самим `entityKey` або відповідним шляхом без доказу — readiness `review`, `localeMatch: 'unconfirmed'`, без спільного `effectiveEntityKey`
- підтверджений конфлікт між двома ідентичностями має `localeMatch: 'conflict'`; конфлікт `entityKey` не можна розв'язувати евристичним перейменуванням, потрібна ручна перевірка й виправлений manifest

## 5. Локалізація

### 5.1. Остаточні правила локалізації
Підтверджено в [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md), [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) і [src/models/common.ts](../src/models/common.ts):
- українська — корінь, без `/uk`
- російська — `/ru`
- локалізовані поля `{ uk, ru }`
- `slug.uk` і `slug.ru` перевіряються як обов'язкові для відповідного source-запису; готова Category/Product-сутність MongoDB потребує `slug.uk`
- `Media` slug не має
- strict slug lookup
- автоматичний fallback між мовами заборонений

### 5.2. Обробка типів записів

#### A. Запис з підтвердженими мовними полями
- `name.uk` / `name.ru` та `slug.uk` / `slug.ru` зберігаються тільки за наявності доказів для кожної локалізованої сторінки.
- Для source-запису `Category` або `Product` структурно обов'язковий непорожній slug мови цієї сторінки: `slug.uk` для uk та `slug.ru` для ru.
- Готова target-сутність `Category` або `Product` окремо повинна мати непорожній `slug.uk`. Це перевіряється на рівні migration readiness, а не structural validation source-сторінки.
- Відсутність необов'язкового другого мовного варіанта сама по собі не вимагає `review`.
- Спільний `entityKey` призначається тільки після підтвердження мовної відповідності за правилами розділу 4.3.

#### B. Самостійний український запис
- Українські `name.uk` і `slug.uk` зберігаються без штучного російського варіанта.
- Відсутність відповідної `/ru` сторінки сама по собі не змінює readiness на `review`.
- `entityKey` може бути відсутнім, якщо немає потреби або доказу групувати сторінку з іншою локалізацією.

#### C. Російськомовне джерело
- Російські значення зберігаються в `name.ru` та `slug.ru`; українські поля не заповнюються копіюванням чи fallback.
- Для російської source-сторінки непорожній `slug.ru` є структурною вимогою; відсутність `slug.uk` сама по собі не є structural reject.
- Щоб отримати готову MongoDB-сутність, `slug.uk` має бути підтверджений у цій сутності. Його можна взяти з відповідного uk source-запису лише за явним доказом мовної пари; якщо підтвердженої пари немає — readiness `review`, без вигадування значення чи автоматичного злиття.
- Непідтверджена пара лишається окремими кандидатами; сама схожість slug/URL не дає спільного `entityKey`.

#### D. Порожні локалізовані поля
- Порожні рядки та значення з пробілів не є локалізованим значенням; нормалізуй їх до `null` або не включай поле.
- Не заповнюй відсутню локаль значенням іншої мови.

#### E. Непідтверджена мовна відповідність
- Без `localeMatchEvidence` із джерелом, яке є в `evidence`, пара має `localeMatch: 'unconfirmed'` і readiness `review`.
- `localeMatch: 'confirmed'` без підтвердженої пари та спільного доказу не приймається валідатором як підтвердження.
- Автоматичне злиття чи fallback між мовами заборонено.

### 5.3. Заборона fallback
- manifest не повинен автозаповнювати `uk` з `ru` або навпаки
- необов'язкова відсутня локаль лишається `null` і не створює `review` сама по собі
- відсутній slug мови source-сторінки для Category/Product є structural помилкою
- відсутній `slug.uk` у готовій target-сутності є readiness `review`, якщо його не надає підтверджена мовна пара

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
    "rawText": "авансовий платіж ...; ... грн/доба; ... грн/тиждень",
    "currency": null,
    "type": "rental",
    "amount": null,
    "periodDays": null,
    "unit": null,
    "isConfirmed": false
  }
}
```

### 6.3. Правила
- `pricingRaw` зберігає отримані дані окремо від нормалізованого `Product.pricing`; `rawText` — джерельний текст, а не підтверджена числова ціна.
- У поточному контракті `pricingRaw` описує один тариф-кандидат: `type`, `amount`, `currency`, `periodDays`, `unit` та `isConfirmed`. Поля, яких немає в джерелі або які не можна однозначно розібрати, залишаються `null`/відсутні; `isConfirmed` має бути `false`.
- Для sale `amount` і `currency` можна зіставити з `pricing.salePrice` та `pricing.currency` лише після підтвердження, що сума є саме ціною продажу. Не виводь продаж із депозиту або орендної ставки.
- Для rental кожен підтверджений тариф зіставляється з елементом `pricing.rentalRates`: `amount` → `price`, `unit` → `unit`, `currency` → `currency`, `periodDays` → `periodDays` лише за наявності доказу. `deposit` додається лише коли депозит та його сума прямо підтверджені.
- Модель допускає необов'язковий `salePrice` і порожній масив `rentalRates`; модельні defaults для валюти не є доказом валюти legacy-ціни. Не підставляй `UAH`, нулі, інші числа, період або `salePrice` за припущенням.
- Оскільки поточний `pricingRaw` містить лише один тариф-кандидат, кілька різних legacy rental rates не можна звести до нього без втрати даних. Зберігай повний `rawText`, став `review`, а окреме представлення масиву тарифів погодь як майбутню зміну контракту.
- Непідтверджена ціна, відсутній числовий `amount`, непідтверджена валюта або невідомий тип дають readiness `review` із конкретними кодами причин. Для rental додатково потрібні підтверджені `periodDays` і `unit`; `salePrice` для товару, призначеного лише для оренди, не вимагається.

### 6.4. Архітектурний конфлікт
- Legacy-джерело може змішувати оренду, депозит, суму та умови в одному блоці.
- Це не еквівалент простого поля `price` у старій моделі [src/app/api/models/item.ts](../src/app/api/models/item.ts).
- Manifest зберігає неоднозначність для ручного розгляду; перетворення можливе лише з підтвердженими компонентами тарифу.

## 7. Media mapping

### 7.1. Факти
Підтверджено на товарній сторінці: `img src="/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg"`.
Модель `Media` потребує: [src/models/Media.ts](../src/models/Media.ts)
- обов'язкові: `filename`, `url`, `storageType`
- необов'язкові: `originalName`, `mimeType`, `sizeBytes`, `width`, `height`, `alt`, `importMeta`
- модель має унікальні індекси для `url` та `filename`; унікальність — контракт цільової сутності Media, а не доказ того, що повторне посилання на asset є помилковим.

### 7.2. MediaManifest structure

```ts
type MediaManifest = {
  sourcePageKey: SourcePageKey;
  entityKey?: EntityKey | null;
  legacyUrl: string;
  normalizedUrl: string;
  filename?: string | null;
  storageType?: 'local' | 'cloudinary' | 's3' | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
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
```

### 7.3. Правила
- `legacyUrl` зберігає джерельну адресу, `normalizedUrl` — валідний нормалізований URL; доступність URL мережею не перевіряється.
- `filename` та `storageType` обов'язкові для target-моделі Media, але відсутність MIME, розмірів, checksum чи alt сама по собі не є структурною помилкою. Якщо ім'я файла не можна достовірно визначити з URL або storage backend не підтверджений, не вигадуй значення: readiness потребує `review`.
- `alt` зберігається лише коли підтверджений атрибутом у джерелі.
- `storageType` обов'язковий у Mongoose-моделі, але не можна приписувати `local`/`cloudinary`/`s3` як факт про legacy storage без підтвердження. До такого підтвердження запис Media не готовий до перенесення.
- Одне зображення, використане кількома сторінками/товарами, є однією логічною Media-сутністю з кількома зв'язками. У manifest краще мати один запис asset і перелічити відомі `linkedProductEntityKeys` / `linkedCategoryEntityKeys`.
- Повтор URL у записах із різними `sourcePageKey` означає повторне використання або спостереження одного asset; це не structural error і саме по собі не дає `review`. Валідація перевіряє зв'язки з записами, але не завантажує зображення.
- Кілька записів з тим самим URL у межах одного `sourcePageKey` можуть означати дубль рядка manifest і потребують явного усунення/підтвердження (`review`). Сам URL, повторений на різних сторінках, не є конфліктом ідентичності.
- Справжній конфлікт виникає, коли той самий `entityKey` Media вказує на різні URL або однаковий унікальний `filename` ідентифікує різні URL; це суперечність ідентичності цільової моделі та structural `reject`. Різні `entityKey` для одного URL слід звести до одного asset без втрати всіх зв'язків.
- `duplicateOf` використовуй лише для явного посилання на відомий запис/ключ; не виводь його автоматично з однакового URL чи hash-кандидата.
- `availability` ставиться тільки за перевіреним джерелом, не за фактом наявності URL у HTML.

### 7.4. Порядок створення
1. Спочатку зібрати media URLs
2. Потім сформувати MediaManifest
3. Дедуплікувати asset за підтвердженою ідентичністю URL та зв'язати його з усіма відомими Product/Category через `linkedProductEntityKeys` і `linkedCategoryEntityKeys`
4. Перевірити конфлікти `entityKey`/`filename`, порядок галереї та явні дублікати; повторне використання URL між сторінками не відхиляти автоматично

## 8. Валідація

### 8.1. Структура ValidationIssue

```ts
type ValidationIssue = {
  code: string;
  severity: 'error' | 'warning' | 'info';
  status: 'accept' | 'review' | 'reject';
  message: string;
  field?: string;
  evidence?: SourceEvidence[];
};
```

### 8.2. Правила статусів

#### Accept
- запис структурно валідний
- усі потрібні для цільової моделі значення та зв'язки підтверджені
- готова `Category`/`Product`-сутність має непорожній `slug.uk`
- ціна та availability не є неоднозначними і не містять вигаданих значень
- мовні пари об'єднані лише за наявності перевіреного доказу; самостійний uk-запис не потребує ru-варіанта

#### Review
- значення присутні, але є неоднозначність або неповнота
- необов'язкове локалізоване поле чи варіант мови відсутній і його потрібно оцінити в бізнес-контексті; сама відсутність ru для самостійного uk-запису не є підставою
- `localeMatch` = `unconfirmed` або `conflict`
- source-сторінка структурно валідна, але для готової target-сутності немає підтвердженого `slug.uk` (наприклад, російський запис не має підтвердженої української пари)
- `pricingRaw` не дозволяє підтвердити суму/валюту/тип, або rental не має потрібного підтвердженого періоду чи одиниці
- Product не має підтвердженої availability
- Media повторюється в межах тієї самої source page і потребує розв'язання дублювання
- запис не є безповоротно непридатним, але потребує ручної перевірки

#### Reject
- JSON або структура запису неінтерпретовані, відсутній обов'язковий `sourcePageKey` чи некоректні обов'язкові технічні поля
- для source-запису `Category` або `Product` відсутній/порожній slug відповідної мови (`slug.uk` чи `slug.ru`)
- `entityKey` використано конфліктно (зокрема для різних типів чи кількох сторінок тієї самої мови), або однаковий media `filename` вказує на різні URL
- посилання порушують цілісність manifest або суперечать контракту

Валідатор відображає структурний результат окремо від readiness: структурно коректний, але бізнесово неповний запис може бути `review`; структурна помилка дає `reject`. Відсутність необов'язкового поля сама по собі не спричиняє ні `review`, ні `reject`. Media без необов'язкових `mimeType`, `width`, `height`, `checksum` чи `alt` не відхиляється через ці поля.

### 8.3. Типи перевірок
- **Structural validation:** коректність JSON, коренева структура manifest, обов'язковий `sourcePageKey`, типи, значення enum, унікальність ключів сторінок, обов'язковий slug мови source-запису для Category/Product, цілісність посилань і конфлікти ідентичності.
- **Migration readiness:** підтвердження локалізації та `entityKey`, наявність `slug.uk` у готовій сутності (включно з підтвердженою парою), необхідні бізнес-дані, цінові/availability питання і можливість відобразити дані на цільові Mongoose-моделі.
- MIME, width, height, checksum та alt медіа необов'язкові; URL медіа перевіряється синтаксично та на зв'язки, не мережею.

### 8.4. Зіставлення з Mongoose-моделями
Підтверджено в [src/models/common.ts](../src/models/common.ts), [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts) і [src/models/Media.ts](../src/models/Media.ts):

- `Category`: required `name`, `slug`, `status`; Mongoose validator готової сутності вимагає непорожній `slug.uk`; окремий російський source-запис може містити тільки `slug.ru`. `image`, `parentCategory`, `description` можуть бути відсутні.
- `Product`: required `category`, `name`, `slug`, `pricing`, `status`; Mongoose validator готової сутності вимагає непорожній `slug.uk`; окремий російський source-запис може містити тільки `slug.ru`. `pricing.currency` має model default, але це не підтверджує currency джерела; `salePrice` необов'язковий, `rentalRates` за замовчуванням порожній; `availability` має enum `in_stock | on_order | out_of_stock` і model default не є доказом наявності товару.
- `Media`: required `filename`, `url`, `storageType`; `alt`, `mimeType`, `sizeBytes`, `width`, `height` необов'язкові. Валідатор не відхиляє запис за відсутність необов'язкових медіа-метаданих; невідомі `filename`/`storageType` не вигадуються та блокують readiness, оскільки потрібні цільовій моделі.
- `common`: `LocalizedString` підтримує лише `uk` і `ru`; порожні значення заборонені; автоматичний fallback між мовами заборонений.

Поточна несумісність між legacy source і target schema залишається в pricing:
- legacy HTML часто містить орендні ціни/депозит/період, а `Product.pricing` в моделі передбачає структурований `salePrice` + `rentalRates`.
- поточний `pricingRaw` описує один тариф-кандидат; кілька ставок потрібно представити окремо до формування повного `rentalRates`.
- це є архітектурною невідповідністю, яку manifest має фіксувати як `review`, а не перекладати в здогад про ціну продажу.

## 9. Dry-run architecture

### 9.1. Ціль
Dry-run має:
1. читати manifest;
2. перевіряти структуру;
3. збирати `accept` / `review` / `reject`;
4. формувати ValidationReport;
5. не писати в MongoDB;
6. не зберігати документи в MongoDB;
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

### 9.3. Локальна підготовка Mongoose payload
- `prepare-import.mjs` окремо читає збережений manifest і відбирає лише source-записи `locale: 'uk'`; російські записи не зливаються та не перетворюються.
- Після етапу 3.8.10 підготовка застосовує defaults: `availability: 'in_stock'`, валюта `UAH`, відсутня/непідтверджена/некоректна ціна `0`, статус Category/Product `draft`. Підтверджені числові невід'ємні ціни й непорожня валюта зберігаються. Defaults позначені в наявному рядковому `importMeta.source`; це provenance-нотатка, а не нове поле моделі або підтвердження бізнес-даних.
- Rental-тариф створюється лише з підтвердженим непорожнім `pricingRaw.unit`; його `currency` задається явно. Інакше `rentalRates: []`, а відкладена сума позначається в `importMeta.source`. Ціна rental не записується в `salePrice`.
- Під час dry-run категорія використовується як тимчасова in-memory залежність для побудови Product `category` ObjectId; у підтвердженому імпорті посилання замінюється на фактичний ObjectId Category. Media не імпортується; зображення до optional `Product.images` не додаються.
- Payload перевіряється через `Document.validate()` на реальних Mongoose-моделях без підключення до БД. Невалідний документ блокує весь майбутній запис.
- Після 3.8.12 майбутній запис доступний лише з `--confirm-import` для рівно однієї української draft-пари. Імпортер читає лише `DB_HOST_TEST` із кореневого `.env`, відкриває ізольоване підключення з фіксованим `dbName: 'db-babyhub-test'` і перевіряє фактичну назву перед записом. `DB_HOST`/`MONGODB_URI` не використовуються; `autoCreate`/`autoIndex` вимкнені. URI та сирі помилки драйвера не логуються. Запуск Node.js потребує `--use-system-ca` для перевіреного локального TLS-середовища.
- Category/Product обробляються в одній транзакції. Пошук за `_id`, `slug.uk` або legacy URL виявляє дублікати та конфлікти. Єдиний наявний draft використовується без оновлення лише за збігу slug і legacy URL; неправильний зв'язок Product → Category блокує транзакцію. Новий Product отримує ObjectId фактичної Category. Після визначення ID обидва документи повторно валідовуються до першої вставки.
- Нові `_id` детерміновані за типом сутності та нормалізованим українським slug (24 hex-символи SHA-256); вбудований унікальний індекс `_id` блокує одночасні вставки того самого slug. Додаткові індекси не створюються. Конфлікти не перезаписують наявних даних. Сесія та підключення закриваються у `finally`. Dry-run не відкриває підключення й не читає `.env`; його ObjectId лишаються тимчасовими.

Поточний український payload проходить Category/Product-валідацію без зміни production-моделей: модель дозволяє порожній `rentalRates`, а `unit` обов'язковий лише для створеного тарифу. Dry-run 3.8.10: 1 Category, 1 Product, 0 помилок; локальні тести — 26/26. У 3.8.12 dry-run із `--use-system-ca` повторно успішний (0 створених документів), тести — 39/39; захисти запису перевірені на симуляторі в пам'яті. `--confirm-import` та MongoDB writes у 3.8.12 не запускалися. Це готовність схеми для draft, а не підтвердження ціни/наявності або публікації. Публічний каталог читає лише `published` Product у `published` Category.

**Фактична перевірка 3.8.13:** з окремим дозволом виконано транзакційний імпорт через `DB_HOST_TEST` і `node --use-system-ca` виключно в `db-babyhub-test`. До імпорту обидві колекції порожні; створено 1 українську Category (`1b04529bcd47ae89a17fdad1`) та 1 Product (`1e9f418c65cc80c3d3a56184`), обидва `draft`. Пряме читання з MongoDB підтвердило валідність актуальним моделям, defaults і правильне посилання Product → Category. Після цієї перевірки повторний запуск створив 0 документів і повторно використав обидва записи. Друге пряме читання підтвердило по 1 документу в колекції, по 1 збігу за цільовими slug/legacy URL та незмінність повного вмісту пари за SHA-256. Помилок або конфліктів немає; документи не публікувалися, відображення на сайті ще не перевірене. Деталі та межі JSON-артефакту наведені в [README міграції](../tools/content-migration/README.md).

**Підготовка фото 3.8.15:** окремий `tools/content-migration/migrate-product-photo.mjs` використовує наявні моделі й Cloudinary-модуль для одного фіксованого JPG та Product `1e9f418c65cc80c3d3a56184` виключно в `db-babyhub-test`. Dry-run читає товар і фото, локально валідовує майбутню Media з preview URL, не виконує upload або MongoDB writes. Підтверджений режим реалізовано, але ще не запускався: один службовий distributed lock у `content_migration_locks`, стабільні URL-derived ідентифікатори, перевірка походження Cloudinary за журналом/Media, журнал `upload-intent → uploaded → committed`, транзакція Media + `$addToSet` у Product.images із перевіркою результату. Схеми та Category не змінюються. Журнал зберігає content SHA-256 і fingerprint акаунта без credentials. Невідоме походження, конфлікти й неоднозначні стани блокують операцію; автоматичного видалення ресурсів або перехоплення stale lock немає. Команди, точні межі мутацій і відновлення наведені в [README міграції](../tools/content-migration/README.md).

**Виявлений блокер під час дозволеної спроби фото (стан на момент зупинки):** read-only `Cloudinary api.resource` підтвердив відсутність запланованого ресурсу через вкладений `error.error.http_code: 404`, але тодішній серверний нормалізатор читав лише верхній `error.http_code` й повертав 502. Перенесення зупинено до `--confirm-import`, upload, lock і журналу. Пряме читання тестової БД: Media — 0, Product.images — `[]`, Product — `draft`, Category не змінювалася. Деталі стану зафіксовані в README міграції.

**Подальше виправлення HTTP-нормалізації:** підтримано верхній і вкладений числові HTTP-коди 400–599; некоректні/суперечливі значення дають 502. Тільки підтверджений нормалізований 404 дозволяє майбутній upload; auth, мережеві та невідомі помилки блокують операцію. Пройдено 41/41 відповідних тестів, typecheck і `git diff --check`. Реальний read-only lookup підтвердив нормалізований 404, dry-run — успішний без upload або MongoDB writes. Підтверджене перенесення після виправлення ще не запускалося.

**Фактичне перенесення фото після виправлення нормалізації:** за повторним явним дозволом виконано підтверджений імпорт виключно в `db-babyhub-test`. Перший запуск: 1 upload, 1 Media (`2f19079efd10749817072a2d`), 1 оновлення Product.images. Після прямої перевірки виконано повторний запуск: 0 upload, 0 нових Media, 0 змін Product. Product `1e9f418c65cc80c3d3a56184` лишається `draft`, містить Media ID рівно один раз; решта полів і повний документ Category не змінилися за SHA-256. Media валідна, URL доступний через HTTPS (HTTP 200), JPEG 249×270, 9079 байтів, content SHA-256 збігається з джерелом. Lock звільнений (`owner: null`), журнал `product-photo-journal-v1.json` — `committed`. Public_id, фактичний URL та деталі перевірок наведено в README міграції. Публікацію й відображення на сайті не перевіряли.

### 9.4. Формат звіту

```json
{
  "validatorVersion": "2.0.0",
  "sourceManifest": "candidate-manifest.json",
  "structuralValidation": {
    "status": "valid",
    "recordsChecked": 8,
    "errors": []
  },
  "migrationReadiness": {
    "status": "review",
    "totalRecords": 8,
    "accepted": 0,
    "reviewRequired": 8,
    "issuesByCode": {},
    "records": []
  },
  "summary": {
    "totalRecords": 8,
    "accepted": 0,
    "reviewRequired": 8,
    "rejected": 0
  }
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

Фрагменти нижче демонструють тільки правило ідентичності, а не повні валідні записи. Пара вважається підтвердженою, якщо обидва записи посилаються на один перевірений доказ. Для цільового Product необхідний непорожній `slug.uk`; `status` залежить також від перевірених pricing, availability та інших readiness-вимог.

```json
{
  "sourcePageKey": "page:uk:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "localeMatch": "confirmed",
  "localeMatchEvidence": {
    "verified": true,
    "method": "manual",
    "reference": "locale-match:avtokreslo-adbor-capri"
  },
  "legacyUrl": "https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "uk",
  "name": { "uk": "Автокрісло Adbor Capri (0-10кг)", "ru": "Автокресло Adbor Capri (0-10кг)" },
  "slug": { "uk": "avtokreslo-adbor-capri", "ru": "avtokreslo-adbor-capri" },
  "evidence": [
    { "id": "locale-match:avtokreslo-adbor-capri", "url": "https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html", "sourceType": "manual", "note": "Сторінки зіставлено вручну." }
  ],
  "status": "review"
}
```

```json
{
  "sourcePageKey": "page:ru:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "localeMatch": "confirmed",
  "localeMatchEvidence": {
    "verified": true,
    "method": "manual",
    "reference": "locale-match:avtokreslo-adbor-capri"
  },
  "legacyUrl": "https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "ru",
  "name": { "uk": "Автокрісло Adbor Capri (0-10кг)", "ru": "Автокресло Adbor Capri (0-10кг)" },
  "slug": { "uk": "avtokreslo-adbor-capri", "ru": "avtokreslo-adbor-capri" },
  "evidence": [
    { "id": "locale-match:avtokreslo-adbor-capri", "url": "https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html", "sourceType": "manual", "note": "Сторінки зіставлено вручну." }
  ],
  "status": "review"
}
```

### 12.2. Дві мовні сторінки з непідтвердженою відповідністю

Це фрагменти ідентичності, не повні валідні записи. Український запис може лишатися readiness `review`, якщо його бізнес-дані ще не підтверджені. Російський source-запис без `slug.uk`, але з власним `slug.ru`, структурно валідний; без підтвердженої української пари він лишається readiness `review`, бо не утворює готову MongoDB-сутність.

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

Другий фрагмент має обов'язковий для російської source-сторінки `slug.ru`, тому проходить structural validation. Без підтвердженої пари migration readiness залишається `review`, оскільки готовій MongoDB-сутності потрібен підтверджений `slug.uk`. Не заповнюй його значенням з української сторінки та не об'єднуй записи до підтвердження відповідності.

### 12.3. Повторна екстракція тієї самої сторінки

```json
{
  "sourcePageKey": "page:uk:product:avtokreslo-adbor-capri",
  "entityKey": "entity:product:avtokreslo-adbor-capri",
  "legacyUrl": "/avtokrisla/avtokreslo_adbor_capri.html",
  "locale": "uk",
  "status": "review"
}
```

Фрагмент показує канонічний запис. Повторна екстракція тієї самої сторінки має оновлювати/повторно використовувати цей запис, а не додавати другий рядок із тим самим `sourcePageKey`; наявність двох сторінкових записів із цим ключем є structural `reject`.

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

Приклади показують тільки поля конфлікту, не повну структуру manifest record.

```json
{
  "sourcePageKey": "page:uk:product:konflikt-1",
  "entityKey": "entity:product:common-name",
  "localeMatch": "conflict",
  "legacyUrl": "/product-1.html",
  "status": "reject"
}
```

```json
{
  "sourcePageKey": "page:uk:product:konflikt-2",
  "entityKey": "entity:product:common-name",
  "localeMatch": "conflict",
  "legacyUrl": "/product-2.html",
  "status": "reject"
}
```

У цьому випадку різні `sourcePageKey` тієї самої мови претендують на один `entityKey`; валідатор вважає це структурним конфліктом і відхиляє обидва записи. Після ручного розгляду потрібен виправлений manifest; автоматичного об'єднання чи перепризначення ключа немає.

## 13. Архітектурні конфлікти

### Підтверджено
- Legacy HTML not tied to real DB; some data can be inferred but not guaranteed.
- Product schema expects structured `pricing` with `salePrice` + `rentalRates`, while old pages may provide only a rent block and deposit info. This is a structural mismatch, not a model bug. Verified in [src/models/Product.ts](../src/models/Product.ts) and [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).
- `Category` and `Product` validators require non-empty `slug.uk`; `slug.ru` is optional. `Media` has no slug. Verified in [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts), and [src/models/common.ts](../src/models/common.ts).
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
- Кожен source-запис Category/Product вимагає slug своєї мови; готова MongoDB-сутність вимагає `slug.uk`. Для Media slug не передбачений.
- Locale pair потребує спільного посилання на підтверджене джерело чи ручне зіставлення; URL/slug similarity не підтверджує зв'язок.
- Product pricing має різні `salePrice` і `rentalRates`; неповні або неоднозначні raw values не можна автоматично нормалізувати.
- Повторне використання Media URL між сторінками не є конфліктом; конфліктом є один ідентифікатор/унікальне filename, що вказує на різні URL.

### Запропоноване рішення
- Не імпортувати в MongoDB, а спочатку створити read-only manifest + validation pipeline.
- Зберігати raw legacy values і результати валідації окремо.
- Окремо повертати structural validation та migration readiness без автоматичного запису в базу.

### Непідтверджене припущення
- Якщо доступ до legacy DB / export не з'явиться, повна автоматична міграція не є безпечною і потребуватиме значної ручної верифікації.

### Питання для погодження
- Чи дозволяється приймати `review` записи в manifest для публічної міграції?
- Чи є допустимим підхід “manifest + review queue” без legacy DB export?
- Чи потрібен окремий owner-approval для `pricing`/`media`/`locale` conflicts?
