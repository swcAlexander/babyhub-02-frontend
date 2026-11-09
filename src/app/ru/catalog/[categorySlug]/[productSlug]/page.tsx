import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getProductBySlug } from '@/services/product.service';

export const dynamic = 'force-dynamic';

const availabilityLabels: Record<string, string> = {
  in_stock: 'В наличии',
  on_order: 'Под заказ',
  out_of_stock: 'Нет в наличии',
};

export default async function RuProductPage({
  params,
}: {
  params: { categorySlug: string; productSlug: string };
}) {
  const product = await getProductBySlug(params.categorySlug, params.productSlug, 'ru');

  if (!product || !product.name.ru || !product.slug.ru || product.name.ru.trim() === '' || product.slug.ru.trim() === '') {
    notFound();
  }

  const shortDescription = typeof product.shortDescription?.ru === 'string' && product.shortDescription.ru.trim() !== '' ? product.shortDescription.ru : null;
  const description = typeof product.description?.ru === 'string' && product.description.ru.trim() !== '' ? product.description.ru : null;
  const salePrice = typeof product.pricing?.salePrice === 'number' && Number.isFinite(product.pricing.salePrice) ? product.pricing.salePrice : null;
  const availability = availabilityLabels[product.availability] ?? null;
  const attributes = Array.isArray(product.attributes)
    ? product.attributes.filter(
        (attribute) =>
          typeof attribute?.key?.ru === 'string' &&
          attribute.key.ru.trim() !== '' &&
          typeof attribute?.value?.ru === 'string' &&
          attribute.value.ru.trim() !== ''
      )
    : [];

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <Link href={`/ru/catalog/${params.categorySlug}`} style={{ display: 'inline-block', marginBottom: '24px' }}>
        Вернуться к категории
      </Link>

      <article>
        <h1 style={{ marginBottom: '12px' }}>{product.name.ru}</h1>

        {shortDescription ? <p style={{ marginBottom: '16px' }}>{shortDescription}</p> : null}

        {availability ? (
          <div style={{ marginBottom: '20px' }}>
            <strong>Доступность:</strong> {availability}
          </div>
        ) : null}

        {salePrice !== null ? (
          <div style={{ marginBottom: '20px' }}>
            <strong>Цена:</strong> {salePrice} {product.pricing.currency}
          </div>
        ) : null}

        {description ? (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '12px' }}>Описание</h2>
            <p>{description}</p>
          </div>
        ) : null}

        {attributes.length > 0 ? (
          <div>
            <h2 style={{ marginBottom: '12px' }}>Характеристики</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {attributes.map((attribute, index) => (
                <li key={`${attribute.key.ru}-${index}`} style={{ marginBottom: '8px' }}>
                  <strong>{attribute.key.ru}:</strong> {attribute.value.ru}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </main>
  );
}
