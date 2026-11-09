import mongoose, { type Document, Schema } from 'mongoose';
import { localizedStringSchema, seoSchema, type LocalizedString, type SeoMetadata } from './common';

export interface ISiteSettings extends Document {
  siteName: LocalizedString;
  logoUrl?: string;
  phonePrimary?: string;
  phoneSecondary?: string;
  email?: string;
  address?: LocalizedString;
  workingHours?: LocalizedString;
  socialLinks?: Array<{ platform: string; url: string }>;
  seoDefaults?: SeoMetadata;
  defaultLocale: 'uk' | 'ru';
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const socialLinkSchema = new Schema(
  {
    platform: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const siteSettingsSchema = new Schema<ISiteSettings>(
  {
    siteName: {
      type: localizedStringSchema,
      required: true,
    },
    logoUrl: { type: String, trim: true },
    phonePrimary: { type: String, trim: true },
    phoneSecondary: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    address: { type: localizedStringSchema },
    workingHours: { type: localizedStringSchema },
    socialLinks: [socialLinkSchema],
    seoDefaults: { type: seoSchema, default: undefined },
    defaultLocale: {
      type: String,
      enum: ['uk', 'ru'],
      default: 'uk',
    },
    currency: {
      type: String,
      default: 'UAH',
      trim: true,
      uppercase: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true, versionKey: false }
);

siteSettingsSchema.index({ isActive: 1 }, { unique: true, sparse: true, partialFilterExpression: { isActive: true } });
siteSettingsSchema.index({ defaultLocale: 1 });

const SiteSettings =
  mongoose.models.SiteSettings || mongoose.model<ISiteSettings>('SiteSettings', siteSettingsSchema);

export default SiteSettings;
