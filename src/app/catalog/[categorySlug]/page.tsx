import { notFound } from 'next/navigation';

import { getCategoryBySlug } from '@/services/category.service';
import { getPublishedProducts } from '@/services/product.service';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({ params }: { params: { categorySlug: string } }) {
  const category = await getCategoryBySlug(params.categorySlug, 'uk');

  if (!category) {
    notFound();
  }

  const { data: products } = await getPublishedProducts({
    category: params.categorySlug,
    locale: 'uk',
  });

  const validProducts = products.filter(
    (product) =>
      typeof product.name?.uk === 'string' &&
      product.name.uk.trim() !== '' &&
      typeof product.slug?.uk === 'string' &&
      product.slug.uk.trim() !== ''
  );

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <h1 style={{ marginBottom: '12px' }}>{category.name.uk}</h1>

      {validProducts.length === 0 ? (
        <p>У цій категорії зараз немає доступних товарів.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '16px' }}>
          {validProducts.map((product) => (
            <li key={product.id}>
              <a href={`/catalog/${params.categorySlug}/${product.slug.uk}`}>
                {product.name.uk}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
