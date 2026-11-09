# DATABASE_SCHEMA.md

## 0. Реальність поточного проєкту

Фактична реалізація в коді не відповідає запропонованій схемі. Наразі в проєкті є загальна підключена модель `Item` та кілька базових моделей `User` / `Article`, а не повноцінна схема для каталогу дитячих товарів, категорій, новин, статей, сторінок і медіа.

Основні відмінності:

- `Item.price` в коді є строковим полем, тоді як бізнес-модель передбачає різні типи цін (продаж/прокат)
- немає окремої колекції `Category` з локалізованим `slug` і `seo`
- немає `Product` як окремої доменної моделі
- немає окремої колекції `Page`, `News`, `Review`, `Media`, `SiteSettings` у структурі коду
- адмін-секція та ролі користувачів ще не виділені в явній архітектурі

Це означає, що структура бази даних має бути переглянута як цільовий дизайн, а не механічно копіюватися з поточного коду.

## 1. Задача архітектури MongoDB

Нова версія сайту Baby Service має будуватись як нормалізована система даних для каталогу дитячих товарів, інформаційних сторінок, новин, статей, відгуків, медіа та налаштувань. Не слід зливати все в одну колекцію; потрібно окремо зберігати каталоги, продукти, контент сторінок і служебні настройки.

## 2. Основні колекції

### 2.1. SiteSettings

Опис: глобальні налаштування сайту, адреса, телефони, e-mail, соціальні мережі, логотип, назва, налаштування мови, SEO за замовчуванням.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Унікальний ідентифікатор | PK
siteName | { uk: String, ru: String } | Назва сайту | багатомовне поле
logo | String | Шлях до логотипу | медіа-ссилання
phonePrimary | String | Основний телефон | 
phoneSecondary | String | Додатковий телефон | 
email | String | Контактний e-mail | 
address | { uk: String, ru: String } | Адреса | 
workingHours | { uk: String, ru: String } | Графік роботи | 
socialLinks | [{ platform: String, url: String }] | Соціальні мережі | 
seoDefaults | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO за замовчуванням | 
defaultLocale | String | Мова за замовчуванням | 'uk' | 'ru'
status | String | Статус налаштувань | 'active' | 'draft'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата останнього оновлення | 

Індекси:
- `defaultLocale`
- `status`

### 2.2. Category

Опис: розділи каталогу, які містять товари. Кожна категорія має окремі поля для української та російської мови.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Унікальний ідентифікатор | PK
name | { uk: String, ru: String } | Назва категорії | багатомовна
slug | { uk: String, ru: String } | URL slug | унікальний у межах мови
description | { uk: String, ru: String } | Опис категорії | 
seo | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO для сторінки категорії | 
image | ObjectId | Посилання на медіафайл | ref: Media
parentCategory | ObjectId | Батьківська категорія | ref: Category, nullable
displayOrder | Number | Порядок сортування | 
status | String | Публікація | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `{ slug.uk: 1 }` unique
- `{ slug.ru: 1 }` unique
- `status`
- `displayOrder`
- `parentCategory`

Примітка: якщо в майбутньому ми будемо мати лише одну вкладеність, `parentCategory` потрібен обов’язково, але не слід робити надто складну ієрархію без потреби.

### 2.3. Product

Опис: товарні позиції каталогу. Окремо зберігаємо загальні характеристики, різні типи цін, фото, доступність і метадані для окремої сторінки товару.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Унікальний ідентифікатор | PK
category | ObjectId | Категорія | ref: Category
name | { uk: String, ru: String } | Назва товару | багатомовна
slug | { uk: String, ru: String } | URL slug | унікальний у межах мови
description | { uk: String, ru: String } | Повний опис товару | 
shortDescription | { uk: String, ru: String } | Короткий опис | 
pricing | {
  salePrice: Number,
  rentalRates: [{
    periodDays: Number,
    price: Number,
    unit: String,
    currency: String,
    deposit: Number,
    isActive: Boolean
  }],
  currency: String
} | Ціна продажу і тарифи прокату | `salePrice` і `rentalRates` можуть бути null/порожні
availability | String | Наявність | 'in_stock' | 'on_order' | 'out_of_stock'
attributes | [{ key: { uk: String, ru: String }, value: { uk: String, ru: String } }] | Характеристики | 
images | [ObjectId] | Масив фото | ref: Media
seo | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO для сторінки товару | 
featured | Boolean | Відзначити як рекомендований | 
displayOrder | Number | Порядок | 
legacyId | String | Ідентифікатор із старого сайту або імпортованого джерела | для повторного імпорту, необов'язково
importSource | String | Джерело імпорту | 'legacy-site' | 'manual' | 'csv' | 
status | String | Статус | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `{ slug.uk: 1 }` unique
- `{ slug.ru: 1 }` unique
- `category`
- `status`
- `featured`
- `availability`
- `{ name.uk: 'text', description.uk: 'text' }` for search

Примітка: структура `pricing` дозволяє зберігати продаж і прокат без жорсткого зашивання однієї ціни в поле. Для тарифів прокату зберігаємо не абстрактний рядок, а параметризовані значення: період, сума, одиниця, валюта, депозит та статус активності. У реальній базі не слід вигадувати конкретні цінові умови без підтвердження у вихідних даних.

### 2.4. Page

Опис: статичні інформаційні сторінки: "Про компанію", "Умови прокату", "Контакти", "Партнери" та інші
a.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Унікальний ідентифікатор | PK
pageType | String | Тип сторінки | 'about' | 'terms' | 'contacts' | 'partners' | 'custom'
slug | { uk: String, ru: String } | URL slug | унікальний
title | { uk: String, ru: String } | Заголовок H1 | 
content | { uk: String, ru: String } | HTML або Rich Text | 
seo | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO | 
media | [ObjectId] | Зображення сторінки | ref: Media
status | String | Статус публікації | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `{ slug.uk: 1 }` unique
- `{ slug.ru: 1 }` unique
- `pageType`
- `status`

### 2.5. Article

Опис: інформаційні статті, що можуть містити текст, зображення, тегові мітки та SEO.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Ідентифікатор | PK
title | { uk: String, ru: String } | Назва | 
slug | { uk: String, ru: String } | URL slug | унікальний
excerpt | { uk: String, ru: String } | Короткий опис | 
content | { uk: String, ru: String } | Основний контент | 
coverImage | ObjectId | Обкладинка | ref: Media
featured | Boolean | Рекомендований запис | 
seo | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO | 
publishedAt | Date | Дата публікації | 
status | String | Статус | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `{ slug.uk: 1 }` unique
- `{ slug.ru: 1 }` unique
- `status`
- `publishedAt`

### 2.6. News

Опис: новини компанії, які мають окрему логіку відзнятих статей.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Ідентифікатор | PK
title | { uk: String, ru: String } | Заголовок | 
slug | { uk: String, ru: String } | URL slug | унікальний
excerpt | { uk: String, ru: String } | Короткий опис | 
content | { uk: String, ru: String } | Основний текст | 
coverImage | ObjectId | Фото новини | ref: Media
publishedAt | Date | Дата публікації | 
seo | { title: { uk: String, ru: String }, description: { uk: String, ru: String }, keywords: [String] } | SEO | 
status | String | Статус | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `{ slug.uk: 1 }` unique
- `{ slug.ru: 1 }` unique
- `status`
- `publishedAt`

### 2.7. Review

Опис: відгуки клієнтів.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Ідентифікатор | PK
authorName | String | Ім’я автора | 
authorCity | String | Місто | 
message | { uk: String, ru: String } | Текст відгуку | 
rating | Number | Оцінка | 1-5
status | String | Статус | 'draft' | 'published'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `status`
- `rating`
- `createdAt`

### 2.8. Media

Опис: медіафайли, зображення, обкладинки, ілюстрації для товарів, новин, статей і сторінок.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Ідентифікатор | PK
filename | String | Ім’я файлу | 
originalName | String | Початкове ім’я файлу | 
url | String | URL до медіафайлу | 
mimeType | String | MIME-тип | 
size | Number | Розмір файлу в байтах | 
alt | { uk: String, ru: String } | Альтернативний текст | 
width | Number | Ширина зображення | 
height | Number | Висота зображення | 
storageType | String | Локальне або зовнішнє сховище | 'local' | 'cloudinary' | 's3'
createdAt | Date | Дата створення | 

Індекси:
- `filename`
- `storageType`
- `createdAt`

### 2.9. User

Опис: облікові записи адміністраторів і редакторів.

Поле | Тип | Опис | Примітка
---|---|---|---|
_id | ObjectId | Ідентифікатор | PK
email | String | Email | unique
passwordHash | String | Хеш пароля | 
fullName | String | Повне ім’я | 
roles | [String] | Ролі користувача | admin | editor | manager
status | String | Статус облікового запису | 'active' | 'inactive'
createdAt | Date | Дата створення | 
updatedAt | Date | Дата оновлення | 

Індекси:
- `email` unique
- `roles`

## 3. Рекомендований підхід до багатомовності

Потрібно зберігати всю багатомовну копію як вкладений документ з ключами мови:

```ts
name: {
  uk: 'Автокрісло',
  ru: 'Автокресло'
}
```

Це зручно для:
- зберігання окремих заголовків, описів і SEO
- генерації URL окремо для кожної мови
- швидкого перемикання мови без додаткових join-операцій
- підтримки різних slug для української та російської версій

Рекомендована схема локалізації:

```ts
locale: {
  uk: { ... },
  ru: { ... }
}
```

але у практиці для простоти та читабельності в MongoDB краще використовувати полі структуру `name: { uk, ru }`, `slug: { uk, ru }`, `seo: { ... }` без окремого кореневого `locale`.

## 4. Зв’язки між колекціями

### 4.1. Category -> Product
- `Product.category` → `Category._id`
- Один до багатьох
- Це основний зв’язок каталогу

### 4.2. Product -> Media
- `Product.images` → `Media._id[]`
- Один до багатьох

### 4.3. News / Article / Page -> Media
- `coverImage` та `media` → `Media._id`
- Один до багатьох

### 4.4. Page -> SiteSettings
- `Page` не має прямого обов’язкового зв’язку з `SiteSettings`, якщо контент є окремим. `SiteSettings` служить глобальними настройками для фронтенду.

### 4.5. User
- Адміністратори/редактори керують доменом контенту без прямих посилань на колекції; роль задається через `roles`.

## 5. Індекси для пошуку і фільтрації

Рекомендовані індекси:
- `Category.slug.uk`, `Category.slug.ru` unique
- `Product.slug.uk`, `Product.slug.ru` unique
- `Product.category`
- `Product.status`
- `Product.availability`
- `Article.slug.uk`, `Article.slug.ru` unique
- `News.slug.uk`, `News.slug.ru` unique
- `Page.slug.uk`, `Page.slug.ru` unique
- `User.email` unique
- `Review.status`
- `Media.filename`

Для повнотекстового пошуку по товарах доцільно використовувати текстові індекси:
- `name.uk`
- `name.ru`
- `description.uk`
- `description.ru`
- `attributes.*.value.uk`
- `attributes.*.value.ru`

## 6. Рекомендована структура даних для складних типів цін

```ts
price: {
  sale: 3200,
  rent: 180,
  currency: 'UAH'
}
```

Підхід є більш правильним, ніж масив різних типів цін, бо дозволяє:
- зберігати продаж і прокат окремо
- мати однаковий формат у всіх товарах
- легко розширювати валюту та тип ціни без зміни базової структури

## 7. Висновок

Для сайту Baby Service оптимально використовувати 8–9 колекцій з чітким розділенням відповідальності:
- SiteSettings
- Category
- Product
- Page
- Article
- News
- Review
- Media
- User

Інфраструктура має бути простою, масштабованою і без зайвих зв’язків. Для нинішніх потреб достатньо однієї багатомовної моделі, без складного polymorphic дизайну.
