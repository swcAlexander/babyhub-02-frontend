# PROJECT_ARCHITECTURE.md

## 0. Актуальний стан проєкту

Поточний проєкт вже існує як Next.js App Router, але фактична структура не відповідає повністю цій архітектурі. У коді є:

- публічні сторінки `/`, `/catalog`, `/about`, `/login`, `/register`
- базове підключення до MongoDB (`src/app/api/connect/connect.ts`)
- декілька Mongoose моделей (`Item`, `User`, `Article`), але без доменної структури Baby Service
- відсутність локалізованих маршрутів, адміністраторської секції та чіткої сегментації public/admin API

Тому документація нижче має бути трактована як цільова архітектура, а не як поточний стан коду. Для реального проєкту потрібна корекція маршрутизації, видалення дублюючих API-патернів і перехід від загальних моделей до доменних колекцій.

## 1. Концепція архітектури

Новий проект має будуватись на Next.js App Router, TypeScript strict mode, MongoDB + Mongoose, SCSS Modules і розділеною логікою між публічною частиною сайту, адміністративною панеллю та бізнес-логікою. Не слід створювати надто глибоку вкладеність: потрібна архітектура, яка легко масштабується, але залишається читабельною для малого/середнього бізнес-сайту.

## 2. Ключові принципи

- App Router за замовчуванням
- Server Components як базовий тип рендерингу
- Client Components лише там, де потрібна взаємодія
- TypeScript strict mode
- MongoDB + Mongoose для моделі даних
- SCSS Modules для стилів UI
- Чітке розділення між public, admin, API, models, lib, utils, scripts
- Модулі і структури мають бути логічно пов’язані з доменом бізнесу, а не з HTML-стилем старого сайту

## 3. Рекомендована структура директорій

```text
project-root/
├── app/
│   ├── layout.tsx
│   ├── globals.scss
│   ├── not-found.tsx
│   ├── page.tsx
│   ├── about/
│   │   └── page.tsx
│   ├── catalog/
│   │   ├── page.tsx
│   │   ├── [categorySlug]/
│   │   │   ├── page.tsx
│   │   └── [categorySlug]/[productSlug]/
│   │       └── page.tsx
│   ├── news/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── articles/
│   │   ├── page.tsx
│   │   └── [slug]/page.tsx
│   ├── reviews/
│   │   └── page.tsx
│   ├── terms/
│   │   └── page.tsx
│   ├── partners/
│   │   └── page.tsx
│   ├── search/
│   │   └── page.tsx
│   ├── ru/
│   │   ├── page.tsx
│   │   ├── about/
│   │   │   └── page.tsx
│   │   ├── catalog/
│   │   │   ├── page.tsx
│   │   │   ├── [categorySlug]/
│   │   │   │   └── page.tsx
│   │   │   └── [categorySlug]/[productSlug]/
│   │   │       └── page.tsx
│   │   ├── news/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   ├── articles/
│   │   │   ├── page.tsx
│   │   │   └── [slug]/page.tsx
│   │   └── ...
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── products/
│   │   ├── categories/
│   │   ├── pages/
│   │   ├── news/
│   │   ├── articles/
│   │   └── reviews/
│   └── api/
│       ├── public/
│       │   ├── categories/
│       │   ├── products/
│       │   ├── pages/
│       │   ├── media/
│       │   ├── news/
│       │   ├── articles/
│       │   └── reviews/
│       └── admin/
│           ├── auth/
│           ├── categories/
│           ├── products/
│           ├── pages/
│           ├── media/
│           ├── news/
│           ├── articles/
│           └── reviews/
├── components/
│   ├── public/
│   │   ├── Header/
│   │   ├── Footer/
│   │   ├── Hero/
│   │   ├── ProductCard/
│   │   ├── CategoryCard/
│   │   ├── Breadcrumbs/
│   │   └── SearchBar/
│   ├── admin/
│   │   ├── Sidebar/
│   │   ├── DataTable/
│   │   ├── FormField/
│   │   └── ImageUploader/
│   └── ui/
│       ├── Button/
│       ├── Modal/
│       └── Pagination/
├── lib/
│   ├── mongodb.ts
│   ├── mongoose.ts
│   ├── i18n.ts
│   ├── utils.ts
│   ├── seo.ts
│   └── constants.ts
├── models/
│   ├── Category.ts
│   ├── Product.ts
│   ├── Page.ts
│   ├── Article.ts
│   ├── News.ts
│   ├── Review.ts
│   ├── Media.ts
│   ├── User.ts
│   └── SiteSettings.ts
├── services/
│   ├── categoryService.ts
│   ├── productService.ts
│   ├── pageService.ts
│   ├── mediaService.ts
│   ├── seoService.ts
│   └── contentImportService.ts
├── types/
│   ├── locale.ts
│   ├── product.ts
│   ├── category.ts
│   ├── page.ts
│   ├── article.ts
│   ├── news.ts
│   ├── review.ts
│   └── api.ts
├── validators/
│   ├── categoryValidator.ts
│   ├── productValidator.ts
│   ├── pageValidator.ts
│   ├── articleValidator.ts
│   └── reviewValidator.ts
├── hooks/
│   ├── useLocale.ts
│   ├── useSearch.ts
│   └── useMedia.ts
├── scripts/
│   ├── import/
│   │   ├── index.ts
│   │   ├── normalize.ts
│   │   ├── dedupe.ts
│   │   └── validate.ts
│   ├── scraper/
│   │   ├── crawl.ts
│   │   └── extract.ts
│   └── maintenance/
│       └── reindex.ts
├── public/
│   ├── images/
│   └── icons/
├── docs/
│   ├── CONTENT_AUDIT.md
│   ├── SITE_STRUCTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── PROJECT_ARCHITECTURE.md
│   ├── CONTENT_MODEL_MAPPING.md
│   └── URL_REDIRECT_MAP.md
├── .env.local.example
├── next.config.mjs
├── tsconfig.json
├── package.json
└── README.md
```

## 4. Розділення на публічну і адміністративну частину

### 4.1. Public frontend
Містить:
- головну сторінку українською (`/`)
- головну сторінку російською (`/ru`)
- сторінку каталогу (`/catalog`, `/ru/catalog`)
- категорії (`/catalog/[categorySlug]`, `/ru/catalog/[categorySlug]`)
- окремі сторінки товарів (`/catalog/[categorySlug]/[productSlug]`, `/ru/catalog/[categorySlug]/[productSlug]`)
- статті
- новини
- сторінки компанії, контакти, партнери, умови прокату
- SEO, canonical, hreflang і локалізацію

Принцип локалізації: українська мова — без префікса, російська — через `/ru`. Не передбачати окремий `/uk` префікс.

### 4.2. Admin panel
Потребує окремого маршруту `/admin` або `/dashboard` з доступом тільки авторизованим користувачам. Під адміністративну панель варто передбачити:
- Products
- Categories
- Pages
- Articles
- News
- Reviews
- Media
- SiteSettings
- Users / Roles

### 4.3. API layer
API routes / server actions мають бути чітко розділені на публічні та адміністративні:
- public: `products`, `categories`, `articles`, `news`, `pages`, `reviews`, `media`
- admin: `auth`, `categories`, `products`, `pages`, `news`, `articles`, `reviews`, `media`, `settings`

Публічні маршрути використовують read-only доступ, а адмін-маршрути — тільки з серверною перевіркою ролей. Не допускати дублювання між `app/api` і `(admin)/api`-структурою; один домен має мати одну логіку доступу й один набір серверних обробників.

## 5. Взаємодія між модулями

### 5.1. UI -> service
Компоненти публічного сайту взаємодіють тільки з даними, що надходять через server layer або API. UI не має напряму працювати з Mongoose моделями.

### 5.2. Services -> models
Сервіси виконують бізнес-логіку:
- отримання продуктів по категорії
- пошук по slug
- фільтрація по статусу
- генерація метаданих SEO
- обробка медіа

### 5.3. Validation
Перед нашими моделями/сервісами треба додати валідатори на рівні API. Для базового проєкту достатньо валідації речей, що приходять з адмін-панелі: назва, slug, фото, статус, ціна.

### 5.4. Content import scripts
Наявність окремого `/scripts/import` і `/scripts/scraper` забезпечить повторне імпортне відновлення контенту на етапі міграції.

## 6. Архітектура двомовності

Потрібно реалізувати локалізацію на рівні URL і контентних моделей. Рекомендована схема:

- `uk` — головний URL без локалі для української версії
- `ru` — російська мова через `/ru/...`
- базові відмінності: slug на кожну мову
- окремі `title`, `description`, `content` для `uk` і `ru`

Приклад:

```text
/avtokrisla
/ru/avtokrisla
/about
/ru/about
```

Механізм локалізації має підтримувати:
- один і той самий документ у двох мовах
- посилання між мовами за допомогою `locale` + `slug`
- відповідність між перекладеними сторінками через загальний `translationGroup` або `relatedTranslations`

Для спрощення без надмірних складностей достатньо зберігати поля `slug.uk`, `slug.ru` і при генерації URL вибирати відповідні поля за поточною мовою.

## 7. Керування SEO

SEO-логіка має бути уявною, але централізованою:
- `lib/seo.ts`
- `generateMeta` для кожної сторінки
- `getCanonicalUrl` між мовами
- `createPageMetadata` для сторінок і статей

Важливо зберігати:
- `title`
- `description`
- `keywords`
- `og:title`
- `og:description`
- `robots`
- `canonical`

## 8. Адміністративна панель

### 8.1. Доступ
- Авторизація через email/password або адміністративний токен
- Захист маршрутів за допомогою middleware
- Ролі: `admin`, `editor`, `manager`

### 8.2. Module structure
- `/admin` — dashboard
- `/admin/products` — обробка продуктів
- `/admin/categories` — категорії
- `/admin/pages` — статичні сторінки
- `/admin/news` — новини
- `/admin/articles` — статті
- `/admin/reviews` — відгуки
- `/admin/media` — медіафайли
- `/admin/settings` — загальні налаштування

## 9. Підключення до MongoDB

Рекомендована схема інтеграції:

```ts
// lib/mongodb.ts
export const connectToDatabase = async () => {
  // connect with Mongoose
};
```

Тут не слід змішувати фронтенд і MongoDB доступ. Підключення має відбуватись в сервісному шарі або в server-side route handlers після перевірки авторизації.

## 9.1. Реалізована серверна інтеграція Cloudinary (3.8.14)

Цей підрозділ описує фактичну реалізацію, незалежно від цільової структури вище.

- Залежність `cloudinary` існувала до 3.8.14. Legacy helper
  `src/app/api/helpers/cloudinary.js` глобально конфігурував SDK через `CLOUDINARY_APY_KEY`;
  `itemController.add` використовував `cloudinary.uploader.upload(..., { folder: 'items' })`.
  Наявний `src/app/api/items.ts` обробляє лише GET; нових публічних upload/delete маршрутів немає.
- Єдиний модуль інтеграції тепер — `src/lib/cloudinary.ts`. Маркер `server-only` (окрема пряма
  залежність) забороняє використання з Client Components. Legacy helper зберігає лише сумісний
  `uploader.upload`, делегуючи новому модулю; сирий SDK та конфігурація через нього не експортуються.
- `CLOUDINARY_API_KEY` — основна назва; непорожнє значення має пріоритет над старим
  `CLOUDINARY_APY_KEY`. Обов'язкові також `CLOUDINARY_CLOUD_NAME` і `CLOUDINARY_API_SECRET`.
  Значення читаються ліниво з `process.env`, без зміни глобальної конфігурації SDK.
  У Next.js env завантажує framework; окремий Node.js-скрипт має явно завантажити env сам.
  `.env.example` документує основну назву та legacy fallback; `.env` не змінено.
- `checkConfiguration()` перевіряє непорожні значення без мережі й повертає лише
  `{ configured: true, apiKeyVariable }`. Це перевірка наявності, а не автентифікації.
- `uploadImage(source, { folder?, public_id? })` приймає шлях/URL/data URI, передає `resource_type: 'image'`,
  `type: 'upload'`, `secure: true`, `overwrite: false`. Перезапис наявних зображень не дозволяється.
- `getImageInfo(publicId)` читає метадані image/upload через Admin API.
  `deleteImage(publicId)` викликає destroy лише для image/upload із `invalidate: true`;
  повертає `ok` або `not found`. Функція видалення в 3.8.14 перевірена лише на mock SDK.
- Завантаження й читання повертають тільки `public_id`, `secure_url`, HTTPS-аліас `url`,
  `width`, `height`, `bytes`, `format`. Ресурс має бути зображенням із коректними розмірами
  та HTTPS URL. Сирі відповіді, підписи й credentials не передаються викликачам.
- `CloudinaryServiceError` містить безпечні `code`, `status`, `message`. Помилки SDK не логуються
  й не зберігаються в `cause`; input paths, signed URL та секрети відкидаються.
  Factory `createCloudinaryService({ env, sdk })` дозволяє тести без реальної мережі.

Перевірка 3.8.14: 14/14 Cloudinary-тестів без завантажень/видалень, разом із міграційними —
53/53. TypeScript, lint і production build пройдено; lint має 4 попередження в незмінених
legacy-файлах. Перевірка 43 файлів `.next/static` не виявила значень Cloudinary API key/secret.
Фактична конфігурація `.env` використовує legacy `CLOUDINARY_APY_KEY`; окремий
автентифікований read-only Cloudinary Admin API `ping` із системними CA успішний. Це підтверджує
підключення й credentials, але не є перевіркою реального upload/delete. Міграція зображень
не запускалася; запис у Media/MongoDB і прив'язка зображень до товарів залишаються майбутнім етапом.

## 10. Основні обмеження архітектури

- Не робити глибокі вкладені зв’язки без потреби
- Не створювати розділ для “всіх типів контенту в одному”
- Не перевантажувати проєкт надлишковими абстракціями
- Не проектувати складну CMS-архітектуру для малого каталогу без явної потреби

## 11. Висновок

Архітектура для нового сайту Baby Service треба робити максимально практично: одна база даних, окремі колекції, чіткі моделі, розділення на public/admin/api та проста логіка локалізації. Це дасть достатню масштабованість для каталогу, статей, новин і контентних сторінок без зайвих складнощів.
