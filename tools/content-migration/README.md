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

## Дозволені URL

- https://lutsk.babyservice.ua/avtokrisla.html
- https://lutsk.babyservice.ua/ru/avtokrisla.html
- https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html
- https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html
