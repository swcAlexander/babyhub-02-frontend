import styles from './page.module.css';

const values = [
  'Координуємо оренду та покупку товарів для дітей від 0 до 12 років.',
  'Перевіряємо кожен товар перед відправленням або видачею.',
  'Працюємо прозоро: чіткі терміни, чесні ціни та зручний сервіс.',
];

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Про BabyHub</p>
          <h1>Зручний сервіс для сімей, які хочуть економити і живуть в ритмі малюка.</h1>
        </div>
        <div className={styles.infoCard}>
          <strong>6 років</strong>
          <span>на ринку дитячих товарів</span>
        </div>
      </section>

      <section className={styles.content}>
        <div className={styles.textBlock}>
          <h2>Ми створили простір, де батьки можуть знайти все необхідне для дитини без зайвих витрат.</h2>
          <p>
            BabyHub об&apos;єднує дитячі речі, аксесуари та товари для розвитку в одному місці. Ми
            допомагаємо тим, хто хоче дати малюкові комфорт, але не хоче переплачувати за товари,
            які потрібні лише на певний період життя.
          </p>
        </div>

        <ul className={styles.list}>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
