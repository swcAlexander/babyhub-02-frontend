import mongoose, { type Types } from 'mongoose';

import { DEFAULT_LOCALE, type Locale } from '@/lib/locale';
import connectToDatabase from '@/lib/mongodb';
import Category, { type ICategory } from '@/models/Category';
import Product, { type IProduct } from '@/models/Product';

export type ProductListOptions = {
  category?: string;
  categoryId?: Types.ObjectId | string;
  limit?: number;
  page?: number;
  locale?: Locale;
  featuredOnly?: boolean;
};

export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type LocalizedValue = {
  uk?: string;
  ru?: string;
};

export type ProductSummary = {
  id: string;
  categoryId: string | null;
  name: LocalizedValue;
  slug: LocalizedValue;
  shortDescription?: LocalizedValue;
  description?: LocalizedValue;
  attributes?: Array<{ key: LocalizedValue; value: LocalizedValue }>;
  images: string[];
  pricing: {
    salePrice?: number | null;
    currency: string;
    rentalRates: Array<{
      periodDays?: number | null;
      unit: string;
      price: number;
      currency: string;
      deposit?: number | null;
      isActive: boolean;
    }>;
  };
  availability: 'in_stock' | 'on_order' | 'out_of_stock';
  featured: boolean;
  displayOrder: number;
  seo?: {
    title?: LocalizedValue;
    description?: LocalizedValue;
    keywords?: string[];
  };
  status: 'draft' | 'published';
};

type LeanProduct = Partial<IProduct> & {
  _id: Types.ObjectId;
  category?: Types.ObjectId | null;
};

const normalizeLimit = (value?: number): number => {
  const parsed = Number(value ?? 12);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 12;
  }

  return Math.min(parsed, 50);
};

const normalizePage = (value?: number): number => {
  const parsed = Number(value ?? 1);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

const cloneLocalized = (value?: IProduct['name'] | IProduct['slug'] | IProduct['description'] | IProduct['shortDescription'] | null): LocalizedValue => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return {
    ...(typeof value.uk === 'string' ? { uk: value.uk } : {}),
    ...(typeof value.ru === 'string' ? { ru: value.ru } : {}),
  };
};

const cloneAttributeValue = (value?: { key?: IProduct['name']; value?: IProduct['name'] } | null): { key: LocalizedValue; value: LocalizedValue } | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  return {
    key: cloneLocalized(value.key),
    value: cloneLocalized(value.value),
  };
};

const serializeProduct = (product: LeanProduct): ProductSummary => {
  const attributes = Array.isArray(product.attributes)
    ? product.attributes.map((attribute) => cloneAttributeValue(attribute)).filter((entry): entry is { key: LocalizedValue; value: LocalizedValue } => !!entry)
    : undefined;

  return {
    id: product._id.toString(),
    categoryId: product.category ? product.category.toString() : null,
    name: cloneLocalized(product.name),
    slug: cloneLocalized(product.slug),
    shortDescription: cloneLocalized(product.shortDescription),
    description: cloneLocalized(product.description),
    attributes: attributes && attributes.length > 0 ? attributes : undefined,
    images: Array.isArray(product.images) ? product.images.map((image) => image.toString()) : [],
    pricing: {
      salePrice: product.pricing?.salePrice ?? null,
      currency: product.pricing?.currency ?? 'UAH',
      rentalRates: Array.isArray(product.pricing?.rentalRates)
        ? product.pricing.rentalRates.map((rate) => ({
            periodDays: rate.periodDays ?? null,
            unit: rate.unit,
            price: Number(rate.price ?? 0),
            currency: rate.currency ?? 'UAH',
            deposit: rate.deposit ?? null,
            isActive: Boolean(rate.isActive),
          }))
        : [],
    },
    availability: product.availability ?? 'in_stock',
    featured: Boolean(product.featured),
    displayOrder: Number(product.displayOrder ?? 0),
    seo: product.seo
      ? {
          title: cloneLocalized(product.seo.title),
          description: cloneLocalized(product.seo.description),
          keywords: Array.isArray(product.seo.keywords) ? product.seo.keywords : [],
        }
      : undefined,
    status: product.status ?? 'draft',
  };
};

const resolvePublishedCategoryScope = async (
  category?: string,
  categoryId?: Types.ObjectId | string,
  locale: Locale = DEFAULT_LOCALE
): Promise<{ categoryId: Types.ObjectId | null; hasFilter: boolean }> => {
  const categorySlug = typeof category === 'string' ? category.trim() : '';
  const categoryIdValue = typeof categoryId === 'string' ? categoryId.trim() : categoryId;

  if (categorySlug && categoryIdValue) {
    if (!mongoose.isValidObjectId(categoryIdValue)) {
      return { categoryId: null, hasFilter: true };
    }

    const normalizedCategoryId = new mongoose.Types.ObjectId(categoryIdValue);
    const categoryById = await Category.findOne({ _id: normalizedCategoryId, status: 'published' })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId } | null>()
      .exec();

    const categoryBySlug = await Category.findOne({
      status: 'published',
      [`slug.${locale}`]: categorySlug,
    })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId } | null>()
      .exec();

    if (!categoryById || !categoryBySlug || categoryById._id.toString() !== categoryBySlug._id.toString()) {
      return { categoryId: null, hasFilter: true };
    }

    return { categoryId: categoryBySlug._id, hasFilter: true };
  }

  if (categorySlug) {
    const categoryBySlug = await Category.findOne({
      status: 'published',
      [`slug.${locale}`]: categorySlug,
    })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId } | null>()
      .exec();

    if (!categoryBySlug) {
      return { categoryId: null, hasFilter: true };
    }

    return { categoryId: categoryBySlug._id, hasFilter: true };
  }

  if (categoryIdValue) {
    if (!mongoose.isValidObjectId(categoryIdValue)) {
      return { categoryId: null, hasFilter: true };
    }

    const categoryById = await Category.findOne({
      _id: new mongoose.Types.ObjectId(categoryIdValue),
      status: 'published',
    })
      .select({ _id: 1 })
      .lean<{ _id: Types.ObjectId } | null>()
      .exec();

    if (!categoryById) {
      return { categoryId: null, hasFilter: true };
    }

    return { categoryId: categoryById._id, hasFilter: true };
  }

  return { categoryId: null, hasFilter: false };
};

export async function getPublishedProducts(options: ProductListOptions = {}): Promise<{
  data: ProductSummary[];
  pagination: PaginationMeta;
}> {
  await connectToDatabase();

  const locale = options.locale ?? DEFAULT_LOCALE;
  const limit = normalizeLimit(options.limit);
  const page = normalizePage(options.page);

  const categoryScope = await resolvePublishedCategoryScope(options.category, options.categoryId, locale);

  if (categoryScope.hasFilter && categoryScope.categoryId === null) {
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  const publishedCategoryIds = await Category.find({ status: 'published' })
    .select({ _id: 1 })
    .lean<{ _id: Types.ObjectId }[]>()
    .exec();

  const allowedCategoryIds = publishedCategoryIds.map((category) => category._id);

  const localeFilter = {
    $and: [
      { [`name.${locale}`]: { $exists: true, $type: 'string' } },
      { [`name.${locale}`]: { $not: /^\s*$/ } },
      { [`slug.${locale}`]: { $exists: true, $type: 'string' } },
      { [`slug.${locale}`]: { $not: /^\s*$/ } },
    ],
  };

  const filter: Record<string, unknown> = {
    status: 'published',
    category: { $in: allowedCategoryIds },
    ...localeFilter,
  };

  if (categoryScope.categoryId) {
    filter.category = categoryScope.categoryId;
  }

  if (options.featuredOnly) {
    filter.featured = true;
  }

  const total = await Product.countDocuments(filter);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  const products = await Product.find(filter)
    .select({ __v: 0 })
    .sort({ displayOrder: 1, createdAt: -1, _id: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean<LeanProduct[]>()
    .exec();

  return {
    data: products.map((product) => serializeProduct(product)),
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getProductBySlug(
  categorySlug: string,
  productSlug: string,
  locale: Locale = DEFAULT_LOCALE
): Promise<ProductSummary | null> {
  if (!categorySlug || !productSlug) {
    return null;
  }

  await connectToDatabase();

  const categoryQuery = { status: 'published' } as Record<string, unknown>;
  categoryQuery[`slug.${locale}`] = categorySlug.trim();

  const category = await Category.findOne(categoryQuery).select({ _id: 1 }).lean<ICategory | null>().exec();

  if (!category || !category._id) {
    return null;
  }

  const productQuery = {
    status: 'published',
    category: category._id,
  } as Record<string, unknown>;
  productQuery[`slug.${locale}`] = productSlug.trim();

  const product = await Product.findOne(productQuery)
    .select({ __v: 0 })
    .lean<LeanProduct | null>()
    .exec();

  if (!product) {
    return null;
  }

  return serializeProduct(product);
}
