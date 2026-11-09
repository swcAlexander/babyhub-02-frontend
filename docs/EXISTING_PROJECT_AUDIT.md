# Existing Project Audit

## 1. Current project state

The project already exists as a Next.js application and is not a new scaffold. It contains a public frontend and an initial API layer, but the current implementation is still a prototype and not yet aligned with the target architecture.

### 1.1. Core stack

From `package.json`:

- Next.js: `14.2.1`
- React: `18`
- TypeScript: `^5`
- Mongoose: `^8.3.4`
- Sass/SCSS: project is using CSS modules and a global stylesheet; SCSS is not yet configured as the primary styling system
- App Router: yes (`src/app/**`)
- Tailwind: not present in `package.json` and not required for the current design

### 1.2. Current folder structure

```text
src/
├── (components)/
│   ├── Footer/
│   └── Header/
├── app/
│   ├── about/
│   ├── api/
│   │   ├── connect/
│   │   ├── controllers/
│   │   ├── decorators/
│   │   ├── helpers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── public/
│   │   ├── schemas/
│   │   ├── tmp/
│   │   ├── connect.ts
│   │   ├── items.ts
│   │   └── ...
│   ├── catalog/
│   ├── globals.css
│   ├── layout.tsx
│   ├── login/
│   ├── page.tsx
│   ├── page.module.css
│   └── register/
├── types/
└── ...
```

## 2. Current public route map

The active public routes currently visible in the code are:

- `/` — home page
- `/catalog` — catalog page
- `/about` — about page
- `/login` — login page
- `/register` — registration page

There is no locale-aware route structure yet, no `/ru/` version, no `/news`, `/articles`, `/reviews`, `/contacts` page set, and no domain-specific route hierarchy like `/catalog/[category]/[product]`.

## 3. Current API and MongoDB state

### 3.1. Environment variables

The project contains `.env.example` with variables such as:

- `DB_HOST`
- `DB_HOST_TEST`
- `PORT`
- `JWT_SECRET`
- `NODEMAILER_FROM`
- `PASSWORD`
- `BASE_URL`

This confirms the project already anticipated a MongoDB-backed API, but the implementation is still generic and not aligned with the final Baby Service schema.

### 3.2. MongoDB connection

Current implementation lives in:

- `src/app/api/connect/connect.ts`

It creates a cached Mongoose connection using `mongoose.connect(process.env.DB_HOST)`. This is a valid starting point, but the logic is not yet tied to a dedicated domain model layer or a production-ready database separation for public/admin data.

### 3.3. Current Mongoose models

Existing models include:

- `src/app/api/models/item.ts`
- `src/app/api/models/articles.js`
- `src/app/api/models/users.js`

These models are not yet aligned with the required Business schema:

- `Item` is a generic one-off model with `title`, `price`, `availability`, `owner`, etc.
- `price` is a string instead of a structured sale/rent pricing model.
- `Item` is declared as `mongoose.models.Itam` with a typo (`Itam` instead of `Item`).
- `articles.js` uses `artiicleSchema`, which indicates an unfinished or copied model.
- `users.js` is a generic auth user model, not a site-admin or role-driven CMS user model.

## 4. Architectural mismatches with the target design

### 4.1. Routing and localization

The target design requires:

- `/` and `/ru`
- `/about` and `/ru/about`
- `/catalog/...` and `/ru/catalog/...`
- separate routes for news, articles, reviews, and static pages
- explicit product routes such as `/catalog/[categorySlug]/[productSlug]` and `/ru/catalog/[categorySlug]/[productSlug]`

The current project does not have a locale-aware route layer that matches the agreed fixed-locale pattern. It also has no admin route segregation and no dedicated product detail pages.

### 4.2. API duplication and separation

The current codebase contains hybrid API patterns:

- `src/app/api/items.ts` uses a Next.js API route file pattern
- `src/app/api/controllers/...` is written as server-side controller logic
- `src/app/api/...` also contains generic auth and validator utilities

This creates ambiguity between public API endpoints and protected admin API endpoints. The architecture must be cleaned up to separate:

- public read APIs
- protected admin APIs
- server-side validation and authorization

### 4.3. Admin panel and roles

There is no real admin route structure yet. The architecture must include a protected `/admin` section with role-based access, but the codebase currently only includes public pages and a generic auth API.

### 4.4. Data model mismatch

Current schema is not ready for the business domain:

- no `Category` collection
- no `Product` collection with `salePrice`, `rentPrice`, `rentalPeriods`, `availability`, `images`, `attributes`
- no multilingual `slug` and `seo` model
- no `Page`, `Article`, `News`, `Review`, `Media`, `SiteSettings` structure as designed for the final CMS

## 5. What to keep, modify, replace, or remove

### Keep

- `src/app` as the base App Router structure
- `src/(components)/Header` and `src/(components)/Footer` as reusable layout elements
- `src/app/layout.tsx` for the app shell
- the MongoDB connection pattern itself, as a good starting point for a new service layer
- TypeScript strict mode and App Router usage

### Modify

- `src/app` route organization to align with localized public routes and a proper admin structure
- API folder structure to separate public/admin logic
- environment variables to support a production-ready, multi-environment database setup
- current Mongoose model layer to map to real site collections instead of generic demo data

### Replace

- generic `Item` model with domain models: `Category`, `Product`, `Page`, `Article`, `News`, `Review`, `Media`, `User`, `SiteSettings`
- current auth/controller patterns with role-aware admin authorization and validation
- the current demo-like pages (`Home`, `Catalog`, `About`) should be replaced or refactored to become real CMS-driven pages

### Remove

- any leftover generic/auth demo logic that is unrelated to Baby Service domain
- duplicate or conflicting API patterns that mix Next API route logic with custom controller architecture
- unused example code and helper layers that do not serve the final CMS and catalog architecture

## 6. Recommended architecture adjustments

### Routes

Use a single, consistent route strategy without mixing route groups and locale folders indiscriminately.

Recommended final approach:

- Fixed locale routes without `/uk` prefix: root `app/` for Ukrainian and `app/ru/` for Russian
- Public pages under explicit route folders, not a generic `[locale]` segment
- Separate admin panel under `src/app/admin/...`
- Protected admin API under `src/app/api/admin/...` or dedicated admin route handlers

Important rule:

- Locale handling is fixed by the route structure: Ukrainian pages live at `/...`, Russian pages at `/ru/...`.
- Route groups such as `(public)` and `(admin)` are organizational only and must not be used to create URL conflicts. They can help structure files, but the final URL path must be defined only by the actual route folders and locale segments.

### MongoDB adaptation

Current connection logic should be retained only as a base for a new domain-driven layer.

Recommended transition:

1. Keep the connection utility.
2. Replace the old generic `Item` model with domain models built for the final DB schema.
3. Add indexes for `slug` and localized fields.
4. Reserve `DB_HOST` for the main database and add a dedicated admin/test database variable if needed.
5. Keep `.env` values out of client code and never expose them through `NEXT_PUBLIC_*` variables.

## 7. Recommended implementation order

1. Clean up and standardize routes.
2. Define the final public/admin directory layout and route tree.
3. Finalize the MongoDB schema and Mongoose models.
4. Implement server-side auth and role validation.
5. Rebuild public pages to consume CMS data.
6. Add redirect and SEO configuration.
7. Then start catalog and content import flow.

## 8. Summary

The existing project is a solid starting point for a Next.js app, but it is not yet a production-ready architecture for the Baby Service site. It contains the right framework, toolchain, and a first MongoDB connection, but the current code is too generic and inconsistent with the planned CMS-driven catalog architecture.

The main priority is to replace the demo/boilerplate model layer and route structure with a clear localization, admin, and catalog/data-model architecture before any UI or content implementation begins.
