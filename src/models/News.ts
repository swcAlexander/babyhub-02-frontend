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

export interface INews extends Document {
  title: LocalizedString;
  slug: LocalizedString;
  excerpt?: LocalizedString;
  content?: LocalizedString;
  coverImage?: mongoose.Types.ObjectId | null;
  publishedAt?: Date;
  seo?: SeoMetadata;
  status: 'draft' | 'published';
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const newsSchema = new Schema<INews>(
  {
    title: { type: localizedStringSchema, required: true },
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
    excerpt: { type: localizedStringSchema },
    content: { type: localizedStringSchema },
    coverImage: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    publishedAt: { type: Date },
    seo: { type: seoSchema, default: undefined },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

newsSchema.pre('validate', function normalizeNewsSlug(next) {
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

newsSchema.index({ 'slug.uk': 1 }, { unique: true, sparse: true });
newsSchema.index({ 'slug.ru': 1 }, { unique: true, sparse: true });
newsSchema.index({ publishedAt: -1, status: 1 });

const News = mongoose.models.News || mongoose.model<INews>('News', newsSchema);

export default News;
export const newsSlugIndexes = uniqueLocalizedSlugIndexes('slug');
