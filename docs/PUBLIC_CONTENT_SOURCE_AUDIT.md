# PUBLIC_CONTENT_SOURCE_AUDIT.md

## 1. Executive Summary

### Підтверджено
- Доступний публічний старий сайт `https://lutsk.babyservice.ua/` і російська версія `https://lutsk.babyservice.ua/ru/` є єдиним доступним джерелом контенту за умовами цього етапу.
- Сайт побудований на старих HTML-сторінках, ешелоні статичних URL і серверному рендері. У структурі є чітко розмежовані головні сторінки, інформаційні сторінки, каталоги категорій і окремі сторінки товарів.
- Для одного категорійного розділу (`/avtokrisla.html`) підтверджено, що сторінка містить список товарів з окремими URL на товарні сторінки, наприклад `/avtokrisla/avtokreslo_adbor_capri.html`.
- Для окремого товару підтверджено наявність: назви, короткого/повного опису, фото, вартості оренди, авансового платежу, умов прокату, характеристик і кнопки замовлення.
- Для російської мови підтверджено паралельну структуру URL: наприклад `/ru/avtokrisla.html` і `/ru/avtokrisla/avtokreslo_adbor_capri.html`.
- Публічні статичні HTML-сторінки містять SEO `title` / `description` / `keywords`, але не містять `canonical`, `hreflang` або `application/ld+json` schema.
- Для `robots.txt` підтверджено, що вказаний sitemap: `http://lutsk.babyservice.ua/Sitemap.xml`, але фактичний `https://lutsk.babyservice.ua/sitemap.xml` повертає `404`. Тобто публічний XML sitemap не доступний для цього домену.

### Гіпотеза
- Для початкової міграції можна побудувати контрольований HTML-extractor, який збереже URL списку категорій і окремих товарів, їх опис, фото, prices і характеристики. 
- Проте значна частина повноцінного контенту в новій схемі (`legacyId`, `displayOrder`, `seo`, `importMeta`, `Media` mapping) не відновлюється з публічного HTML без ручної валідації.

### Недоступно
- Старий CMS, адмін-панель, база даних, API, резервні копії, legacy JSON export, media library і structured content source.
- Повна кількість усього каталогу, новин і статей без повного crawl по всіх URL.
- Надійна відповідність між uk/ru записами для всіх товарів без додаткової ручної перевірки.

### Рішення потрібне
- Погодити, що публічний сайт є source of truth лише для ідентифікації контенту, а не для повної автоматичної міграції без ручного review.

## 2. Перевірені URL і джерела

| Тип сторінки | URL | Результат |
|---|---|---|
| Головна сторінка | `https://lutsk.babyservice.ua/` | Підтверджено |
| Російська головна | `https://lutsk.babyservice.ua/ru/` | Підтверджено |
| Категорія | `https://lutsk.babyservice.ua/avtokrisla.html` | Підтверджено |
| Російська категорія | `https://lutsk.babyservice.ua/ru/avtokrisla.html` | Підтверджено |
| Товар | `https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html` | Підтверджено |
| Російський товар | `https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html` | Підтверджено |
| Про компанію | `https://lutsk.babyservice.ua/about.html` | Підтверджено |
| Умови прокату | `https://lutsk.babyservice.ua/usloviya_prokata.html` | Підтверджено частково через навігацію |
| Контакти | `https://lutsk.babyservice.ua/contacts.html` | Підтверджено через навігацію |
| robots.txt | `https://lutsk.babyservice.ua/robots.txt` | Підтверджено |
| sitemap.xml | `https://lutsk.babyservice.ua/sitemap.xml` | `404` |

### Підтвердження
- `robots.txt` містить: `Sitemap: http://lutsk.babyservice.ua/Sitemap.xml`.
- `https://lutsk.babyservice.ua/sitemap.xml` повертає помилку 404.
- HTML-сторінка категорії `avtokrisla.html` містить список товарів і посилання на товарні сторінки.
- HTML-сторінка товару містить `meta name="description"`, `form action="/zakaz.html"` і блок з `Умови прокату`.

## 3. Структура публічного сайту

### 3.1. Головна сторінка
На головній сторінці підтверджено:
- мова сторінки у HTML атрибутах (`lang="ua-ua"` / `lang="ru-ru"`)
- основні сайти/розділи
- статичні навігаційні посилання
- перелік категорій товарів
- банерні/інформаційні блоки
- контакти і телефони

### 3.2. Каталог і категорії
Каталог має класичну статичну структуру:
- `/avtokrisla.html`
- `/kolyaski.html`
- `/vagi_dityachi.html`
- інші категорії у списку лівого меню, наприклад `/krovatka.html`, `/medicinskoe_oborudovanie.html`, `/rozvivayuchi_igrashki.html` і т.ін.

Кожна категорія містить:
- title і description
- список продуктів/товарних URL
- посилання на окремі товарні сторінки
- у лівому меню — перелік усіх категорій

### 3.3. Товарні сторінки
Товарна сторінка має типову структуру:
- title
- meta description
- зображення товару
- блок “Умови прокату”
- детальний текст опису
- перелік характеристик у списку `<li>`
- форма замовлення `method="post"` до `/zakaz.html`

### 3.4. Інформаційні сторінки
- `/about.html` — опис компанії, послуг, якості, прокату
- `/contacts.html` — контакти і карта/навігація
- `/partners.html` — партнерська сторінка
- `/comments.html` — відгуки
- `/staty.html` — статті
- `/novosti.html` — новини
- `/usloviya_prokata.html` — умови прокату

### 3.5. Локалізація
Підтверджено, що російськомовна версія в основному має ту саму структуру:
- `/ru/` для головної
- `/ru/avtokrisla.html` для категорії
- `/ru/avtokrisla/avtokreslo_adbor_capri.html` для товару
- `/ru/about.html`, `/ru/contacts.html` та ін.

Це узгоджується з правилом нового сайту: українська — в корені, російська — під `/ru`.

## 4. Оцінка кількості контенту

### Підтверджено
- У [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md) зафіксовано 31 унікальну внутрішню сторінку без зовнішніх посилань.
- З них: 1 головна, 1 російська головна, ~20+ категорій, 8–10 інформаційних сторінок, 1 сторінка новин і 1 новинна стаття.
- На прикладі `avtokrisla.html` підтверджено близько 20 товарів у одній категорії.

### Оцінка
- Категорій: приблизно 20+ (для конкретної локальної інстанції/сайту Луцьк)
- Товарів: кілька десятків до сотень загалом, але точну загальну кількість без повного crawl і без CMS export не можна підтвердити
- Інформаційних сторінок: 8–10
- Статей: більше однієї, список є на `/staty.html`
- Новин: більше однієї, список є на `/novosti.html`
- Локалізованих сторінок: є російські версії ключових розділів, але повна відповідність `uk/ru` по всіх товарах не доведена

### Рівень достовірності
- Для категорій та основних сторінок — висока
- Для загальної кількості товарів — середня / оцінкова
- Для абсолютної повноти каталогу — низька без повного crawl

## 5. Аналіз структурованих джерел

### 5.1. JSON-LD / embedded JSON
Підтверджено: у вибіркових HTML-сторінках не виявлено `application/ld+json`, `schema.org` або embedded JSON-контенту. Описи і метадані зберігаються через `meta` теги та plaintext HTML.

### 5.2. XML / sitemap
- `robots.txt` вказує на `Sitemap: http://lutsk.babyservice.ua/Sitemap.xml`
- `https://lutsk.babyservice.ua/sitemap.xml` повертає `404`
- Висновок: публічний sitemap не доступний; отже, немає структурованого machine-readable catalog для масштабного обсягу URL

### 5.3. API / AJAX / JSON endpoint
У вибіркових сторінках не виявлено публічних API endpoints, JSON payload або client-side fetch для даних каталогу. Структура інтерфейсу — серверний HTML + форми `POST` для замовлення. Наприклад, товарна сторінка містить:

`<form action="/zakaz.html" method="post">` 

Це не API, а форма замовлення.

### 5.4. Можливість використання для міграції
- Для формування manifest / dry-run: так, частково
- Для повної автоматичної міграції: обмежено
- Для точного catalog import: недостатньо без ручної валідації або доступу до legacy backend

## 6. Аналіз HTML та доступності полів

### Поля, які реально видимі на публічних сторінках

| Поле | Статус | Коментар |
|---|---|---|
| title | available | `title` в `<head>` і текст H1/H2 у сторінці |
| description / intro | available | `meta name="description"` і текст в HTML |
| shortDescription | partial | присутній як короткий текст опису товару, але не у структурованому полі |
| fullDescription | available | у розділі опису сторінки товару, як post-content |
| price / rental cost | available | в товарній сторінці вказані авансовий платіж, доба/тиждень/місяць і тарифи |
| units / rental periods | available | підтверджено у `Умови прокату` |
| availability | partial | часто не відображено як єдиний enum, а лише в текстовому стилі / доступність може бути неявною |
| attributes / specs | available | в товарній сторінці є список `<li>` з характеристиками |
| category | available | у URL і лівому меню `Автокрісла` / `Ваги дитячі` |
| media / image URLs | available | є прямі `img src="/images/prods/..."` |
| thumbnail/fullsize | partial | для прикладу є одна основна картинка; альтернативні картинки не підтверджені |
| SEO title/meta | available | `meta name="title"`, `meta name="description"`, `meta name="keywords"` |
| canonical | missing | відсутній у вибіркових сторінках |
| hreflang | missing | не знайдено |
| structured data | missing | не знайдено |

### 6.1. Приклад товару
На сторінці `https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html` підтверджено:
- назва: `Автокрісло Adbor Capri (0-10кг)`
- зображення: `/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg`
- ціна/оренда: `авансовий платіж 600 грн`, `100 грн/доба`, `200 грн/тиждень`, `450 грн/місяць`
- опис: довгий текст і список характеристик
- характеристики: список `<li>` з параметрами типу `Відповідає європейським стандартам ECE R44 / 04`, `вага: 3 кг`, `виробник: Польща`

Це напряму корелює з моделлю Product у [src/models/Product.ts](../src/models/Product.ts): `name`, `slug`, `description`, `shortDescription`, `pricing`, `availability`, `attributes`, `images`, `seo`.

## 7. Аналіз локалізації

### Підтверджено
- Українська мова зазвичай в корені: `/avtokrisla.html`
- Російська в `/ru/`: `/ru/avtokrisla.html`
- Товарні сторінки мають паралельні структури: `/avtokrisla/xxx.html` і `/ru/avtokrisla/xxx.html`
- HTML-теги містять `lang="ua-ua"` або `lang="ru-ru"`
- Лінки між мовами є: `<a href="/ru/avtokrisla.html">рус</a>` і `<a href="/avtokrisla/avtokreslo_adbor_capri.html">укр</a>`

### Ризики
- Не всі товари/сторінки мають очевидну 1:1 відповідність лише за URL-іменами.
- Не можна автоматично вважати схожі назви або однакові slug-структури дійсною відповідністю без ручної перевірки.
- Для нової архітектури `slug.uk` є обов’язковим, а `slug.ru` — необов’язковий, але strict lookup дозволяє fallback only by explicit code path; без перевірки повних uk/ru пар неможливо гарантувати ідентичність записів.

### Підтвердження
- Це випливає з фактичних URL та `lang`-атрибутів у сторінках.
- Паралельні маршрути у [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md) і [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md).

## 8. Аналіз категорій і товарів

### 8.1. Категорії
Категорії чітко видимі у лівому меню сторінки `avtokrisla.html`:
- ВАГИ ДИТЯЧІ
- АВТОКРІСЛА
- КОЛЯСКИ
- ЛІЖЕЧКА
- МОЛОКОВІДСМОКТУВАЧІ
- ЗАКОЛИСУЮЧІ ЦЕНТРИ ДЛЯ МАЛЮКІВ
- ЕРГО РЮКЗАК
- ХОДУНКИ, ШТОВХАЧІ
- ЛІЖЕЧКА-МАНЕЖІ
- МЕДИЧНЕ ОБЛАДНАННЯ
- РАДІОНЯНЯ/ВІДЕОНЯНЯ
- СТІЛЬЧИКИ ДЛЯ ГОДУВАННЯ
- РОЗВИВАЮЧІ КИЛИМКИ
- ВУЛИЧНІ РОЗВАГИ
- ВЕЛОСИПЕДИ, БІГОВЕЛИ, САМОКАТИ
- ТУРИСТИЧНЕ СПОРЯДЖЕННЯ
- ПЕЛЕНАЛЬНИЙ СТОЛИК
- СТРИБУНЦІ
- КАРНАВАЛЬНІ НОВОРІЧНІ КОСТЮМИ
- РОЗВИВАЮЧІ ІГРАШКИ
- МЕБЛІ ДЛЯ ІВЕНТУ

Це співпадає з переліком у [docs/CONTENT_MODEL_MAPPING.md](./CONTENT_MODEL_MAPPING.md).

### 8.2. Товари
У категорії `avtokrisla.html` список товарів включає посилання на окремі товари:
- `Автокрісло Adbor Capri (0-10кг)`
- `Автокрісло Chicco Synthesis XT Plus 0-13 кг`
- `Автокрісло -коляска Doona Infant`
- `Автокрісло 4Baby Colby (0-13кг)`
- `Автокрісло Caretero Fly (0-13 кг)`
- ... і ще близько 20 позицій у списку

Висновок:
- URL формують структуру `category -> product`
- Category–Product зв’язок відновлювати можна за URL та навігаційне дерево
- Актуальність і унікальність продуктових URL на сторінці достатні для початкового `manifest`

## 9. Аналіз медіафайлів

### Підтверджено
- На товарній сторінці є основне фото: `/images/prods/43_2_avtokreslo-adbor_baby_service__lutsk.jpg`
- У головному шаблоні є логотип: `/themes/imgs/logo.png`
- У головній сторінці / описах є іконки та грофічні елементи

### Обмеження
- Не підтверджено, чи всі зображення доступні без помилок; відсутня централізована media library
- Не підтверджено, чи є кілька фото для кожного товару; на прикладі лише одне основне зображення
- Не відомий порядок галереї, alt-text, width/height, duplicate checks, або належний `Media` mapping без додаткового crawl

### Як це зіставляється з моделлю Media
Модель `Media` у [src/models/Media.ts](../src/models/Media.ts) вимагає:
- `filename`
- `url`
- `mimeType`
- `width`
- `height`
- `alt` 
- `storageType` 
- `importMeta`

Публічний сайт дозволяє відновити лише базову частину: `url`, `filename` (із URL), і початковий alt або title. Решта полів потребує ручного або додаткового дослідження.

## 10. Аналіз URL і redirect-стратегії

### Підтверджено
- Старі URL мають чітку структуру `*.html` зі статичними маршрутами
- Нові вже описані в [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md)
- Паралельні uk/ru URL виявлені

### Висновки
- `Category` можна відновити за URL розділу
- `Product` можна відновити за URL товарної сторінки
- Можна скласти базовий `legacy URL -> normalized slug -> new route` manifest
- Але без уникнення помилок (`/ru/...` vs `/...`) і без перевірки дублікатів не можна автоматично гарантувати правильну redirect-map

### Важливе обмеження
- `canonical` і `hreflang` на старому сайті не виявлені; отже, вони не можуть бути автоматично “екстраговані” з публічного HTML.

## 11. Обмеження публічного джерела

### Підтверджено
- Немає доступу до admin panel / backend / database.
- Немає XML sitemap або stable machine-readable catalog.
- Не всі поля є структурованими і не всі дані виведені у розмітку.
- Деякі дані, наприклад `availability`, `seo`, `featured`, `legacyId`, `displayOrder`, `media order` і `importMeta`, мають бути додані окремо.

### Наслідок
- Для багатьох сутностей публічний сайт є достатнім для `accept` або `review`, але не для `reject` без ручної перевірки.

## 12. Ризики екстракції

### Критичні ризики
1. Втрата цінності в `pricing`: сторінка показує орендні тарифи, але не гарантує, що вони відповідають новому структурованому формату `pricing.salePrice + pricing.rentalRates` у [src/models/Product.ts](../src/models/Product.ts).
2. Відсутність однозначної 1:1 `uk/ru` відповідності без ручного review.
3. Відсутність `canonical`/`hreflang` і наявність лише різних словникових URL не гарантує правильну SEO mapping.
4. Відсутність sitemap або JSON API робить повний crawl складним і менш надійним.
5. Зображення і медіа можуть бути неповними або не відображатися без авторизації.

### Рекомендовані класи для майбутнього dry-run
- `accept`: URL, text, images, categories, product pages with clear structure
- `review`: language pairing, ambiguous entries, price interpretation, partial descriptions
- `reject`: unavailable or unverified data (missing source, duplicate slugs, inaccessible media)

## 13. Рекомендована стратегія майбутнього manifest і dry-run

### Підтверджено
Публічний сайт достатній для формування стартового manifest, якщо використовувати мінімальний підхід:
1. Збір базових URL для головних сторінок, категорій і продуктів.
2. Валідація title + meta description + URL-структури.
3. Виділення продуктів і категорій з HTML.
4. Витяг `img src`, `text`, `prices` і `specs` для типових сторінок.
5. Класифікація записів: `accept`, `review`, `reject`.
6. Складення звіту про конфлікти до фактичного імпорту.

### Не рекомендується
- Автоматично перетворювати всі сторінки в мапу без ручної перевірки.
- Інтерпретувати старі ціни як `salePrice` без перевірки даних.
- Брати будь-яку схожість URL за доказ відповідності мовних записів.
- Підміняти відсутні структуровані джерела дійсними базовими моделями без review.

## 14. Відкриті питання

1. Чи повинні всі ключові категорії і товари мати окремі `uk` і `ru` записи в новій схемі?
2. Чи достатньо для міграції публічних HTML та URL, чи потрібен додатковий доступ до legacy export/DB?
3. Чи потрібен строгий `manual review` для всіх цін, які в старій схемі описані як “оренда/аванс/добова вартість” без єдиного `salePrice`?
4. Чи є за межами репозиторію доступний legacy API або export-файл, який може закрити інформаційні прогалини?
5. Чи потрібна окрема логіка для `Media` і `legacyUrl` для кожного товару і категорії?

## 15. Рекомендації для етапу 3.8.3

### Мінімальний наступний крок
- Побудувати `manifest` на основі публічного сайту для:
  - категорій
  - товарів
  - URL
  - meta title/description
  - image URL
  - prices/rental blocks
  - specs
- На етапі 3.8.3 лише підготувати dry-run dataset і список `review` записів без запису в MongoDB.

### Що повинен вміти майбутній extractor
- збирати список категорій і URL
- збирати список товарів для кожної категорії
- формувати `legacyUrl` + `source` + `categoryName` + `productName`
- зберігати `accept/review` статус
- зберігати окремий список unresolved fields

## 16. Final Assessment

### Підтверджено
- Публічний сайт надає достатньо даних для проектування початкового `manifest` і базового dry-run.
- Структура категорій, товарів, інформаційних сторінок і локалізації підтверджена.
- HTML містить достатню частину контенту для `Category` і `Product` entity extraction.

### Обмеження
- Публічний сайт не є повною source of truth для повної і безпечної міграції: бракує API, XML sitemap, schema.org, legacy DB, canonical/hreflang, повної media library і повних `uk/ru` відповідностей.
- Для окремих полів `pricing`, `availability`, `attributes`, `images`, `seo` і `legacy metadata` потрібен ручний review.

### Фінальний висновок
- Для початкової міграції HTML-публічний сайт використовувати можна, але як `source для extract + review`, а не як `source для повного автоматичного import`.
- Повний перенос контенту без доступу до реального legacy backend або export-даних не гарантує повну відповідність новій MongoDB архітектурі.
- Тому наступний крок має бути `dry-run manifest + review queue`, а не прямий імпорт.

## 17. Підтвердження джерел доказів

- `robots.txt`: `https://lutsk.babyservice.ua/robots.txt`
- Категорія: `https://lutsk.babyservice.ua/avtokrisla.html`
- Товар: `https://lutsk.babyservice.ua/avtokrisla/avtokreslo_adbor_capri.html`
- Російська версія: `https://lutsk.babyservice.ua/ru/avtokrisla/avtokreslo_adbor_capri.html`
- Модель Product: [src/models/Product.ts](../src/models/Product.ts)
- Модель Media: [src/models/Media.ts](../src/models/Media.ts)
- Документ architecture: [docs/PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)
- Документ URL redirect map: [docs/URL_REDIRECT_MAP.md](./URL_REDIRECT_MAP.md)
- Документ audit: [docs/CONTENT_AUDIT.md](./CONTENT_AUDIT.md)
