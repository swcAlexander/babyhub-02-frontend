import ProductPage from '../../../catalog/[categorySlug]/[productSlug]/page';

export default function RuProductPage({ params }: { params: { categorySlug: string; productSlug: string } }) {
  return <ProductPage params={params} />;
}
