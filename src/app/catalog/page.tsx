import Link from 'next/link';

import { getPublishedCategories } from '@/services/category.service';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const categories = await getPublishedCategories('uk');

  const validCategories = categories.filter((category) => typeof category.slug.uk === 'string' && category.slug.uk.trim().length > 0);

  return (
    <main className={styles.page}>
      <section className={styles.headerSection}>
        <p className={styles.eyebrow}>Каталог</p>
        <h1>Обирай найкраще для малюка.</h1>
      </section>

      {validCategories.length === 0 ? (
        <p>Наразі немає доступних категорій у каталозі.</p>
      ) : (
        <section className={styles.productsGrid}>
          {validCategories.map((category) => (
            <article key={category.id} className={styles.card}>
              <div className={styles.imagePlaceholder} aria-hidden="true" />
              <h2>
                <Link href={`/catalog/${category.slug.uk}`}>{category.name.uk}</Link>
              </h2>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
