import Image from 'next/image';
import styles from './page.module.css';
export default function Home() {
  return (
    <main className={styles.main_page}>
      <Image
        src="/Logo-01@01.png"
        width="327"
        height="334"
        alt="Logo"
        className={styles.centred}></Image>
      <h1 className={styles.title}>Babyhub</h1>
      <button type="button" className={styles.log_button}>
        <a href="/register">Sign up</a>
      </button>
      <button type="button" className={styles.log_button}>
        <a href="/login">Login</a>
      </button>
    </main>
  );
}
