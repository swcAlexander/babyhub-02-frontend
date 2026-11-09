# Структура сайту Baby Service Луцьк

## 1. Ієрархічна структура

```text
https://lutsk.babyservice.ua/
├── Головна сторінка
│   ├── Опис компанії
│   ├── Розділи каталогу
│   ├── Новини
│   └── Контактна інформація
├── /about.html
│   └── Про компанію
├── /usloviya_prokata.html
│   └── Умови прокату
├── /partners.html
│   └── Партнери
├── /comments.html
│   └── Відгуки клієнтів
├── /staty.html
│   └── Список статей
├── /novosti.html
│   └── Список новин
│       └── /novosti/uvaga_baby_service_zakrito_na_karantin_z_17_03_2020_po_03_04_2020.html
├── /contacts.html
│   └── Контакти
├── /ru/
│   └── Російськомовна версія головної сторінки
├── Каталог товарів
│   ├── /vagi_dityachi.html
│   ├── /avtokrisla.html
│   ├── /kolyaski.html
│   ├── /krovatka.html
│   ├── /molokootsosy.html
│   ├── /ukachivayuschie_centry_dlya_novorozhdennyh.html
│   ├── /ergoryukzaki.html
│   ├── /hoduni_shtovhanci.html
│   ├── /lizhechka_manezhi.html
│   ├── /medicinskoe_oborudovanie.html
│   ├── /radionyanya.html
│   ├── /stilchiki_dlya_goduvannya.html
│   ├── /rozvivayuchi_kilimki.html
│   ├── /vulichni_rozvagi.html
│   ├── /velosipedy_begovely_samokaty.html
│   ├── /turistichne_sporyadzhennya.html
│   ├── /pelenalniy_stolik.html
│   ├── /stribunci.html
│   ├── /karnavalni_novorichni_kostyumi.html
│   ├── /rozvivayuchi_igrashki.html
│   └── /mebli_dlya_iventu.html
└── Зовнішні офіси Baby Service
    ├── babyservice.ua
    ├── babyservice.lviv.ua
    ├── babyservice.kh.ua
    ├── babyservice.dp.ua
    ├── babyservice.pl.ua
    ├── babyservice.md
    ├── babyservice.zp.ua
    ├── babyservice.zt.ua
    └── інші міські домени
```

## 2. Короткий опис типів сторінок

- Головна сторінка: презентація сервісу, категорії, ключові послуги
- Інформаційні сторінки: про компанію, умови прокату, контакти, партнери
- Сторінки новин/статей: тематичний контент для клієнтів та SEO
- Категорії товарів: списки товарів по ключових групам
- Локалізація: українська та російська версія

## 3. Основні висновки

- Сайт має чітку каталогову структуру, але без глибокої ієрархії підкатегорій.
- Замість сучасних product-detail сторінок переважають окремі категорійні сторінки.
- Усі розділи пов’язані прямими URL без API або JSON-структур.
- Новий проєкт має проектуватись як нормалізована база даних з окремими колекціями для продуктів, категорій, новин, статей та сервісних сторінок.
