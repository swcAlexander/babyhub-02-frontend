import Link from 'next/link';

import { getPublishedCategories } from '@/services/category.service';

export const dynamic = 'force-dynamic';

export default async function RuCatalogPage() {
  const categories = await getPublishedCategories('ru');

  const visibleCategories = categories.filter(
    (category) => typeof category.name.ru === 'string' && category.name.ru.trim().length > 0 && typeof category.slug.ru === 'string' && category.slug.ru.trim().length > 0
  );

  return (
    <main style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto', padding: '60px 0 88px' }}>
      <section style={{ marginBottom: '36px' }}>
        <p style={{ margin: '0 0 16px', color: '#ff8fab', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
          Каталог
        </p>
        <h1 style={{ margin: 0, color: '#10233a', fontSize: 'clamp(2.4rem, 4vw, 4rem)', lineHeight: 1, letterSpacing: '-0.06em' }}>
          Выбирайте лучшее для малыша.
        </h1>
      </section>

      {visibleCategories.length === 0 ? (
        <p>Сейчас нет доступных категорий в каталоге.</p>
      ) : (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '24px' }}>
          {visibleCategories.map((category) => (
            <article key={category.id} style={{ padding: '18px', borderRadius: '28px', background: 'rgba(255, 255, 255, 0.7)', border: '1px solid rgba(16, 35, 58, 0.08)', boxShadow: '0 18px 32px rgba(16, 35, 58, 0.04)' }}>
              <div aria-hidden="true" style={{ height: '180px', marginTop: '18px', borderRadius: '22px', background: 'linear-gradient(135deg, #dff8ff, #ffebc3)' }} />
              <h2 style={{ margin: '18px 0 8px', color: '#10233a', fontSize: '1.3rem' }}>
                <Link href={`/ru/catalog/${category.slug.ru}`}>{category.name.ru}</Link>
              </h2>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
