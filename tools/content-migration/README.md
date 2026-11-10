# Контрольований dry-run міграції контенту

Цей каталог містить ізольований інструмент для обмеженого HTML extraction з публічного legacy сайту.

## Обмеження
- `run-dry-run.mjs` і `validate-manifest.mjs` не підключаються до MongoDB.
- `prepare-import.mjs` за замовчуванням лише формує payload і виконує локальну Mongoose-валідацію; MongoDB не підключає.
- Жоден імпорт не запускається без явного `--confirm-import`. Навіть із прапорцем інструмент спершу вимагає успішної валідації всіх payloads; запис виконується транзакцією.
- Не розширює список URL автоматично.
- Не завантажує зображення.
- Не змінює production code.

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

Майбутній запис, лише після окремого дозволу; у поточному етапі **не запускався**:

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

## Дозволені URL

- https://lutsk.babyservice.ua/avtokrisla.html
- https://lutsk.babyservice.ua/ru/avtokrisla.html
- https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html
- https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html
