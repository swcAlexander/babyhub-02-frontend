import mongoose, { type Document, Schema } from 'mongoose';
import {
  attachLocalizedSlugNormalization,
  importMetaSchema,
  localizedStringSchema,
  normalizeSlugValue,
  seoSchema,
  uniqueLocalizedSlugIndexes,
  type ImportMeta,
  type LocalizedString,
  type SeoMetadata,
} from './common';

export interface ICategory extends Document {
  name: LocalizedString;
  slug: LocalizedString;
  description?: LocalizedString;
  seo?: SeoMetadata;
  image?: mongoose.Types.ObjectId | null;
  parentCategory?: mongoose.Types.ObjectId | null;
  displayOrder: number;
  status: 'draft' | 'published';
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    name: {
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
    description: { type: localizedStringSchema },
    seo: { type: seoSchema, default: undefined },
    image: { type: Schema.Types.ObjectId, ref: 'Media', default: null },
    parentCategory: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    displayOrder: { type: Number, min: 0, default: 0 },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

categorySchema.pre('validate', function normalizeCategorySlug(next) {
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

categorySchema.index({ 'slug.uk': 1 }, { unique: true, sparse: true });
categorySchema.index({ 'slug.ru': 1 }, { unique: true, sparse: true });
categorySchema.index({ status: 1, displayOrder: 1 });
categorySchema.index({ parentCategory: 1 });

const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', categorySchema);

export default Category;

export const categorySlugIndexes = uniqueLocalizedSlugIndexes('slug');
export { attachLocalizedSlugNormalization };
