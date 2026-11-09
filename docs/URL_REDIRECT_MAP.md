# URL_REDIRECT_MAP.md

## 0. Поточний стан проєкту

У фактичному коді відсутній механізм redirect map, canonical, hreflang або SEO-обробки для legacy URL. Поточні сторінки в App Router зчитуються як звичайні маршрути без локалізації і без логіки редиректів.

Тому цей документ є планом перенесення і захисту SEO, а не вже реалізованою функціональністю. Всі legacy URL нижче слід розглядати як політику міграції, яку потрібно окремо згенерувати та підключити в Next.js.

## 1. Мета документа

Цей документ містить модель відповідності між історичними URL старого сайту та запропонованою новою структурою URL у Next.js App Router. Не всі старі URL є прямими чином перенесеними; частина з них повинна бути зафіксована через redirect rules для SEO та збереження посилань.

## 2. Рекомендована схема нових URL

### 2.1. Основні правила

- Українська мова: без префікса, наприклад `/`, `/about`, `/contacts`, `/catalog`
- Російська мова: `/ru`, `/ru/about`, `/ru/contacts`, `/ru/catalog`
- Категорії: `/catalog/[categorySlug]` і `/ru/catalog/[categorySlug]`
- Товари: `/catalog/[categorySlug]/[productSlug]` і `/ru/catalog/[categorySlug]/[productSlug]`
- Новини: `/news/[slug]` і `/ru/news/[slug]`
- Статті: `/articles/[slug]` і `/ru/articles/[slug]`
- Інформаційні сторінки: `/about`, `/terms`, `/partners`, `/contacts` і російські аналоги через `/ru/...`
- Не передбачати окремий `/uk` префікс.

### 2.2. Політика редиректів

- У продакшені всі виявлені legacy URL мають бути переведені в 301/308 redirect на їхні нові відповіді.
- Не робити redirect всіх невідомих URL на головну сторінку.
- Для URL, які не підтверджені аудитом, створити окремий список на перевірку й позначити як `needs-verification`.
- Уникати ланцюжків редіректів і циклів; кожен legacy URL має вказувати на фінальну сторінку без проміжних перенаправлень.

## 3. Карта старих та нових URL

У цьому розділі наведено лише підтверджені legacy адреси, які були виявлені під час аудиту. Для незавершених або сумнівних шляхів у продакшені слід створити окремий список перевірки, але не вигадувати адреси, яких фактично не було на сайті.

| Старий URL | Тип старої сторінки | Попередній новий URL | Конфігурація redirect |
|---|---|---|---|
| / | Головна сторінка | / | 301/308, якщо потрібно зберегти основну адреси |
| /ru/ | Російськомовна версія | /ru | 301 redirect |
| /about.html | Про компанію | /about | 301 redirect |
| /contacts.html | Контакти | /contacts | 301 redirect |
| /usloviya_prokata.html | Умови прокату | /terms | 301 redirect |
| /partners.html | Партнери | /partners | 301 redirect |
| /comments.html | Відгуки | /reviews | 301 redirect |
| /staty.html | Список статей | /articles | 301 redirect |
| /novosti.html | Список новин | /news | 301 redirect |
| /novosti/uvaga_baby_service_zakrito_na_karantin_z_17_03_2020_po_03_04_2020.html | Новинна стаття | /news/uvaga-baby-service-zakrito-na-karantin | 301 redirect |
| /vagi_dityachi.html | Категорія | /catalog/vagi-dityachi | 301 redirect |
| /avtokrisla.html | Категорія | /catalog/avtokrisla | 301 redirect |
| /kolyaski.html | Категорія | /catalog/kolyaski | 301 redirect |
| /krovatka.html | Категорія | /catalog/krovatka | 301 redirect |
| /molokootsosy.html | Категорія | /catalog/molokootsosy | 301 redirect |
| /ukachivayuschie_centry_dlya_novorozhdennyh.html | Категорія | /catalog/ukachivayuschie-centry | 301 redirect |
| /ergoryukzaki.html | Категорія | /catalog/ergoryukzaki | 301 redirect |
| /hoduni_shtovhanci.html | Категорія | /catalog/hoduni-shtovhanci | 301 redirect |
| /lizhechka_manezhi.html | Категорія | /catalog/lizhechka-manezhi | 301 redirect |
| /medicinskoe_oborudovanie.html | Категорія | /catalog/medichne-obladnannya | 301 redirect |
| /radionyanya.html | Категорія | /catalog/radionyanya | 301 redirect |
| /stilchiki_dlya_goduvannya.html | Категорія | /catalog/stilchiki-dlya-goduvannya | 301 redirect |
| /rozvivayuchi_kilimki.html | Категорія | /catalog/rozvivayuchi-kilimki | 301 redirect |
| /vulichni_rozvagi.html | Категорія | /catalog/vulichni-rozvagi | 301 redirect |
| /velosipedy_begovely_samokaty.html | Категорія | /catalog/velosipedy-begovely-samokaty | 301 redirect |
| /turistichne_sporyadzhennya.html | Категорія | /catalog/turystychne-sporyadzhennya | 301 redirect |
| /pelenalniy_stolik.html | Категорія | /catalog/pelenalniy-stolik | 301 redirect |
| /stribunci.html | Категорія | /catalog/stribunci | 301 redirect |
| /karnavalni_novorichni_kostyumi.html | Категорія | /catalog/karnavalni-kostyumi | 301 redirect |
| /rozvivayuchi_igrashki.html | Категорія | /catalog/rozvivayuchi-igrashki | 301 redirect |
| /mebli_dlya_iventu.html | Категорія | /catalog/mebli-dlya-iventu | 301 redirect |

## 4. Логіка для української та російської мови

### 4.1. Українська
- новий основний URL: `/catalog/...`, `/about`, `/contacts`, `/news/...`, `/articles/...`
- старі `.html` URL повинні редиректитися на нові формати

### 4.2. Російська
- новий URL: `/ru/catalog/...`, `/ru/about`, `/ru/contacts`, `/ru/news/...`, `/ru/articles/...`
- додатково можна зберігати `legacy` редиректи для `/ru/...` і старих `*` сторінок

## 5. Робота з SEO

Рекомендація:
- зберігати старі URL у `redirects` не менше 6–12 місяців
- для новим URL задавати canonical відповідно до поточної мови
- мапи redirect мають бути згенеровані на основі `slug` і не потребувати ручного контролю користувача

## 6. Принципи URL-strategy

- Більшість змістовних сторінок мають отримати чисті slug без `.html`
- Для старих URL не проводити автоматичне видалення без redirect map
- Для товарів та категорій використовувати чіткі `slug`, які зберігають семантику і не містять застарілих символів
- Приклад обробки старого URL:
  - `/avtokrisla.html` -> `/catalog/avtokrisla`
  - `/ru/avtokrisla.html` -> `/ru/catalog/avtokrisla`

## 7. Важливий висновок

Старі URL не варто просто видаляти: вони є частиною історичної структури сайту і можуть бути важливими для SEO. Найкраща стратегия — зберегти карту відповідності і виконувати 301/308 redirect на нові сторінки в залежності від мови і типу контенту.
