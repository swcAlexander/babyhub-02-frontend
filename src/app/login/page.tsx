import styles from './page.module.css';

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Ласкаво просимо</p>
          <h1>Увійдіть в особистий кабінет</h1>
          <p>Керуйте орендою, переглядайте замовлення та зберігайте улюблені товари.</p>
        </div>

        <form className={styles.form}>
          <label>
            <span>Email</span>
            <input type="email" name="email" placeholder="name@example.com" />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" name="password" placeholder="••••••••" />
          </label>
          <button type="submit">Увійти</button>
        </form>
      </section>
    </main>
  );
}
