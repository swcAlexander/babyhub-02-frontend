import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getProductBySlug } from '@/services/product.service';

export const dynamic = 'force-dynamic';

const availabilityLabels: Record<string, string> = {
  in_stock: 'В наявності',
  on_order: 'Під замовлення',
  out_of_stock: 'Немає в наявності',
};

export default async function ProductPage({
  params,
}: {
  params: { categorySlug: string; productSlug: string };
}) {
  const product = await getProductBySlug(params.categorySlug, params.productSlug, 'uk');

  if (!product || !product.name.uk || !product.slug.uk || product.name.uk.trim() === '' || product.slug.uk.trim() === '') {
    notFound();
  }

  const shortDescription = typeof product.shortDescription?.uk === 'string' && product.shortDescription.uk.trim() !== '' ? product.shortDescription.uk : null;
  const description = typeof product.description?.uk === 'string' && product.description.uk.trim() !== '' ? product.description.uk : null;
  const salePrice = typeof product.pricing?.salePrice === 'number' && Number.isFinite(product.pricing.salePrice) ? product.pricing.salePrice : null;
  const availability = availabilityLabels[product.availability] ?? product.availability;
  const attributes = Array.isArray(product.attributes)
    ? product.attributes.filter(
        (attribute) =>
          typeof attribute?.key?.uk === 'string' &&
          attribute.key.uk.trim() !== '' &&
          typeof attribute?.value?.uk === 'string' &&
          attribute.value.uk.trim() !== ''
      )
    : [];

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <Link href={`/catalog/${params.categorySlug}`} style={{ display: 'inline-block', marginBottom: '24px' }}>
        Повернутися до категорії
      </Link>

      <article>
        <h1 style={{ marginBottom: '12px' }}>{product.name.uk}</h1>

        {shortDescription ? <p style={{ marginBottom: '16px' }}>{shortDescription}</p> : null}

        <div style={{ marginBottom: '20px' }}>
          <strong>Доступність:</strong> {availability}
        </div>

        {salePrice !== null ? (
          <div style={{ marginBottom: '20px' }}>
            <strong>Ціна:</strong> {salePrice} {product.pricing.currency}
          </div>
        ) : null}

        {description ? (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ marginBottom: '12px' }}>Опис</h2>
            <p>{description}</p>
          </div>
        ) : null}

        {attributes.length > 0 ? (
          <div>
            <h2 style={{ marginBottom: '12px' }}>Характеристики</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {attributes.map((attribute, index) => (
                <li key={`${attribute.key.uk}-${index}`} style={{ marginBottom: '8px' }}>
                  <strong>{attribute.key.uk}:</strong> {attribute.value.uk}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </article>
    </main>
  );
}
