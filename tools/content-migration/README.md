# Контрольований dry-run міграції контенту

Цей каталог містить ізольований інструмент для обмеженого HTML extraction з публічного legacy сайту.

## Обмеження
- Не підключається до MongoDB.
- Не виконує import / seed / migration.
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

## Дозволені URL

- https://lutsk.babyservice.ua/avtokrisla.html
- https://lutsk.babyservice.ua/ru/avtokrisla.html
- https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html
- https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html
