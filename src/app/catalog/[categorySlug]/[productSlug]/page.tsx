import { notFound } from 'next/navigation';

const validProducts = ['kolyaska-2-v-1', 'avtokrislo-2'];

export default function ProductPage({ params }: { params: { categorySlug: string; productSlug: string } }) {
  if (!params.categorySlug || !validProducts.includes(params.productSlug)) {
    notFound();
  }

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '56px 0 88px' }}>
      <h1 style={{ marginBottom: '12px' }}>Товар: {params.productSlug}</h1>
      <p>Це базова сторінка товару. Подальший контент буде підвантажуватися з даних CMS.</p>
    </main>
  );
}
