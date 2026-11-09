import styles from './page.module.css';

export default function RegisterPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Створи аккаунт</p>
          <h1>Реєстрація для нових батьків</h1>
          <p>Збережіть свої переваги, відстежуйте замовлення й отримуйте персональні пропозиції.</p>
        </div>

        <form className={styles.form}>
          <label>
            <span>Ім&apos;я</span>
            <input type="text" name="name" placeholder="Ваше ім&apos;я" />
          </label>
          <label>
            <span>Email</span>
            <input type="email" name="email" placeholder="name@example.com" />
          </label>
          <label>
            <span>Пароль</span>
            <input type="password" name="password" placeholder="Не менше 8 символів" />
          </label>
          <button type="submit">Зареєструватися</button>
        </form>
      </section>
    </main>
  );
}
