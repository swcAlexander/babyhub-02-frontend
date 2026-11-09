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

export default async function RuCategoryPage({
  params,
  searchParams,
}: {
  params: { categorySlug: string };
  searchParams?: { page?: string | string[] };
}) {
  const category = await getCategoryBySlug(params.categorySlug, 'ru');

  if (!category || !category.name.ru || !category.slug.ru) {
    notFound();
  }

  const page = normalizePageParam(searchParams?.page);

  const result = await getPublishedProducts({
    category: params.categorySlug,
    locale: 'ru',
    page,
  });

  if (result.pagination.total === 0) {
    return (
      <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
        <h1 style={{ marginBottom: '12px' }}>{category.name.ru}</h1>
        <p>В этой категории сейчас нет доступных товаров</p>
      </main>
    );
  }

  if (page > result.pagination.totalPages) {
    notFound();
  }

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <h1 style={{ marginBottom: '12px' }}>{category.name.ru}</h1>

      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'grid', gap: '16px' }}>
        {result.data.map((product) => (
          <li key={product.id}>
            <Link href={`/ru/catalog/${category.slug.ru}/${product.slug.ru}`}>
              {product.name.ru}
            </Link>
          </li>
        ))}
      </ul>

      {result.pagination.totalPages > 1 ? (
        <nav aria-label="Pagination" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {page > 1 ? (
            <Link href={page === 2 ? `/ru/catalog/${category.slug.ru}` : `/ru/catalog/${category.slug.ru}?page=${page - 1}`}>
              Предыдущая
            </Link>
          ) : null}

          <span>
            Страница {page} из {result.pagination.totalPages}
          </span>

          {page < result.pagination.totalPages ? (
            <Link href={`/ru/catalog/${category.slug.ru}?page=${page + 1}`}>Следующая</Link>
          ) : null}
        </nav>
      ) : null}
    </main>
  );
}
