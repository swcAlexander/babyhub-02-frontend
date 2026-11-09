import mongoose, { Schema } from 'mongoose';

export type LocalizedString = {
  uk?: string;
  ru?: string;
};

export type SeoMetadata = {
  title?: LocalizedString;
  description?: LocalizedString;
  keywords?: string[];
};

export type ImportMeta = {
  source?: string;
  legacyId?: string;
  legacyUrl?: string;
  importedAt?: Date;
};

export const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hasNonEmptyLocalizedValue = (value?: LocalizedString | null): boolean => {
  if (!value || typeof value !== 'object') return false;

  const localeValues = ['uk', 'ru']
    .map((locale) => value[locale as keyof LocalizedString])
    .filter((entry): entry is string => typeof entry === 'string');

  return localeValues.some((entry) => entry.trim().length > 0);
};

const localizedStringField = {
  type: String,
  trim: true,
  validate: {
    validator(value?: string | null) {
      return value === undefined || value === null || value.trim().length > 0;
    },
    message: 'Localized field cannot be empty.',
  },
};

export const localizedStringSchema = new Schema<LocalizedString>(
  {
    uk: localizedStringField,
    ru: localizedStringField,
  },
  { _id: false }
);

export const localizedSlugValidator = {
  validator(value?: LocalizedString | null) {
    if (!value || typeof value !== 'object') return false;

    const ukValue = typeof value.uk === 'string' ? value.uk.trim() : '';
    if (!ukValue) return false;

    if (typeof value.ru === 'string' && value.ru.trim().length === 0) return false;

    return true;
  },
  message: 'Ukrainian slug is required and cannot be empty; Russian slug, if provided, cannot be empty.',
};

export const seoSchema = new Schema<SeoMetadata>(
  {
    title: { type: localizedStringSchema, default: undefined },
    description: { type: localizedStringSchema, default: undefined },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

export const importMetaSchema = new Schema<ImportMeta>(
  {
    source: { type: String, trim: true },
    legacyId: { type: String, trim: true },
    legacyUrl: { type: String, trim: true },
    importedAt: { type: Date },
  },
  { _id: false }
);

export const normalizeSlugValue = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || undefined;
};

export const normalizeLocalizedSlug = (slug?: LocalizedString | null): LocalizedString | undefined => {
  if (!slug || typeof slug !== 'object') return undefined;

  const normalized: LocalizedString = {};

  (['uk', 'ru'] as const).forEach((locale) => {
    const value = slug[locale];
    const normalizedValue = normalizeSlugValue(value);

    if (normalizedValue) {
      normalized[locale] = normalizedValue;
    }
  });

  return Object.keys(normalized).length ? normalized : undefined;
};

export const attachLocalizedSlugNormalization = <T extends { slug?: LocalizedString | null }>(target: T): void => {
  if (!target?.slug || typeof target.slug !== 'object') return;

  const normalizedSlug = normalizeLocalizedSlug(target.slug);

  if (normalizedSlug) {
    target.slug = normalizedSlug;
  }
};

export const uniqueLocalizedSlugIndexes = (fieldName: string): Array<{ [key: string]: number }> => [
  { [`${fieldName}.uk`]: 1 },
  { [`${fieldName}.ru`]: 1 },
];

export const isValidObjectId = (value: unknown): value is mongoose.Types.ObjectId =>
  mongoose.isValidObjectId(value);
