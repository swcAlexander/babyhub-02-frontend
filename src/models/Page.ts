import mongoose, { type Document, Schema } from 'mongoose';
import {
  importMetaSchema,
  localizedStringSchema,
  normalizeSlugValue,
  seoSchema,
  uniqueLocalizedSlugIndexes,
  type ImportMeta,
  type LocalizedString,
  type SeoMetadata,
} from './common';

export interface IPage extends Document {
  pageType: 'about' | 'contacts' | 'terms' | 'partners' | 'info' | 'custom';
  title: LocalizedString;
  slug: LocalizedString;
  content?: LocalizedString;
  excerpt?: LocalizedString;
  seo?: SeoMetadata;
  media?: mongoose.Types.ObjectId[];
  status: 'draft' | 'published';
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const pageSchema = new Schema<IPage>(
  {
    pageType: {
      type: String,
      enum: ['about', 'contacts', 'terms', 'partners', 'info', 'custom'],
      required: true,
    },
    title: {
      type: localizedStringSchema,
      required: true,
    },
    slug: {
      type: localizedStringSchema,
      required: true,
      validate: {
        validator(value?: { uk?: string; ru?: string } | null) {
          if (!value || typeof value !== 'object') return false;

          const ukValue = typeof value.uk === 'string' ? value.uk.trim() : '';
          if (!ukValue) return false;

          if (typeof value.ru === 'string' && value.ru.trim().length === 0) return false;

          return true;
        },
        message: 'Ukrainian slug is required and cannot be empty; Russian slug, if provided, cannot be empty.',
      },
    },
    content: { type: localizedStringSchema },
    excerpt: { type: localizedStringSchema },
    seo: { type: seoSchema, default: undefined },
    media: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

pageSchema.pre('validate', function normalizePageSlug(next) {
  if (this.slug && typeof this.slug === 'object') {
    for (const locale of ['uk', 'ru'] as const) {
      const rawValue = this.slug[locale];
      const normalizedValue = normalizeSlugValue(rawValue);

      if (normalizedValue) {
        this.slug[locale] = normalizedValue;
      }
    }
  }

  next();
});

pageSchema.index({ 'slug.uk': 1 }, { unique: true, sparse: true });
pageSchema.index({ 'slug.ru': 1 }, { unique: true, sparse: true });
pageSchema.index({ pageType: 1, status: 1 });

const Page = mongoose.models.Page || mongoose.model<IPage>('Page', pageSchema);

export default Page;
export const pageSlugIndexes = uniqueLocalizedSlugIndexes('slug');
