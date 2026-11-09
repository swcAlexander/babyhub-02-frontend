# CONTENT_MIGRATION_AUDIT.md

## 1. Executive Summary

### Підтверджено
- Цільова архітектура вже описана в документах: [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md), [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [docs/CONTENT_MODEL_MAPPING.md](./CONTENT_MODEL_MAPPING.md) і [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md).
- У проекті вже є доменні Mongoose-моделі для Category, Product, Page, Article, News, Review, Media, SiteSettings і User в директорії [src/models](../src/models), а також серверні сервіси для читання в [src/services/product.service.ts](../src/services/product.service.ts) і [src/services/category.service.ts](../src/services/category.service.ts).
- Модель Product і Category явно вимагають локалізовані поля та strict slug-валидацію: [src/models/Product.ts](../src/models/Product.ts), [src/models/Category.ts](../src/models/Category.ts), [src/models/common.ts](../src/models/common.ts).
- Публічний старий сайт доступний і містить реальні URL з каталогом, новинами, статтями, інформаційними сторінками і російською версією: https://lutsk.babyservice.ua/ та https://lutsk.babyservice.ua/ru/.
- У репозиторії немає повного набору реальних даних для імпорту: локальні JSON/CSV/SQL/seed-файли не були знайдені, а legacy API-моделі в [src/app/api/models](../src/app/api/models) описують лише демонстраційну/загальну схему, а не контент Baby Service.

### Гіпотеза
- Найбільш правдоподібне основне джерело для майбутнього імпорту — це публічний legacy сайт + опціональний legacy DB export, якщо він існує поза репозиторієм або під доступом оператора проєкту.
- Для повного каталогу та медіафайлів критично потрібні дані, яких публічні HTML-сторінки не дають безпечно або повністю: точні ціни, статуси, повні описи, легенди для зображень, legacy IDs, порядок галереї, ідентифікатори продуктів у legacy CMS.

### Недоступно
- Доступ до реальної MongoDB або legacy production БД не перевірявся, жодних підключень до MongoDB не здійснювалося.
- Жодний legacy dump/CSV/SQL snapshot у репозиторії не підтверджений.
- Не підтверджено, чи існує окреме джерело за межами репозиторію (CMS export, API, staging DB, або архівні JSON). 

### Рішення потрібне
- Власник проєкту має підтвердити, чи є основним джерелом реальний legacy backend / export або тільки публічний сайт.
- Потрібно погодити політику для записів без російського slug або без українського slug.
- Потрібна згода на формат збереження legacy ID і legacy URL для кожного продукту, категорії, сторінки та медіафайлу.

## 2. Перевірені джерела даних

| Джерело | Тип | Куди дивитися | Статус | Результат |
|---|---|---|---|---|
| Legacy public site | HTML pages | https://lutsk.babyservice.ua/ | Підтверджено | Доступний; містить головну сторінку, каталоги, новини, статті, контакти, інформаційні сторінки |
| Документація проєкту | Markdown docs | [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md), [docs/SITE_STRUCTURE.md](./SITE_STRUCTURE.md), [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md) | Підтверджено | Дасть структуру контенту, URL і цільові правила |
| Нові Mongoose моделі | Domain schema | [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts), [src/models/Page.ts](../src/models/Page.ts), [src/models/Article.ts](../src/models/Article.ts), [src/models/News.ts](../src/models/News.ts), [src/models/Review.ts](../src/models/Review.ts), [src/models/Media.ts](../src/models/Media.ts), [src/models/SiteSettings.ts](../src/models/SiteSettings.ts), [src/models/User.ts](../src/models/User.ts) | Підтверджено | Визначають цільовий формат даних, але не містять реальних записів |
| Нові services | Read layer | [src/services/category.service.ts](../src/services/category.service.ts), [src/services/product.service.ts](../src/services/product.service.ts) | Підтверджено | Показують фактичний контракт читання і правила фільтрації |
| Legacy API models | Old Mongoose schema stub | [src/app/api/models/item.ts](../src/app/api/models/item.ts), [src/app/api/models/users.js](../src/app/api/models/users.js), [src/app/api/models/articles.js](../src/app/api/models/articles.js) | Підтверджено | Олд-дані не підтверджені; це загальні demo-схеми, а не справжній каталог |
| Real MongoDB | Production DB | Через `DB_HOST` / `.env` | Недоступно | Не перевірявся; доступ не надано, жодних записів не проводилося |
| Local JSON/CSV/seed files | Data snapshots | repo root / scripts / data folders | Недоступно | Не виявлено у репозиторії |

### Підтвердження
- Для legacy site: [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md) і прямий доступ до https://lutsk.babyservice.ua/.
- Для доменної моделі: [src/models/Product.ts](../src/models/Product.ts), [src/models/Category.ts](../src/models/Category.ts), [src/models/common.ts](../src/models/common.ts).
- Для відсутності реальних даних: [src/app/api/models/item.ts](../src/app/api/models/item.ts) та відсутність відповідних dump/seed файлів у репозиторії.

## 3. Непідтверджені або недоступні джерела

### Підтверджено як недоступні
- Жодне реальне MongoDB підключення до production або staging DB не перевірене.
- Жодні legacy dumps, SQL backups або CSV exports не виявлені в проекті.
- Не виявлено доступного CMS export або API з публічним доступом без авторизації.

### Гіпотеза
- Можливо, існує legacy CMS або приватний API поза репозиторієм, але без доступу та підтвердження вони не можуть бути рекомендовані як основне джерело імпорту.

### Рішення потрібне
- Потрібно підтвердити, чи є доступ до legacy DB, export або CMS на стороні власника.
- Якщо такого доступу немає, основним джерелом стане публічний сайт разом з ручною атрибуцією для товарів/зображень/цін.

## 4. Аналіз публічного старого сайту

### 4.1. Основні сторінки, перевірені через живий сайт
- Головна: https://lutsk.babyservice.ua/
- Російська головна: https://lutsk.babyservice.ua/ru/
- Про компанію: https://lutsk.babyservice.ua/about.html
- Контакти: https://lutsk.babyservice.ua/contacts.html
- Партнери: https://lutsk.babyservice.ua/partners.html
- Відгуки: https://lutsk.babyservice.ua/comments.html
- Статті: https://lutsk.babyservice.ua/staty.html
- Новини: https://lutsk.babyservice.ua/novosti.html
- Умови прокату: https://lutsk.babyservice.ua/usloviya_prokata.html
- Категорії: https://lutsk.babyservice.ua/avtokrisla.html, https://lutsk.babyservice.ua/kolyaski.html, https://lutsk.babyservice.ua/vagi_dityachi.html тощо.

### 4.2. Що реально видно з публічної сторінки
- Ключові назви категорій і глибина каталогу.
- Основні статичні сторінки та їхній зміст.
- Частину текстового контенту “про компанію”, “умови прокату”, “контакти”, “новини”.
- Зразки продуктів/товарних блоків у категорійних сторінках.
- Наявність української та російської версій сайту.
- Основні URL і slug-структура legacy URL.

### 4.3. Що не можна достовірно отримати з HTML без додаткового джерела
- Точні ціни, які не завжди відображені в доступних HTML блоках або можуть змінюватися за датою.
- Повні характеристики товарів, якщо вони завантажуються динамічно або оформлені у складній структурі.
- Повний набір оригінальних медіафайлів і їхню коректну прив’язку до Product/Media.
- Legacy IDs і field-level data lineage for import traceability.
- Стовпці `status`, `featured`, `displayOrder`, `importMeta`, `seo` without authoring source.

### Підтвердження
- Список реальних сторінок і URL доступний у [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md) і [docs/SITE_STRUCTURE.md](./SITE_STRUCTURE.md).
- Карта legacy/url перенаправлень описана в [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md).
- Прямий вивід сайту підтверджує доступність сторінок: https://lutsk.babyservice.ua/ і https://lutsk.babyservice.ua/ru/.

## 5. Матриця зіставлення сутностей

| Сутність | Джерело | Поля джерела | Поля нової моделі | Проблеми |
|---|---|---|---|---|
| Category | legacy HTML + category URLs | title/category name, URL slug, list order | `name`, `slug`, `description`, `seo`, `image`, `status`, `displayOrder`, `parentCategory` | Legacy `slug` exact formats vary; category pages may have multiple variants, duplicates or empty translations |
| Product | category pages and item blocks in legacy HTML | title, short/long description, price, availability, category, images | `category`, `name`, `slug`, `description`, `shortDescription`, `pricing`, `availability`, `attributes`, `images`, `status` | Legacy `Item.price` is string in old model [src/app/api/models/item.ts](../src/app/api/models/item.ts), while new Product schema expects `pricing.salePrice` + `rentalRates` in [src/models/Product.ts](../src/models/Product.ts) |
| Page | /about.html, /contacts.html, /partners.html, /usloviya_prokata.html | static content, contact info, service text | `Page` model with `title`, `slug`, `content`, `seo`, `status` | Some content should be moved to `SiteSettings` rather than a generic page, depending on ownership and reuse |
| Article | /staty.html and article URLs | article list + article body | `Article` with localized fields, slug, body, status | Need source of article bodies and all published/unpublished states |
| News | /novosti.html + article pages | news list + article body | `News` with slug, title, content, dates, status | Need publication dates and exact prod content for each news item |
| Review | /comments.html | comments list, names, texts | `Review` model | May require author names, consent, and moderation rules |
| Media | image URLs in HTML or CMS | file URLs, alt text, image names | `Media` model with source metadata and references | Public HTML alone does not guarantee original file availability or ordering |
| SiteSettings | home page and contact data | phones, email, address, logo, social links | `SiteSettings` with localized fields | Must be separated from ordinary content pages to avoid duplication |
| User | generic auth and legacy app models | username, password, email, subscription | `User` domain model | User personal data should not be migrated without explicit business consent |

### Підтвердження
- `Category` и `Product` contract: [src/models/Category.ts](../src/models/Category.ts), [src/models/Product.ts](../src/models/Product.ts).
- `Item` legacy mismatch: [src/app/api/models/item.ts](../src/app/api/models/item.ts) shows `price: String`.
- Mapping target: [docs/CONTENT_MODEL_MAPPING.md](./CONTENT_MODEL_MAPPING.md).

## 6. Проблеми локалізації

### Підтверджено
- Основна мова — українська в корені, російська — в `/ru`: [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md), [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md).
- У новій моделі `LocalizedString` містить `uk` і `ru` поля, а `localizedStringSchema` в [src/models/common.ts](../src/models/common.ts) не дозволяє порожні рядки.
- Для `Category` і `Product` логіка в [src/models/Category.ts](../src/models/Category.ts) і [src/models/Product.ts](../src/models/Product.ts) вимагає: `slug.uk` обов’язковий, `slug.ru` — необов’язковий, але якщо задано — не може бути порожнім.
- В сервисах strict lookup для locale: [src/services/product.service.ts](../src/services/product.service.ts) використовує `slug.${locale}` і повертає `null`, якщо продукт або категорія не match по активній мові.

### Основні ризики
- Деякі legacy записи можуть мати лише російський або лише український варіант. Вони не відповідають поточній strict-логіці і потребують ручного погодження.
- Legacy slugs можуть містити символи підчеркування, кирилицю або інші старі формати, що не валідні з `normalizeSlugValue` у [src/models/common.ts](../src/models/common.ts).
- Unicode whitespace / пробіли в двох мовах можуть зламати валідацію або привести до пустих react-like значень.

### Рішення потрібне
- Для записів із відсутнім `slug.ru` або `slug.uk` необхідний механізм `needs-review` або відмітка `manual-approval` перед імпортом.
- Для слів/слів з Unicode whitespace або нерівномірною локалізацією потрібен окремий audit-випуск на етапі нормалізації.

## 7. Стратегія міграції медіафайлів

### Підтверджено
- `Product.images` — це масив `ObjectId` зі зв’язком `ref: 'Media'` у [src/models/Product.ts](../src/models/Product.ts).
- `Category.image` — `ObjectId` ref до `Media` у [src/models/Category.ts](../src/models/Category.ts).
- У legacy HTML/старому сайті зображення зазвичай подаються як прямі URL, а не як ObjectId. Тому без окремого Media mapping не можна просто зберегти їх як готові `Media`-документи.

### Рекомендована стратегія
1. Зібрати список усіх унікальних URL зображень з legacy HTML/HTML fragments.
2. Зберегти у проміжній таблиці `legacy_asset_url -> media_record_key`.
3. Кожне зображення привести до стандартної структури Media: source URL, checksum, width/height, mime type, alt text, legacy reference.
4. Зберегти порядок галереї через `displayOrder` або збереження масиву `images` в Product у впорядкованому форматі.
5. Розділити дублікати по `sha1` або `checksum` та уникати повторення один і той самий файл в різних товарах/категоріях.
6. Проверяти неактивні/пошкоджені URL до фактичного імпорту.

### Підтвердження
- `Product.images` і `Category.image` в [src/models/Product.ts](../src/models/Product.ts) і [src/models/Category.ts](../src/models/Category.ts).
- `Media` model: [src/models/Media.ts](../src/models/Media.ts).

## 8. Стратегія збереження URL

### Підтверджено
- Legacy URL map описаний у [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md).
- Нові маршрути додаються у цільову архітектуру: `/catalog/[categorySlug]`, `/catalog/[categorySlug]/[productSlug]`, `/ru/catalog/[categorySlug]`, `/ru/catalog/[categorySlug]/[productSlug]`.
- Основа для `301/308` redirect-політики вже визначена.

### Рекомендація
- Скомбінувати старі `.html` URL і `legacyUrl` metadata з новими slug. Не генерувати редиректи “на лету” без таблиці відповідностей.
- Уникати циклів і ланцюжків редиректів.
- Кожен старий URL повинен вказувати на фінальну активну адресу без проміжних переходів.

### Підтвердження
- [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md)
- [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)

## 9. Ризики та конфлікти схем

### Підтверджено
- Legacy `Item` model в [src/app/api/models/item.ts](../src/app/api/models/item.ts) має `price: String`, що не сумісне з новою структурою `pricing.salePrice` і `rentalRates` в [src/models/Product.ts](../src/models/Product.ts).
- Legacy `User` і `Article` використовують загальні колекції `users` і `articles` у коді; нові доменні моделі теж працюють із `User`/`Article`, що може створити конфлікти реєстрації моделей, якщо обидві частини активні одночасно.
- `connectToDatabase` у [src/lib/mongodb.ts](../src/lib/mongodb.ts) використовує кешований connection і `autoIndex: false`, `autoCreate: false`; це безпечно, але не означає, що існує наповнена база даних.

### Гіпотеза
- Можливі дублікати slug і дублікатні назви категорій у legacy-content через різні історичні варіації URL і форматів написання.

### Рішення потрібне
- Розробити `catalog-dedupe` і `slug-conflict` report перед стартом фактичного імпорту.
- Для `User` і `Article` окремо погодити, чи вони взагалі підлягають міграції в стандартний контентний імпорт.

## 10. Рекомендована послідовність міграції

1. Отримання даних із погодженого джерела.
2. Збереження незмінного знімка джерела (snapshot/export).
3. Нормалізація в проміжний формат (JSON/CSV/normalized objects).
4. Валідація обов’язкових полів.
5. Перевірка локалізації (`uk`/`ru`, slug, whitespace).
6. Зіставлення категорій, товарів, медіа і SEO даних.
7. Перевірка URL та legacy redirects.
8. Dry-run без запису в MongoDB.
9. Формування звіту про помилки, дублікати й конфлікти.
10. Ручне погодження вручну або через адмін-скрипт.
11. Контрольований імпорт на окремому етапі.
12. Перевірка результату, відновлення й rollback plan.

### Підтвердження
- Ця послідовність логічно випливає з цілей документації: [docs/CONTENT_MODEL_MAPPING.md](./CONTENT_MODEL_MAPPING.md), [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md).

## 11. Архітектура майбутнього dry-run

### Підтверджено
- В репозиторії ще немає спеціального `content import` pipeline або `scripts/import` набору.
- Нові моделі підтримують `legacyId`, `importMeta` і `status`, що робить dry-run/controlled import можливим: [src/models/Product.ts](../src/models/Product.ts), [src/models/Category.ts](../src/models/Category.ts), [src/models/common.ts](../src/models/common.ts).

### Рекомендований dry-run
- Деякий статичний JSON snapshot з legacy content стає вхідним payload.
- Кожен рядок проходить валідацію по новій схемі.
- Для кожного продукту/категорії/сторінки виводиться список “accept / needs-review / reject”.
- Результат зберігається в лог-файлі/CSV для ручної ретельної перевірки.
- Жодні записи в MongoDB не виконуються до завершення ручного погодження.

## 12. Умови готовності до фактичного імпорту

### Підтверджено
- Потрібні реальні дані не є частиною поточного репозиторію.
- Необхідно мати доступ до джерела зі значеннями `legacyId`, `slug`, `price`, `images`, `status` і `available content`.

### Умови готовності
- Підтверджено джерело даних (legacy site / legacy DB / CMS export).
- Прийнята політика локалізації та slug validation.
- Прийнята політика для системних/персональних даних (`User`, `Article`, `Review`, etc.).
- Зафіксовані правила для медіафайлів та URL redirects.
- Наявний dry-run report без помилок і конфліктів.

### Рішення потрібне
- Погодження власника для міграції `User` і персональних даних.
- Погодження для автоматичного перенесення pricing/rental rules.

## 13. Відкриті питання, що потребують рішення власника проєкту

1. Чи є доступ до legacy DB / CMS export, або ми обмежені тільки public HTML?
2. Чи потрібно переносити `User` і `Article`/`News` в стандартний контентний імпорт, чи вони повинні залишитися у ніші ручного управління?
3. Чи допустима strict locale-only policy (`uk` required, `ru` optional) для всіх нових даних без fallback?
4. Чи потрібні legacy IDs для всіх сутностей або достатньо `importMeta.legacyUrl` і `source`?
5. Чи потрібна ручна перевірка всіх цін і тарифів перед імпортом або продуктові ціни можна вважати достатньо структурованими з legacy HTML?
6. Чи є доступні оригінали стандартних медіафайлів для виготовлення `Media`-записів?
7. Яка остаточна політика по canonical/hreflang для `/ru` і `/` рішень?

### Підтвердження
- Ці питання випливають із суперечностей між [docs/DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md), [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) і фактичним кодом у [src/models/common.ts](../src/models/common.ts) та [src/services/product.service.ts](../src/services/product.service.ts).

## 14. Рекомендації для наступного етапу 3.8.2

### Мінімально рекомендований наступний крок
- Після погодження джерела даних і політики локалізації розробити `dry-run import manifest` для категорій, товарів, статей і медіафайлів.
- На наступному етапі не запускати імпорт у MongoDB, лише формувати manifest, report і список `needs-review`.

### Що має бути в 3.8.2
1. Список джерел і їхню надійність.
2. Чітку таблицю `legacy URL -> normalized slug -> new route`.
3. Список `duplicate slug` і `missing locale` записів.
4. Перелік медіа URL і відповідність Product → Media.
5. Чіткий план `accept / reject / manual-review` для кожної сутності.

## 15. Final Assessment

### Підтверджено
- Для проекту вже є цільова схема, правила локалізації та структура маршрутів.
- Основне джерело інформації доступне з public legacy sites, але воно не достатнє для повної, безпечної і автоматичної міграції без ручної валідації.
- A dry-run strategy is feasible and safe, but it must be built on a verified source-of-truth and a formal owner decision.

### Невирішене
- Немає повного відкритого джерела legacy data у репозиторії.
- Для повної міграції потрібні ще бізнес-рішення і підтвердження джерела даних.

### Фінальний висновок
- Основний рекомендований шлях: публічний legacy сайт як source of truth для початкового audit, але не як єдиний source for final import; потрібен додатковий реальний export / DB access або ручне підтвердження полів, за яких HTML недостатньо.
- До запуску фактичного імпорту необхідно завершити dry-run, validate localization, map URL + media + categories + products і зберегти всю історію `legacyId`/`legacyUrl` у новій схемі.

---

## Подтвердження про стан репозиторію
- У цьому етапі не змінювався код проєкту; не запускалися міграції, seed, MongoDB writes і не змінювалися `.env`/`.env.local`.
- Було створено тільки документ: [docs/CONTENT_MIGRATION_AUDIT.md](./CONTENT_MIGRATION_AUDIT.md).
- Підтвердження фактичного стану: [src/lib/mongodb.ts](../src/lib/mongodb.ts), [src/models/Product.ts](../src/models/Product.ts), [src/models/Category.ts](../src/models/Category.ts), [src/app/api/models/item.ts](../src/app/api/models/item.ts), [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md).
