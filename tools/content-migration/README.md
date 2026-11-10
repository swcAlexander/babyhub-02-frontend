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
node --experimental-strip-types tools/content-migration/prepare-import.mjs
node --experimental-strip-types --test tools/content-migration/prepare-import.test.mjs
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
Перший запис потребує окремого дозволу на MongoDB writes, `MONGODB_URI` у середовищі процесу
та MongoDB із підтримкою транзакцій; у цьому етапі підключення й запис не перевірялися.

Локальні перевірки етапу 3.8.10: 26/26 тестів пройдено (7 підготовки payload і 19 manifest validation);
dry-run: 1 Category, 1 Product, `validation.status: "valid"`, 0 помилок.

Прапорець майбутнього контрольованого запису:

```bash
node --experimental-strip-types tools/content-migration/prepare-import.mjs tools/content-migration/output/candidate-manifest.json tools/content-migration/output/import-dry-run-v1.json --confirm-import
```

Прапорець вимагає `MONGODB_URI`, а Category/Product записуються в одній транзакції.
Не запускай його в межах етапу підготовки без окремого дозволу.

## Дозволені URL

- https://lutsk.babyservice.ua/avtokrisla.html
- https://lutsk.babyservice.ua/ru/avtokrisla.html
- https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html
- https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html
