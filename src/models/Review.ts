import mongoose, { type Document, Schema } from 'mongoose';
import {
  importMetaSchema,
  localizedStringSchema,
  type ImportMeta,
  type LocalizedString,
} from './common';

export interface IReview extends Document {
  authorName: string;
  city?: string;
  body: LocalizedString;
  rating?: number | null;
  publishedAt?: Date;
  status: 'draft' | 'published' | 'moderation';
  importMeta?: ImportMeta;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    authorName: {
      type: String,
      required: true,
      trim: true,
    },
    city: { type: String, trim: true },
    body: {
      type: localizedStringSchema,
      required: true,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    publishedAt: { type: Date },
    status: {
      type: String,
      enum: ['draft', 'published', 'moderation'],
      default: 'published',
    },
    importMeta: { type: importMetaSchema, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

reviewSchema.index({ status: 1, publishedAt: -1 });
reviewSchema.index({ authorName: 1 });

const Review = mongoose.models.Review || mongoose.model<IReview>('Review', reviewSchema);

export default Review;
