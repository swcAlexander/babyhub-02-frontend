import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.scss';

const features = [
  {
    title: 'Швидка оренда',
    description: 'Багатий каталог дитячих товарів для будь-якого етапу життя малюка.',
  },
  {
    title: 'Гарантія якості',
    description: 'Перевіряємо кожен товар перед відправленням і ретельно готуємо до доставки.',
  },
  {
    title: 'Підтримка 24/7',
    description: 'Порадимо з розміром, стилем і термінами оренди без зайвої тяганини.',
  },
];

const catalogHighlights = [
  { name: 'Стульчики', price: 'від 180 ₴/день', tone: 'pink' },
  { name: 'Коляски', price: 'від 420 ₴/день', tone: 'gold' },
  { name: 'Постільна', price: 'від 90 ₴/день', tone: 'mint' },
  { name: 'Іграшки', price: 'від 70 ₴/день', tone: 'blue' },
];

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Комфорт для малюка, економія для батьків</p>
          <h1>Все необхідне для дитини — зручно, якісно і без зайвих витрат.</h1>
          <p className={styles.lead}>
            BabyHub — сервіс оренди та продажу дитячих товарів: від колясок і автокрісел до
            іграшок, постільної білизни та аксесуарів для розвитку.
          </p>

          <div className={styles.heroActions}>
            <Link href="/catalog" className={styles.primaryButton}>
              Переглянути каталог
            </Link>
            <Link href="/about" className={styles.secondaryButton}>
              Дізнатися більше
            </Link>
          </div>

          <ul className={styles.stats}>
            <li>
              <strong>2.4k+</strong>
              <span>щасливих сімей</span>
            </li>
            <li>
              <strong>4.9/5</strong>
              <span>середня оцінка</span>
            </li>
            <li>
              <strong>48h</strong>
              <span>доставка по місті</span>
            </li>
          </ul>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.visualCardLarge}>
            <Image src="/Logo-01@01.png" alt="BabyHub logo" width={220} height={220} />
            <div>
              <p>Топ-товари тижня</p>
              <strong>Коляски і автокрісла</strong>
            </div>
          </div>

          <div className={styles.visualCardSmall}>
            <span>Новинка</span>
            <strong>Супер комфорт</strong>
            <em>до -20%</em>
          </div>
        </div>
      </section>

      <section className={styles.features}>
        {features.map((feature) => (
          <article key={feature.title} className={styles.featureCard}>
            <div className={styles.featureBadge} aria-hidden="true" />
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeader}>
          <p className={styles.eyebrow}>Популярні категорії</p>
          <h2>Обирайте речі для кожного етапу життя малюка.</h2>
        </div>

        <div className={styles.catalogGrid}>
          {catalogHighlights.map((item) => (
            <article key={item.name} className={`${styles.catalogCard} ${styles[item.tone]}`}>
              <div className={styles.cardTopline}>
                <span className={styles.cardTag}>Найбільш купують</span>
              </div>
              <h3>{item.name}</h3>
              <p>{item.price}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.storySection}>
        <div className={styles.storyText}>
          <p className={styles.eyebrow}>Чому сім&apos;ї обирають нас</p>
          <h2>Ми робимо батьківство простішим і спокійнішим.</h2>
          <p>
            Ми підбираємо товари, які допомагають зручно організувати побут, не перевантажуючи
            бюджет. У кожній позиції — перевірена якість, ясні умови оренди та уважний сервіс.
          </p>
        </div>

        <div className={styles.storyGrid}>
          <div>
            <strong>300+</strong>
            <span>категорій товарів</span>
          </div>
          <div>
            <strong>12k+</strong>
            <span>проданих позицій</span>
          </div>
          <div>
            <strong>99%</strong>
            <span>повторних замовлень</span>
          </div>
        </div>
      </section>
    </main>
  );
}
