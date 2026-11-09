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

export type ProductAvailability = 'in_stock' | 'on_order' | 'out_of_stock';

export interface IRentalRate {
  periodDays?: number | null;
  unit: string;
  price: number;
  currency: string;
  deposit?: number | null;
  isActive: boolean;
}

export interface IProduct extends Document {
  category: mongoose.Types.ObjectId;
  name: LocalizedString;
  slug: LocalizedString;
  shortDescription?: LocalizedString;
  description?: LocalizedString;
  attributes?: Array<{ key: LocalizedString; value: LocalizedString }>;
  images?: mongoose.Types.ObjectId[];
  pricing: {
    salePrice?: number | null;
    currency: string;
    rentalRates: IRentalRate[];
  };
  availability: ProductAvailability;
  featured: boolean;
  displayOrder: number;
  seo?: SeoMetadata;
  status: 'draft' | 'published';
  legacyId?: string;
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const attributeValueSchema = new Schema(
  {
    key: { type: localizedStringSchema, required: true },
    value: { type: localizedStringSchema, required: true },
  },
  { _id: false }
);

const rentalRateSchema = new Schema<IRentalRate>(
  {
    periodDays: { type: Number, min: 1 },
    unit: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, default: 'UAH' },
    deposit: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true }
);

const pricingSchema = new Schema(
  {
    salePrice: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, default: 'UAH' },
    rentalRates: { type: [rentalRateSchema], default: [] },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
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
    shortDescription: { type: localizedStringSchema },
    description: { type: localizedStringSchema },
    attributes: [attributeValueSchema],
    images: [{ type: Schema.Types.ObjectId, ref: 'Media' }],
    pricing: { type: pricingSchema, default: { currency: 'UAH', rentalRates: [] } },
    availability: {
      type: String,
      enum: ['in_stock', 'on_order', 'out_of_stock'],
      default: 'in_stock',
    },
    featured: { type: Boolean, default: false },
    displayOrder: { type: Number, min: 0, default: 0 },
    seo: { type: seoSchema, default: undefined },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    legacyId: { type: String, trim: true },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

productSchema.pre('validate', function normalizeProductSlug(next) {
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

productSchema.index({ category: 1, displayOrder: 1 });
productSchema.index({ status: 1, featured: 1 });
productSchema.index({ 'slug.uk': 1 }, { unique: true, sparse: true });
productSchema.index({ 'slug.ru': 1 }, { unique: true, sparse: true });
productSchema.index({ availability: 1, status: 1 });

const Product = mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);

export default Product;
export const productSlugIndexes = uniqueLocalizedSlugIndexes('slug');
export { attachLocalizedSlugNormalization };
