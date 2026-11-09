import { notFound } from 'next/navigation';

import { getCategoryBySlug } from '@/services/category.service';
import { getPublishedProducts } from '@/services/product.service';

export const dynamic = 'force-dynamic';

export default async function RuCategoryPage({ params }: { params: { categorySlug: string } }) {
  const category = await getCategoryBySlug(params.categorySlug, 'ru');

  if (!category || !category.name.ru || !category.slug.ru) {
    notFound();
  }

  const { data: products } = await getPublishedProducts({
    category: params.categorySlug,
    locale: 'ru',
  });

  const validProducts = products.filter(
    (product) =>
      typeof product.name?.ru === 'string' &&
      product.name.ru.trim() !== '' &&
      typeof product.slug?.ru === 'string' &&
      product.slug.ru.trim() !== ''
  );

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <h1 style={{ marginBottom: '12px' }}>{category.name.ru}</h1>

      {validProducts.length === 0 ? (
        <p>В этой категории сейчас нет доступных товаров</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '16px' }}>
          {validProducts.map((product) => (
            <li key={product.id}>
              <a href={`/ru/catalog/${category.slug.ru}/${product.slug.ru}`}>
                {product.name.ru}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
