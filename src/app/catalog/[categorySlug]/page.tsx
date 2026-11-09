import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getCategoryBySlug } from '@/services/category.service';
import { getPublishedProducts } from '@/services/product.service';

export const dynamic = 'force-dynamic';

const normalizePageParam = (value: string | string[] | undefined): number => {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (typeof rawValue !== 'string') return 1;

  const trimmed = rawValue.trim();
  if (!/^(?:0|[1-9]\d*)$/.test(trimmed)) {
    return 1;
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams?: { page?: string | string[] };
}) {
  const category = await getCategoryBySlug(params.categorySlug, 'uk');

  if (!category) {
    notFound();
  }

  const page = normalizePageParam(searchParams?.page);

  const result = await getPublishedProducts({
    category: params.categorySlug,
    locale: 'uk',
    page,
  });

  if (result.pagination.total === 0) {
    return (
      <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
        <h1 style={{ marginBottom: '12px' }}>{category.name.uk}</h1>
        <p>У цій категорії зараз немає доступних товарів.</p>
      </main>
    );
  }

  if (page > result.pagination.totalPages) {
    notFound();
  }

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <h1 style={{ marginBottom: '12px' }}>{category.name.uk}</h1>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '16px' }}>
        {result.data.map((product) => (
          <li key={product.id}>
            <Link href={`/catalog/${params.categorySlug}/${product.slug.uk}`}>
              {product.name.uk}
            </Link>
          </li>
        ))}
      </ul>

      {result.pagination.totalPages > 1 ? (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {page > 1 ? (
            <Link href={page === 2 ? `/catalog/${params.categorySlug}` : `/catalog/${params.categorySlug}?page=${page - 1}`}>
              Попередня
            </Link>
          ) : null}

          <span>
            Сторінка {page} із {result.pagination.totalPages}
          </span>

          {page < result.pagination.totalPages ? (
            <Link href={`/catalog/${params.categorySlug}?page=${page + 1}`}>Наступна</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
