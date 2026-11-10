import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Локальний перегляд — Adbor Capri',
  robots: { index: false, follow: false },
};

export default async function LocalProductPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();

  const { getLocalProductPreview } = await import('@/services/local-product-preview.service');
  const product = await getLocalProductPreview();
  if (!product) notFound();

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <p style={{ marginBottom: 24 }}>Локальний перегляд чернетки · тестова база</p>
      <article>
        <h1 style={{ marginBottom: 24 }}>{product.name}</h1>
        <Image
          src={product.image.url}
          alt={product.image.alt}
          width={product.image.width}
          height={product.image.height}
          sizes="249px"
          priority
          style={{ maxWidth: '100%', height: 'auto', marginBottom: 24 }}
        />
        {product.shortDescription ? <p>{product.shortDescription}</p> : null}
        {product.description ? <p style={{ whiteSpace: 'pre-line', marginTop: 16 }}>{product.description}</p> : null}
      </article>
    </main>
  );
}
