# Контрольований dry-run міграції контенту

Цей каталог містить ізольований інструмент для обмеженого HTML extraction з публічного legacy сайту.

## Обмеження
- `run-dry-run.mjs` і `validate-manifest.mjs` не підключаються до MongoDB.
- `prepare-import.mjs` без цілі лише формує payload і виконує локальну Mongoose-валідацію; із `--target` dry-run також читає обрану БД для перевірки конфліктів.
- Запис вимагає явних `--target` і `--confirm-import`; main додатково вимагає `--confirm-database=db-babyhub`. Спершу потрібна успішна валідація всіх payloads; запис виконується транзакцією.
- Не розширює список URL автоматично.
- HTML extraction не завантажує зображення; окремий фотоінструмент читає лише один погоджений JPEG.
- Не змінює production code.

## Актуальний вибір test/main і перевірка колекцій

Результати підготовки нижче зафіксовані до першого main-імпорту. Фактичне виконання
3.8.18 описане в [окремому розділі](#етап-3818-перший-контрольований-імпорт-у-main).
Наступне дозволене перенесення main-фото описане в [етапі 3.8.19](#етап-3819-перенесення-фотографії-для-main).

Цей розділ описує поточний код після 3.8.16. Нижчі описи 3.8.10–3.8.16 збережені як
історія перевірок; їх старі команди запису лише з `--confirm-import` тепер **відхиляються**.
На цьому етапі дозволені лише читання та dry-run; наведені команди запису підготовлено
для майбутнього окремо дозволеного етапу й **не виконували**.

### Джерела даних сайту: перевірено читанням 2026-11-10

| Модель / споживач | Фактична колекція / джерело |
| --- | --- |
| `src/models/Product.ts`, `Category.ts`, `Media.ts` | `products`, `categories`, `media` (перевірено `model.collection.name`) |
| Каталог, категорія й товар `/catalog/...`, `/ru/catalog/...` | `category.service.ts` / `product.service.ts` → нові Category/Product → `src/lib/mongodb.ts` → `DB_HOST` |
| Legacy `Item` (`src/app/api/models/item.ts`) | `items`; `itemController` читає Item і populate owner → legacy `user` → `users` |
| Legacy `article` (`src/app/api/models/articles.js`) | `articles`; посилання в `articleController` |
| Legacy `user` (`src/app/api/models/users.js`) | `users`; посилання в auth controller та middleware authenticate |
| Нові `Article` / `User` | За правилами Mongoose також `articles` / `users`; новий каталог їх не імпортує |

Legacy-назви перевірено за оголошеннями моделей без `collection` override та фактичним
Mongoose pluralizer, без запуску legacy-контролерів і без читання користувацьких документів.
`items` має інший контракт (`title`, string `price`, `poster`, `owner`) і **не є Product**.

У поточному App Router немає `route.ts`/`route.js`, які підключають legacy-контролери.
`src/app/api/items.ts` містить GET handler, але його розміщення не створює маршрут Next.js
App Router. Інших імпортів контролерів у сторінках не знайдено. Сторінки статей — заглушки;
форми login/register не підключені до legacy-auth. Тому наявність legacy-коду не є
підтвердженням активного HTTP API. Прямі виклики цих обробників не виконувалися, зокрема
через `populate`/логування owner у legacy Item GET. Mongoose hooks у legacy users лише
вмикають валідацію update та нормалізують помилки; самі не вибирають БД і не читають колекцій.
Клієнтських hooks завантаження каталогу не знайдено.

Фактичний `listCollections` основної `db-babyhub`: тільки **articles, items, users**.
Нових categories/products/media ще немає (читання count повернуло 0); їх індекси не
створювалися. Розбіжність міграції та каталогу — **база**, а не модель: попередній імпорт
створив нові документи в test; штатний каталог уже читає нові моделі з main (`DB_HOST`).
`src/lib/mongodb.ts` і legacy `src/app/api/connect/connect.ts` обидва використовують
`DB_HOST`, тестової прив'язки в них немає. Їх, сервіси, хуки та авторизацію не змінено.
Development preview збережено ізольованим у test.

### Захист цілі та артефактів

- `migration-target.mjs`: `test` → `DB_HOST_TEST` → тільки `db-babyhub-test`;
  `main` → `DB_HOST` → тільки `db-babyhub`. Змінні читаються **з кореневого `.env`**,
  без fallback та без успадкованої підміни PowerShell. Перед підключенням URI з явно
  іншою назвою бази відхиляється; URI без назви дозволений із примусовим `dbName`.
  Фактична назва перевіряється після підключення й перед операціями. `autoCreate`/`autoIndex`
  вимкнено; індекси явно не створюються. URI/credentials/raw driver errors не друкуються.
- Відсутність `--target` ніколи не дозволяє запис. Main вимагає обох підтверджень:
  `--confirm-import --confirm-database=db-babyhub`; помилки блокуються до підключення.
- Dry-run без цілі сумісний: prepare не читає `.env`/БД і пише старий `import-dry-run-v1.json`;
  photo читає test, як раніше, без upload/записів. Явна ціль prepare створює окремий
  `import-dry-run-test-v1.json` або `import-dry-run-main-v1.json` з результатом DB-перевірки
  та фактичними/запланованими стабільними ID; це план, а не копія документа з БД.
- Межа імпорту лишилася одна українська Category + один Product із manifest. Нові записи
  завжди draft. Перевіряються кандидати за `_id`, `slug.uk`, точним `importMeta.legacyUrl`,
  конфлікти/дублікати й зв'язок категорії; відповідні draft-документи використовуються повторно.
  Для main ID обчислюються окремо; тестові ID збережені для ідемпотентності.
- Фото обирається лише з `imageLegacyUrls` підготовленого запису Adbor Capri; зберігається
  allowlist конкретного legacyUrl/slug/JPEG. Product шукається за точним legacyUrl/slug,
  з єдиним збігом; справжній `_id` читається з обраної БД, потім закріплюється для всіх
  наступних перевірок/оновлення. Додатково перевіряється draft-категорія за ID/slug/legacyUrl.
- Main namespace — **`baby-service`**, test — **`baby-service-test`**. Main має окремий
  SHA-256-derived public_id/Media ID/filename, lock ID та `product-photo-journal-main-v1.json`.
  Тестовий `product-photo-journal-v1.json`, старі provenance, public_id/Media ID та lock
  збережені для відновлення. Поля database/productId/source/hash/account у журналі,
  namespace й provenance Media не дозволяють прийняти test як завершений main-імпорт.
- Фото dry-run читає Media, журнал і lock; зайнятий/conflicting lock блокує операцію,
  відсутній Product повертає `PRODUCT_IMPORT_REQUIRED`. Журнал/lock не створюються.
  Наявність Cloudinary-ресурсу **не перевіряється в dry-run**; перед майбутнім upload
  діє попередній lookup/provenance захист, лише типізований підтверджений 404 допускає upload.
- Збережені durable `upload-intent → uploaded → committed`, відновлення після часткового
  збою, транзакція Media + Product.images, `$addToSet`, перевірки до/після commit,
  `overwrite: false`, заборона автоматичного видалення/перехоплення lock.

### Точні команди PowerShell

Потрібен Node.js із `registerHooks`/TypeScript stripping (перевірено на v25.0.0).
`--use-system-ca` не вимикає TLS-перевірку. Успадкований `DB_HOST` для цих CLI ігнорується:
поточну конфігурацію беруть із файла без його зміни.

```powershell
Set-Location E:\Projects\babyhub-02-frontend

# Читання main + план однієї пари та фотографії
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --target=main
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=main

# Перевірка сумісності та повторного використання test
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --target=test
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=test
```

**Лише для майбутнього окремо дозволеного запису**: спершу пара, потім новий dry-run фото,
і лише після його перевірки — фото. Це не дозвіл виконувати наведені команди зараз.

```powershell
# Майбутній запис main
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --target=main --confirm-import --confirm-database=db-babyhub
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=main --confirm-import --confirm-database=db-babyhub

# Майбутній підтверджений запуск test
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --target=test --confirm-import
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=test --confirm-import
```

### Результат поточного етапу

- Main: payload valid, 1 Category + 1 Product, конфліктів немає; план `create-draft` для обох.
  Заплановані ID: Category `f1780080e3a428313fa00e67`, Product `1e7f71a16f3c0e7f577c424c`.
- Main photo: Product ще відсутній; `PRODUCT_IMPORT_REQUIRED`, Media/lock/журнал відсутні.
  План Media `cf32e0fd119d5555e07a2400`, public_id
  `baby-service/legacy-photo-cf32e0fd119d5555e07a240016073530326118910f8e55d1b7424ab50e540fba`.
  JPEG 249×270, 9079 байтів, SHA-256 збігається з перевіреним тестовим джерелом.
  Cloudinary main resource lookup/upload не виконувався; фактичний main URL ще невідомий.
- Test: Category/Product — `reuse`, наявна Media валідна, журнал `committed`, lock вільний;
  тестовий журнал і `.env` не змінилися за SHA-256 під час guarded dry-run.
- **97/97 тестів**, typecheck та `git diff --check` пройдено. Перевірено вибір цілі,
  окреме main-підтвердження, фактичну БД, ізоляцію журналів/ресурсів/locks, ідемпотентність,
  конфлікти й rollback/recovery на симуляторах без зовнішніх мутацій.
- Обидва dry-run обох цілей повторено із заблокованими драйверними методами мутацій,
  створення індексів і початку транзакцій та Cloudinary upload/delete: 0 спроб мутацій.
  Неявні сесії драйвера для читання дозволені; явні транзакції dry-run не запускає.
- Реальних `--confirm-import`, MongoDB writes, upload/delete, створення індексів,
  змін користувачів/auth, схем, статусів, `.env`, public-фільтрів, commit/push не було.
  Публікація й показ main draft у публічному каталозі не входять до цього етапу.

## Етап 3.8.18: перший контрольований імпорт у main

За явним дозволом виконано лише імпорт однієї підготовленої української Category
«Автокрісла» й одного Product Adbor Capri у `db-babyhub`; обидва залишилися `draft`.
Код інструментів, схеми, `.env`, публічні фільтри та авторизація на цьому етапі не змінювалися.

Перед записом пряме читання підтвердило фактичну `db-babyhub` та 0 Category, Product,
Media й службових locks. Зафіксовано лише кількості legacy articles/items/users
(без читання їх документів), контрольні суми `.env` і тестового фотожурналу.

Двічі послідовно виконано команду, між запусками — пряма перевірка результату:

```powershell
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --target=main --confirm-import --confirm-database=db-babyhub
```

| Результат | Перший запуск | Повторний запуск |
| --- | --- | --- |
| created.categories / products | 1 / 1 | 0 / 0 |
| reused.categories / products | 0 / 0 | 1 / 1 |
| Валідація | valid, 0 помилок | valid, 0 помилок |

Пряме читання через MongoDB driver після обох запусків підтвердило:

- Category `_id: f1780080e3a428313fa00e67`, `slug.uk: avtokrisla`,
  `importMeta.legacyUrl: https://lutsk.babyservice.ua/avtokrisla.html`, `status: draft`.
- Product `_id: 1e7f71a16f3c0e7f577c424c`, `slug.uk: avtokreslo-adbor-capri`,
  `importMeta.legacyUrl: https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html`,
  `category: ObjectId('f1780080e3a428313fa00e67')`, `status: draft`.
- Рівно 1 документ у кожній новій колекції; по 1 збігу за кожним цільовим slug та legacyUrl.
  Payload обох документів повністю збігається з підготовленим набором після узгодження ID;
  обидва документи додатково пройшли актуальну Mongoose-валідацію без записів.
- Product: `availability: in_stock`, `pricing.currency: UAH`, `rentalRates: []`,
  `salePrice` відсутній, `images: []`, `featured: false`, `displayOrder: 0`.
  Непідтверджена ціна 0 збережена як `deferred price=0 UAH` у `importMeta.source`,
  а не як тариф без одиниці. Це default, не підтверджена ціна чи наявність.
- Category: `displayOrder: 0`, `image: null`, `parentCategory: null`.
- Після повторного запуску повний прочитаний вміст Category й Product, включно з
  `createdAt`/`updatedAt`, точно збігається зі знімком після першого запуску:
  дублікатів і непотрібних оновлень немає.

`output/import-dry-run-main-v1.json` за наявним контрактом CLI оновлено навіть у
confirmed-режимі: поле `mode` — `confirmed-import`, `databaseChecked: true`, `result`
містить **останній повторний запуск** (created 0/0, reused 1/1). Попри назву файла,
цей результат уже не є dry-run; це не журнал обох запусків і не повний DB dump.

Для фотографії виконано **лише**:

```powershell
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=main
```

Фактичний план фото:

- Знайдено Product `1e7f71a16f3c0e7f577c424c` у main; точний source URL/slug,
  єдиність збігу, draft-статус та відповідність draft-категорії підтверджені.
  `dependency: null`; попередню залежність `PRODUCT_IMPORT_REQUIRED` усунув імпорт Product.
- Майбутня Media `_id: cf32e0fd119d5555e07a2400`.
- Майбутній `public_id`:
  `baby-service/legacy-photo-cf32e0fd119d5555e07a240016073530326118910f8e55d1b7424ab50e540fba`.
- План: `media: create-after-confirmed-upload`, `productImage: add-link`.
  Конфліктів у БД/журналі не виявлено; Media відсутня, lock відсутній, journalPhase null.
  `product-photo-journal-main-v1.json` не створений.
- Джерело JPEG перевірено: 249×270, 9079 байтів, SHA-256
  `916854470160e1ae0a0f1a8d70546538ac602ec10339452c946ffd5a5b0c9425`.
  Наявність ресурсу в Cloudinary **не перевірялася** (`not-checked-in-dry-run`),
  реальний main URL ще не створено. Media-модель валідна лише з позначеним preview URL.
- Результат dry-run: `uploads: 0`, `mongoWrites: 0`. Фото `--confirm-import` не запускали.

Після dry-run повторне пряме читання підтвердило незмінні Category/Product,
`images: []`, 0 Media та 0 locks. Кількості legacy articles/items/users і контрольні
суми `.env`/тестового фотожурналу не змінилися; тестову БД не підключали.
Єдині фактичні MongoDB-мутації цього етапу — створення дозволеної draft-пари в main.
Legacy-колекції/користувачі, test, схеми й public-фільтри не змінювалися; публікації,
Cloudinary upload/delete, commit/push не було. `git diff --check` пройдено.

## Етап 3.8.19: перенесення фотографії для main

За явним дозволом виконано один upload у namespace `baby-service`, створено одну Media
у `db-babyhub` і додано посилання лише до Product `1e7f71a16f3c0e7f577c424c`.
Передбачені інструментом main lock та журнал також були дозволені.

Перед записом пряме читання підтвердило правильні draft Product/Category,
`Product.images: []`, 0 Media, 0 locks, відсутність main-журналу. Read-only Cloudinary
lookup підтвердив відсутність цільового ресурсу нормалізованим HTTP 404.
Перевірене джерело — один погоджений JPEG 249×270, 9079 байтів.

Виконано команду, потім пряме читання/HTTP-перевірку результату, і лише після успіху —
ту саму команду повторно:

```powershell
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --target=main --confirm-import --confirm-database=db-babyhub
```

| Результат | Перший запуск | Повторний запуск |
| --- | --- | --- |
| uploads | 1 | 0 |
| createdMedia | 1 | 0 |
| productModified | 1 | 0 |

Створений ресурс і документ:

- `public_id`: `baby-service/legacy-photo-cf32e0fd119d5555e07a240016073530326118910f8e55d1b7424ab50e540fba`.
- URL: `https://res.cloudinary.com/dmvl4lxnq/image/upload/v1794317657/baby-service/legacy-photo-cf32e0fd119d5555e07a240016073530326118910f8e55d1b7424ab50e540fba.jpg`.
- Media `_id`: `cf32e0fd119d5555e07a2400`; `storageType: cloudinary`, `mimeType: image/jpeg`,
  249×270, 9079 байтів. Прямо прочитаний документ пройшов актуальну Mongoose-валідацію;
  URL/розміри/bytes збігаються з Cloudinary resource lookup та журналом.

Прямі перевірки після обох запусків:

- У main рівно 1 Category, 1 Product, 1 Media. Єдиний кандидат Media за filename,
  source URL або Cloudinary URL; `Product.images` містить Media ObjectId рівно один раз.
- Product `1e7f71a16f3c0e7f577c424c` і Category `f1780080e3a428313fa00e67` лишилися draft.
  Повний вміст Category незмінний проти знімка до перенесення. У Product змінилося лише
  `images`; решта полів, включно з timestamps, не змінилася.
- Повний вміст Product, Category, Media та нормалізовані Cloudinary-метадані після
  повторного запуску точно збігаються зі знімком після першого. Нових ресурсів/документів
  не створено, товар повторно не змінено.
- Lock `baby-service-photo-main-v1:cf32e0fd119d5555e07a2400` збережений, `owner: null`.
  `output/product-photo-journal-main-v1.json` має фазу `committed` із правильними
  database/productId/publicId/mediaId, content SHA-256 та image URL. Журнал потрібно зберігати.
- HTTPS GET після кожного запуску: **HTTP 200**, `image/jpeg`, 9079 байтів, JPEG 249×270.
  SHA-256 байтів фото
  `916854470160e1ae0a0f1a8d70546538ac602ec10339452c946ffd5a5b0c9425`
  збігається з поточним джерелом, provenance Media та журналом.

Помилок немає. Кількості legacy articles/items/users не змінилися; їх документи не читали
й не змінювали. Тестову БД не підключали, `.env` та тестовий фотожурнал незмінні за SHA-256.
Інструменти, схеми, auth і public-фільтри не змінювалися; документи не публікували,
ресурси не видаляли/не перезаписували, commit/push не виконували. Перевірки цього етапу —
фактичні DB/Cloudinary-читання, HTTP GET і порівняння байтів/знімків; відображення main-фото
в браузері та новий build/typecheck не перевіряли. `git diff --check` пройдено.

## Запуск

```bash
node tools/content-migration/run-dry-run.mjs
```

## Вихідні файли

Результати зберігаються в:
- `tools/content-migration/output/candidate-manifest.json`
- `tools/content-migration/output/validation-report.json`

## Локальна перевірка збереженого manifest

Щоб перевірити вже збережений manifest без HTTP-запитів і без підключення до MongoDB:

```bash
node tools/content-migration/validate-manifest.mjs
```

Команда читає `output/candidate-manifest.json` і створює окремий
`output/validation-report-v2.json`; вихідний manifest та попередній звіт не змінюються.
Для власних локальних файлів можна передати вхідний і вихідний шляхи:

```bash
node tools/content-migration/validate-manifest.mjs ./path/to/manifest.json ./path/to/report.json
```

Звіт окремо містить результат structural validation та migration readiness.
Для `localeMatch: "confirmed"` потрібне явне підтвердження у
`localeMatchEvidence` (`verified: true`, `method: "manual"` або `"explicit"` і спільний
непорожній `reference` для обох сторінок). Подібність URL чи slug лише позначає
можливу мовну пару для ручної перевірки й не об'єднує її автоматично.
Для підтвердженого rental-тарифу також потрібен `pricingRaw.unit`, щоб без припущень
зіставити його з обов'язковим `unit` у цільовій `rentalRates` моделі.

## Підготовка українських документів

Локальний dry-run читає збережений manifest, обробляє лише source-записи `locale: "uk"`,
формує документи `Category`/`Product` і перевіряє їх наявнісними Mongoose-моделями без
підключення до БД:

```bash
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs
node --use-system-ca --experimental-strip-types --test tools/content-migration/prepare-import.test.mjs tools/content-migration/validate-manifest.test.mjs
```

Результат записується в `output/import-dry-run-v1.json` (повторний запуск оновлює цей звіт).
Стан після етапу 3.8.10: українські Category і Product зі збереженого manifest проходять
локальну Mongoose-валідацію. Production-моделі не змінені.

- Availability автоматично задається як `"in_stock"`; це default, а не підтвердження наявності.
- Відсутня, непідтверджена або некоректна ціна (не число, нескінченна чи від'ємна) отримує `0`.
  Валюта за замовчуванням — `UAH`; підтверджена непорожня валюта зберігається у верхньому регістрі.
- Якщо rental-одиниця не підтверджена (`isConfirmed !== true` або порожній `unit`),
  `rentalRates` залишається `[]`. Модель дозволяє порожній масив, а `unit` обов'язковий лише
  всередині тарифу. Відкладена сума (`0` для неперевіреної ціни) записується в `importMeta.source`,
  а не в тариф без одиниці. Rental не перетворюється на `salePrice`.
- Для створеного rental-тарифу валюта задається явно й збігається з `pricing.currency`.
- Category та всі Product готуються як `draft`, включно з товарами з підтвердженою ціною.
  Автоматичні значення й відкладення тарифу позначені в наявному `importMeta.source`.

Валідність схеми не означає готовності до публікації: ціна, одиниця прокату та наявність
потребують перевірки. Сервіси сайту повертають лише опубліковані товари з опублікованих
категорій, тому підготовлений draft ще не відображатиметься в публічному каталозі.
Перший запис потребує окремого дозволу на MongoDB writes, `DB_HOST_TEST` у кореневому `.env`
та MongoDB із підтримкою транзакцій. У 3.8.11c підключення й `ping` до Atlas успішно перевірено
з `--use-system-ca`: цей параметр додає системне сховище довірених сертифікатів, зберігаючи TLS-перевірку.
У 3.8.12 імпорт і мережеві перевірки не запускалися.

Локальні перевірки етапу 3.8.10: 26/26 тестів пройдено (7 підготовки payload і 19 manifest validation);
dry-run: 1 Category, 1 Product, `validation.status: "valid"`, 0 помилок.

### Захисти імпортера після етапу 3.8.12

- Dry-run — режим за замовчуванням: не читає `.env`, не підключається до MongoDB, не починає
  сесій і не створює документів. Оновлюється лише локальний JSON-звіт; у ньому `targetDatabase`
  є запланованою ціллю, а не підтвердженням фактичного підключення.
- Лише для явно підтвердженого імпорту `dotenv.parse` читає `DB_HOST_TEST` із кореневого `.env`.
  `DB_HOST`, `MONGODB_URI` та успадковані змінні середовища не використовуються як fallback.
  URI не виводиться в лог; помилки CLI містять лише фіксовані коди без сирих повідомлень драйвера.
- Ізольоване Mongoose-підключення завжди отримує `dbName: 'db-babyhub-test'`, незалежно від бази
  в URI. Фактична назва бази перевіряється перед сесією та перед вставками. Будь-яка інша назва
  блокує запис. `autoCreate`, `autoIndex` і buffering вимкнені; production-підключення не зачіпається.
- Дозволено рівно одну українську Category та один Product зі статусом `draft` і legacy URL.
  Обидва документи проходять Mongoose-валідацію до підключення та повторно після визначення
  фактичних ObjectId, до першої вставки.
- Усередині однієї транзакції пошук дублікатів виконується за `_id`, `slug.uk` або
  `importMeta.legacyUrl`. Єдиний наявний draft повторно використовується лише за збігу і slug,
  і legacy URL; він не оновлюється. Кілька збігів, конфлікт ідентичності чи published-запис
  блокують транзакцію.
- Для нових записів `_id` детерміновано утворюється з типу сутності та нормалізованого
  українського slug (SHA-256, перші 24 hex-символи). Обов'язковий унікальний індекс `_id`
  захищає від одночасного повторного створення того самого slug без додавання індексів.
  Після конфлікту паралельної вставки операція завершується помилкою; повторний запуск
  повторно шукає вже збережені документи. Тимчасові ObjectId з dry-run не є майбутніми ID у БД.
- Новий Product посилається на ObjectId створюваної або повторно використаної Category.
  Наявний Product із посиланням на іншу Category блокує транзакцію. Помилка вставки товару
  відкочує вставку категорії. Сесія й ізольоване підключення закриваються також у разі помилки.

Перевірки 3.8.12: **39/39 локальних тестів** (20 імпортера, 19 manifest validation).
Ідемпотентність, конфлікти, відкат та заборона неправильної бази перевірені на симуляторі
в пам'яті, без MongoDB writes. Dry-run через `node --use-system-ca`: 1 Category, 1 Product,
валідація успішна; створено 0 документів. CLI dry-run також пройшов із примусово заблокованими
методами підключення Mongoose/MongoClient. Окремо без мережі перевірено завантаження реального
`DB_HOST_TEST` із `.env` без виведення URI. На момент завершення 3.8.12 перший реальний запис
і поведінка транзакції на Atlas ще не були перевірені; фактичний результат 3.8.13 наведено нижче.

Команда майбутнього контрольованого запису (лише після окремого дозволу):

```bash
node --use-system-ca --experimental-strip-types tools/content-migration/prepare-import.mjs --confirm-import
```

Прапорець коректно розбирається окремо від двох необов'язкових позиційних шляхів input/output.
Не запускай його в межах етапу підготовки; у 3.8.12 він не запускався.

### Фактичний контрольований імпорт — етап 3.8.13

- Підключення: `DB_HOST_TEST` із кореневого `.env`, `node --use-system-ca`, фактична база
  `db-babyhub-test`; `ping` успішний. До запису `categories` і `products` містили по 0 документів.
- Перед імпортом повторено локальний dry-run: одна українська Category та один Product,
  Mongoose-валідація успішна, 0 помилок.
- Перший запуск із `--confirm-import` успішно завершив транзакцію: створено **1 Category
  та 1 Product**, повторно використано 0. Жодних записів в інші бази не виконувалося.
- Створена Category: slug `avtokrisla`, `_id: 1b04529bcd47ae89a17fdad1`.
- Створений Product: slug `avtokreslo-adbor-capri`, `_id: 1e9f418c65cc80c3d3a56184`;
  його `category` дорівнює `1b04529bcd47ae89a17fdad1`.
- Після запису документи прочитані безпосередньо через MongoDB driver і локально перевірені
  актуальними Mongoose-моделями: обидва валідні, статуси `draft`, українські назви й slug,
  зв'язок Product → Category правильний.
- Defaults підтверджені зі збережених даних: `availability: 'in_stock'`, `pricing.currency: 'UAH'`,
  `rentalRates: []`, `salePrice` відсутня. Непідтверджена відкладена ціна `0` і автоматичні
  значення позначені в `importMeta.source`; одиниця прокату не вигадувалася.
- Лише після успішного прямого читання виконано повторний імпорт: створено **0 Category
  та 0 Product**, повторно використано **1 Category та 1 Product** з тими самими ObjectId.
- Повторне пряме читання підтвердило: загалом у кожній колекції по 1 документу; за кожним
  цільовим slug і legacy URL рівно 1 збіг. Дублікатів немає. SHA-256 від повного прочитаного
  вмісту пари до та після повторного запуску збігається, включно з часовими полями:
  наявні документи не перезаписані. Усі з'єднання закриті.

Помилок або конфліктів імпорту не виявлено. Перевірка відображення на сайті ще не виконана:
товар і категорія залишаються `draft`, тому публічні сервіси їх не повертають. Ціна, одиниця
прокату та фактична наявність залишаються предметом окремої перевірки перед публікацією.
Моделі, production-код, `.env` і статуси на `published` не змінювалися.

`output/import-dry-run-v1.json` після запуску містить `mode: 'confirmed-import'`, але зберігає
підготовлені payload із тимчасовими ObjectId до запису. Це не копія документів із БД і не
окремий журнал commit транзакції; фактичні ID та результати прямого читання зафіксовані вище.

### Cloudinary: готовність серверного модуля — етап 3.8.14

Для майбутнього перенесення зображень доступний `src/lib/cloudinary.ts`:
`checkConfiguration()`, `uploadImage(source, { folder?, public_id? })`, `getImageInfo(publicId)`,
`deleteImage(publicId)`. Це серверна бібліотека; публічних upload/delete API не додано.
Існуючий legacy upload helper делегує цьому модулю. На момент завершення 3.8.14 міграційні
інструменти ще його не викликали; окремий інструмент 3.8.15 описано нижче. Media/MongoDB-моделі не змінені.

Credentials: `CLOUDINARY_CLOUD_NAME`, основний `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Якщо основний ключ порожній, підтримується наявний `CLOUDINARY_APY_KEY`. Конфігурація
перевіряється ліниво, без глобальної мутації SDK або логування значень. `.env` не змінено.
Next.js сам завантажує env; майбутній окремий Node.js-скрипт має завантажувати його явно,
а через `server-only` запускати імпорт модуля з `--conditions=react-server`.

```bash
node --use-system-ca --conditions=react-server --experimental-strip-types --test src/lib/cloudinary.test.mjs
```

14/14 Cloudinary-тестів пройдено на mock SDK: пріоритет ключів, неповна конфігурація,
валідація аргументів/відповідей, upload/info/delete, безпечні помилки, сумісність helper
та серверна межа. Разом із міграційними тестами — 53/53. Typecheck, lint і production build
успішні; lint має 4 попередження в незміненому legacy-коді. Окремий read-only Admin API `ping`
успішний із фактичним legacy-ключем; секрети не виводилися.

Upload примусово використовує `overwrite: false`, відповіді повертають тільки безпечні
метадані й HTTPS URL. Реальні завантаження, видалення та міграція не виконувалися;
поведінка цих операцій у Cloudinary залишається неперевіреною до окремо погодженого етапу.
Повний контракт описано в [архітектурі проєкту](../../docs/PROJECT_ARCHITECTURE.md#91-реалізована-серверна-інтеграція-cloudinary-3814).

### Одна фотографія товару — інструмент 3.8.15

`migrate-product-photo.mjs` має незмінні межі, без аргументів для іншого URL, товару чи бази:

- `DB_HOST_TEST` із кореневого `.env`, фактична база тільки `db-babyhub-test`;
- Product `_id: 1e9f418c65cc80c3d3a56184`, `slug.uk: avtokreslo-adbor-capri`;
- Product `importMeta.legacyUrl: https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html`;
- єдине фото: `https://lutsk.babyservice.ua/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg`.

Dry-run за замовчуванням (читає MongoDB і завантажує фото лише в оперативну пам'ять):

```bash
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs
```

Запис, лише після окремого дозволу. У підготовчій частині 3.8.15 не запускався;
результати подальшого дозволеного виконання наведені нижче:

```bash
node --use-system-ca --conditions=react-server --experimental-strip-types tools/content-migration/migrate-product-photo.mjs --confirm-import
```

Перевірки й межі:

- Використовуються наявні `src/lib/cloudinary.ts`, Mongoose-моделі та захищене ізольоване
  підключення з `prepare-import.mjs`. Схеми, `.env`, основна БД і Category не змінюються.
- Перед кожною мутацією повторно перевіряються фактична база та точний draft-товар.
  Додаткові збіги за slug/legacy URL, дублікати в `images`, неправильний статус блокують операцію.
- Фіксований HTTPS GET із тайм-аутом 15 с, без редиректів; потрібні HTTP 200, `image/jpeg`,
  фактичні JPEG-маркери SOI/SOF/SOS/EOI, додатні розміри до 10000×10000, максимум 5 MiB.
  Розмір перевіряється за потоком і доступним Content-Length. Обчислюється SHA-256 байтів.
  Це перевірка формату/структури заголовків, не повне декодування JPEG-пікселів.
- SHA-256 від `baby-service-photo-v1:<source URL>` задає стабільні Cloudinary `public_id`,
  Media `_id` (перші 24 hex) і `filename`. Логотип із manifest не використовується.
- Dry-run не викликає Cloudinary API, не пише журнал, lock, Media чи Product і не створює
  колекцій/індексів. Media валідовується локально з явно позначеним preview URL; справжній
  Cloudinary URL до запису невідомий. Результат виводиться у stdout без секретів.
- Лише підтверджений режим створює/захоплює один службовий запис
  `content_migration_locks`, `_id: 'baby-service-photo-v1'`. Атомарний upsert та обов'язкова
  унікальність `_id` блокують одночасні запуски з різних процесів/комп'ютерів.
  Після завершення `owner` скидається в `null`, запис не видаляється. Автоматичного TTL/перехоплення немає.
- Перед upload виконується `getImageInfo(public_id)`. Лише `CloudinaryServiceError` із кодом
  `CLOUDINARY_REQUEST_FAILED` і статусом 404 підтверджує відсутність. Мережеві, auth та інші
  помилки блокують перенесення. Upload отримує data URI **саме перевірених байтів**, а не URL для
  повторного завантаження Cloudinary; модуль примусово встановлює `overwrite: false`.
- Наявний ресурс приймається лише з підтвердженням у журналі `uploaded`/`committed` або
  власному provenance Media. Перевіряються public_id, HTTPS URL, format, bytes, width/height.
  Невідоме походження, зміна джерела/акаунта або інші конфлікти зупиняють операцію.
- Кандидати Media перевіряються за `_id`, filename, source URL і відомим Cloudinary URL.
  Наявна Media повинна точно відповідати source SHA-256, ідентифікаторам і метаданим.
  Конфліктні записи не змінюються. Додаткові унікальні індекси для захисту не потрібні:
  операцію серіалізує lock, а стабільний Media `_id` не дозволяє повторну вставку.
- В одній MongoDB-транзакції створюється максимум одна валідована Media (`storageType: cloudinary`,
  JPEG MIME, розміри, bytes, originalName, timestamps, source URL/provenance в `importMeta`)
  та виконується `$addToSet` лише для `Product.images`. Наявні зображення зберігаються;
  статус, Category та решта полів Product не змінюються. `matchedCount`/`modifiedCount`,
  Media й одиничне посилання перевіряються в транзакції та повторним читанням після commit.

Журнал і відновлення:

- `output/product-photo-journal-v1.json` створюється тільки в режимі запису. Містить source URL,
  public_id, Media ID/filename, SHA-256 і розміри байтів, fingerprint cloud name та безпечні
  метадані Cloudinary; credentials і самі байти не зберігаються. Оновлення — через flush
  тимчасового файла й atomic rename. Журнал слід зберігати між запусками.
- Послідовність: `upload-intent` **до upload**, `uploaded` з підтвердженою відповіддю **до
  транзакції Media/Product**, `committed` після прямого читання результату.
- Якщо транзакція не завершилася, стан `uploaded` дозволяє повторно перевірити ресурс і
  завершити MongoDB-частину без нового upload. Якщо commit відбувся, але журнал не оновився,
  повторний запуск використовує наявну Media, `$addToSet` не дублює посилання.
- Якщо журнал втрачено, відновлення можливе через точний provenance вже збереженої Media.
  Самого `upload-intent` недостатньо для прийняття наявного ресурсу: після втрати відповіді
  upload/помилки диска операція блокується для ручної перевірки. Якщо ресурс усе ще підтверджено
  відсутній (новий 404), `upload-intent` можна безпечно повторити. Ресурс, раніше підтверджений
  як `uploaded`/`committed`, при подальшому 404 автоматично не відновлюється.
- Після жорсткого завершення процесу lock може залишитися зайнятим. Спочатку потрібно
  окремо перевірити, що попередній процес не працює, звірити власника, журнал і ресурс;
  звільнення цього lock потребує окремо дозволеної операції. Інструмент не має команди force-unlock.
  Якщо товар утратив відповідність/draft, автоматичне звільнення також блокується.
- Cloudinary не входить у MongoDB-транзакцію. За помилок ресурс не видаляється й не перезаписується.
  Після дискової помилки може лишитися `.tmp` журнала; він не є підтвердженням завершеного upload.

Локальні перевірки:

```bash
node --use-system-ca --conditions=react-server --experimental-strip-types --test tools/content-migration/migrate-product-photo.test.mjs src/lib/cloudinary.test.mjs tools/content-migration/prepare-import.test.mjs tools/content-migration/validate-manifest.test.mjs
```

Фактичний dry-run 3.8.15 успішний: точний товар знайдено в `db-babyhub-test`, Media відсутня;
фото HTTP 200, `image/jpeg`, JPEG **249×270**, **9079 байтів**,
SHA-256 `916854470160e1ae0a0f1a8d70546538ac602ec10339452c946ffd5a5b0c9425`.
Пройдено **77/77 тестів** (24 нового інструмента, 53 попередніх) і TypeScript typecheck.
Dry-run також виконано з примусово заблокованими методами мутацій MongoDB та Cloudinary.
Прямі знімки до/після підтвердили: Media — 0, lock-записів — 0, журнал не створений,
повний вміст Product і Category не змінився. Upload і записи в MongoDB не виконувалися. Реальна підтверджена
транзакція й upload залишаються неперевіреними до наступного окремо дозволеного кроку.

#### Спроба дозволеного перенесення: зупинка на read-only перевірці

Після надання дозволу до запуску `--confirm-import` виконано пряме читання тестової БД
та Cloudinary lookup запланованого public_id. Перенесення зупинено без мутацій через
виявлену помилку нормалізації відповіді Cloudinary Admin API:

- SDK `cloudinary@2.2.0` повертає відсутній ресурс як `{ error: { http_code: 404, ... }, ... }`.
  Це підтверджено прямим read-only викликом `api.resource` без логування сирої помилки.
- На момент цієї спроби `src/lib/cloudinary.ts` перевіряв лише верхній `error.http_code`, тому перетворював
  цей підтверджений 404 на `CloudinaryServiceError(status: 502)`. Захист інструмента
  правильно не дозволяє upload після 502.
- Запланований `public_id`:
  `baby-service-test/legacy-photo-2f19079efd10749817072a2d105d81c4cbdad38946fb28ef70532ac16fdadd5a`.
  Ресурс за ним відсутній; новий ресурс і Cloudinary URL не створено.
- Пряме читання `db-babyhub-test`: Media — **0**; Product
  `1e9f418c65cc80c3d3a56184` лишається `draft`, `images: []`; Category
  `1b04529bcd47ae89a17fdad1` лишається `draft`, `image: null`.
- Lock відсутній, `product-photo-journal-v1.json` не створений. Перший підтверджений запуск
  і повторний запуск не виконувалися. Нічого не завантажувалося, не змінювалося й не видалялося.

Мінімальний наступний крок — врахувати вкладений `error.error.http_code` у безпечному
нормалізаторі Cloudinary та додати регресійний тест реальної форми SDK-помилки. На цій
спробі код не виправлявся: виконано умову зупинки при помилці; повторне перенесення
потребує наступного окремого кроку після виправлення й перевірки.

#### Виправлення нормалізації HTTP-коду після зупиненої спроби

`src/lib/cloudinary.ts` тепер підтримує числовий HTTP-код як у верхньому `error.http_code`,
так і у вкладеному `error.error.http_code`. Приймаються лише цілі значення 400–599.
Якщо присутні обидва коди, вони мають збігатися; некоректні або суперечливі значення
консервативно дають 502. `status`, текст повідомлення та мережевий `code` не трактуються як HTTP 404.
Помилки SDK, request options, credentials і raw cause надалі не логуються й не повертаються.

Міграція як і раніше допускає upload лише після `CloudinaryServiceError` із
`CLOUDINARY_REQUEST_FAILED` та підтвердженим статусом 404. Auth 401/403, мережеві й невідомі
помилки блокують її. Перевірено регресійними тестами верхній/вкладений 404, конфлікти кодів,
некоректні типи, авторизацію та мережеві помилки; окремий тест пропускає справжній
нормалізатор через інструмент міграції з mock SDK, без зовнішніх мутацій.

Результати: **41/41 відповідних тестів** (16 Cloudinary, 25 перенесення фото), TypeScript
typecheck і `git diff --check` успішні. Фактичний read-only `getImageInfo(public_id)` тепер
правильно повертає нормалізований **404**, підтверджуючи відсутність запланованого ресурсу.
Dry-run успішний: JPEG 249×270, 9079 байтів, Media відсутня, журнал відсутній,
0 upload і 0 MongoDB writes. `--confirm-import`, upload/delete та реальні записи не запускалися;
`.env`, схеми й сам код інструмента міграції не змінено. На момент завершення цього
виправлення перенесення залишалося наступним окремо дозволеним кроком.

#### Фактичне перенесення після виправлення HTTP-нормалізації

За повторним явним дозволом виконано команду `migrate-product-photo.mjs --confirm-import`
з усіма наведеними Node.js-прапорцями. Перед запуском пряме читання підтвердило
`db-babyhub-test`, точний draft-товар, `images: []`, 0 Media, відсутність lock/журналу
та підтверджену відсутність цільового ресурсу в Cloudinary (404).

- Перший запуск: **uploads: 1, createdMedia: 1, productModified: 1**.
- `public_id`: `baby-service-test/legacy-photo-2f19079efd10749817072a2d105d81c4cbdad38946fb28ef70532ac16fdadd5a`.
- Cloudinary URL: `https://res.cloudinary.com/dmvl4lxnq/image/upload/v1794314014/baby-service-test/legacy-photo-2f19079efd10749817072a2d105d81c4cbdad38946fb28ef70532ac16fdadd5a.jpg`.
- Media `_id`: `2f19079efd10749817072a2d`; `storageType: cloudinary`, `mimeType: image/jpeg`,
  9079 байтів, 249×270. Документ прочитано безпосередньо через MongoDB driver і перевірено
  актуальною Mongoose-моделлю; HTTPS URL і метадані збігаються з Cloudinary resource lookup.
- Product `1e9f418c65cc80c3d3a56184`: `images: [ObjectId('2f19079efd10749817072a2d')]`,
  рівно одне входження. Статус залишається `draft`; SHA-256 решти полів Product до/після збігається.
- Після успішної перевірки першого результату виконано ту саму команду повторно:
  **uploads: 0, createdMedia: 0, productModified: 0**. Пряме читання підтвердило рівно одну
  Media, один збіг за ідентифікаторами/source URL, незмінний вміст Media та те саме посилання.
- Category `1b04529bcd47ae89a17fdad1` не змінилася: SHA-256 повного документа до імпорту,
  після першого і повторного запусків збігається.
- Lock `content_migration_locks._id: baby-service-photo-v1` збережений, `owner: null` після
  обох запусків. Локальний `output/product-photo-journal-v1.json` має фазу `committed`.
  Усі з'єднання закриті, ресурсів не видаляли.
- Cloudinary URL перевірено HTTPS GET після обох запусків: **HTTP 200**, `image/jpeg`,
  9079 байтів, JPEG 249×270. SHA-256 отриманих байтів
  `916854470160e1ae0a0f1a8d70546538ac602ec10339452c946ffd5a5b0c9425` збігається з початковим фото й журналом.

Помилок або конфліктів немає. Записи виконані виключно в тестовій БД та в дозволеному
Cloudinary namespace; `.env`, схеми, production-база й статуси не змінювалися. Перевірка
відображення на сайті та публікація не виконувалися. Журнал потрібно зберегти для відновлення.

## Локальний перегляд перенесеного товару (3.8.16)

Реалізовано окремий маршрут `/dev/preview/avtokreslo-adbor-capri`. Він читає лише
Product `1e9f418c65cc80c3d3a56184` зі slug `avtokreslo-adbor-capri` та статусом `draft`,
перевіряє пов'язану draft-категорію та наявність Media `2f19079efd10749817072a2d`
у `Product.images`. URL, розміри й alt беруться з реального документа Media; фото
рендериться через `next/image`. Cloudinary SDK та міграційний інструмент не викликаються.

Сервіс `src/services/local-product-preview.service.ts` використовує ізольоване Mongoose
підключення тільки з `DB_HOST_TEST`, примусово задає `dbName: db-babyhub-test` та перевіряє
`connection.db.databaseName` перед будь-яким читанням. URI може не містити назви бази;
якщо назва вказана, дозволена лише `db-babyhub-test`. Відсутній/некоректний URI блокує
перегляд без fallback на `DB_HOST`. Нативні `findOne` не ініціалізують моделі, колекції
чи індекси; підключення закривається у `finally`.

Запуск із кореня проєкту у Windows PowerShell (наявний `DB_HOST_TEST` завантажується з
`.env` самим Next.js; файл не змінюється):

```powershell
Set-Location E:\Projects\babyhub-02-frontend
$env:DB_HOST = 'mongodb://127.0.0.1:1/disabled-for-local-preview'
node --use-system-ca node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
```

Відкрити: <http://127.0.0.1:3000/dev/preview/avtokreslo-adbor-capri>.
Підміна `DB_HOST` діє тільки в поточному PowerShell та його дочірніх процесах:
це блокує випадкове звернення інших сторінок до основної БД. Публічні DB-маршрути
в цьому запуску не працюватимуть. Для звичайного запуску використати новий термінал.
`--use-system-ca` зберігає TLS-перевірку; dev-сервер слухає тільки loopback.

Маршрут і сервіс окремо перевіряють `NODE_ENV === 'development'`. У production маршрут
повертає 404 до імпорту сервісу/підключення. Сторінка динамічна та має `noindex, nofollow`.
Публічні `getPublishedProducts` і `getProductBySlug` не змінено: draft-товари та товари
draft-категорій залишаються прихованими. Загального адміністративного preview у `src`
не знайдено. Публічний сервіс досі серіалізує `images` як ID, а публічні сторінки товару
не рендерять фото: їх розширення лишається окремим завданням.

У `next.config.mjs` дозволено лише HTTPS Cloudinary image/upload для акаунта `dmvl4lxnq`.
Схеми, `.env`, статуси й документи MongoDB не змінювалися; міграцію не повторювали.

Перевірки 3.8.16:

- `node --use-system-ca --conditions=react-server --experimental-strip-types --test src/services/local-product-preview.test.mjs`:
  6/6 тестів без мережі/записів; production/test, некоректний URI й URI основної бази,
  фактична назва бази до читання, точні фільтри та зв'язок Product → Media, закриття підключення.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false` — успішно.
- `node node_modules/next/dist/bin/next lint` — успішно, 4 попередження в незмінених legacy-файлах.
- Production build із недоступним локальним `DB_HOST` — успішно. Запущений production-сервер
  повернув **404** для preview навіть із навмисно некоректним `DB_HOST_TEST`; фото/товар відсутні.
- Development: сторінка **HTTP 200**, оптимізоване фото `/_next/image` — **HTTP 200**, `image/jpeg`.
- **Фактична візуальна перевірка виконана:** відкрито маршрут у headless Chromium, отримано
  й переглянуто скриншот; видно назву, опис і фотографію автокрісла. Це окрема перевірка,
  незалежна від typecheck/build. Для Chromium в цьому середовищі знадобився `--no-sandbox`.

## Дозволені URL

- https://lutsk.babyservice.ua/avtokrisla.html
- https://lutsk.babyservice.ua/ru/avtokrisla.html
- https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html
- https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html
