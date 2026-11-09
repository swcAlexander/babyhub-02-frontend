import mongoose, { type Document, Schema } from 'mongoose';
import {
  importMetaSchema,
  localizedStringSchema,
  normalizeSlugValue,
  type ImportMeta,
  type LocalizedString,
} from './common';

export interface IMedia extends Document {
  filename: string;
  originalName?: string;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  alt?: LocalizedString;
  storageType: 'local' | 'cloudinary' | 's3';
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const mediaSchema = new Schema<IMedia>(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: { type: String, trim: true },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: { type: String, trim: true },
    sizeBytes: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    alt: { type: localizedStringSchema, default: undefined },
    storageType: {
      type: String,
      enum: ['local', 'cloudinary', 's3'],
      required: true,
      default: 'local',
    },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

mediaSchema.index({ filename: 1 }, { unique: true, sparse: true });
mediaSchema.index({ storageType: 1, filename: 1 });
mediaSchema.index({ url: 1 }, { unique: true, sparse: true });

const Media = mongoose.models.Media || mongoose.model<IMedia>('Media', mediaSchema);

export default Media;

export const normalizeMediaTitle = (value?: string | null): string | undefined =>
  normalizeSlugValue(value);
