import { type Types } from 'mongoose';

import { DEFAULT_LOCALE, type Locale } from '@/lib/locale';
import connectToDatabase from '@/lib/mongodb';
import Category, { type ICategory } from '@/models/Category';

type LocalizedMap = {
  uk?: string;
  ru?: string;
};

export type CategorySummary = {
  id: string;
  name: LocalizedMap;
  slug: LocalizedMap;
  description?: LocalizedMap;
  seo?: {
    title?: LocalizedMap;
    description?: LocalizedMap;
    keywords?: string[];
  };
  image?: string | null;
  parentCategory?: string | null;
  displayOrder: number;
  status: 'draft' | 'published';
};

type LeanCategory = Partial<ICategory> & {
  _id: Types.ObjectId;
};

const cloneLocalized = (
  value?: ICategory['name'] | ICategory['slug'] | ICategory['description'] | null
): LocalizedMap => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return {
    ...(typeof value.uk === 'string' ? { uk: value.uk } : {}),
    ...(typeof value.ru === 'string' ? { ru: value.ru } : {}),
  };
};

const serializeCategory = (category: LeanCategory): CategorySummary => {
  const name = cloneLocalized(category.name);
  const slug = cloneLocalized(category.slug);
  const description = cloneLocalized(category.description);

  return {
    id: category._id.toString(),
    name,
    slug,
    description: Object.keys(description).length > 0 ? description : undefined,
    seo: category.seo
      ? {
          title: cloneLocalized(category.seo.title),
          description: cloneLocalized(category.seo.description),
          keywords: Array.isArray(category.seo.keywords) ? category.seo.keywords : [],
        }
      : undefined,
    image: category.image ? category.image.toString() : null,
    parentCategory: category.parentCategory ? category.parentCategory.toString() : null,
    displayOrder: Number(category.displayOrder ?? 0),
    status: category.status ?? 'draft',
  };
};

export async function getPublishedCategories(locale: Locale = DEFAULT_LOCALE): Promise<CategorySummary[]> {
  await connectToDatabase();

  const categories = await Category.find({ status: 'published' })
    .select({ __v: 0 })
    .sort({ displayOrder: 1, createdAt: -1 })
    .lean<LeanCategory[]>()
    .exec();

  return categories.map((category) => serializeCategory(category));
}

export async function getCategoryBySlug(
  slug: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<CategorySummary | null> {
  if (!slug || typeof slug !== 'string') {
    return null;
  }

  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return null;
  }

  await connectToDatabase();

  const query = { status: 'published' } as Record<string, unknown>;
  query[`slug.${locale}`] = normalizedSlug;

  const category = await Category.findOne(query)
    .select({ __v: 0 })
    .lean<LeanCategory | null>()
    .exec();

  if (!category) {
    return null;
  }

  return serializeCategory(category);
}
