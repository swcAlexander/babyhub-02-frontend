import styles from './page.module.css';
export default function Home() {
  return (
    <main className={styles.main_page}>
      <h2>Register an account</h2>
      <form className={styles.modal__form}>
        <ul className={styles.modal__list}>
          <li className={styles.modal__item}>
            <label className={styles.modal__label}>
              <span className={styles.modal__text}>Ім'я</span>
              <input
                type="text"
                name="imput-name"
                className={styles.modal__input}
              />
              <svg className={styles.modal__icon}>
                <use
                  href="./images/icons.svg#icon-person-black"
                  width="18"
                  height="18"></use>
              </svg>
            </label>
          </li>
          <li className={styles.modal__item}>
            <label className={styles.modal__label}>
              <span className={styles.modal__text}>Телефон</span>
              <input
                type="tel"
                name="imput-phone"
                className={styles.modal__input}
              />
              <svg className={styles.modal__icon}>
                <use
                  href="./images/icons.svg#icon-phone-black"
                  width="18"
                  height="18"></use>
              </svg>
            </label>
          </li>
          <li className={styles.modal__item}>
            <label className={styles.modal__label}>
              <span className={styles.modal__text}>Пошта</span>
              <input
                type="email"
                name="imput-email"
                className={styles.modal__input}
              />
              <svg className={styles.modal__icon}>
                <use
                  href="./images/icons.svg#icon-email-black"
                  width="18"
                  height="18"></use>
              </svg>
            </label>
          </li>
<li className={styles.modal__item}>
            <label className={styles.modal__label}>
              <span className={styles.modal__text}>Придумайте пароль</span>
              <input
                type="email"
                name="imput-email"
                className={styles.modal__input}
              />
              <svg className={styles.modal__icon}>
                <use
                  href="./images/icons.svg#icon-email-black"
                  width="18"
                  height="18"></use>
              </svg>
            </label>
          </li>
        </ul>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            className={[styles.checkbox__input, styles.hidden]}
          />
          <span className={styles.checkbox__text}>
            Погоджуюся з розсилкою та приймаю
            <a href="/" className={styles.checkbox__link}>
              Умови договору
            </a>
          </span>
        </label>
        <button type="submit" className={styles.modal__send}>
          <span className="">Відправити</span>
        </button>
      </form>
    </main>
  );
}
