import Link from 'next/link';
import styles from './header.module.css';

const navItems = [
  { label: 'Головна', href: '/' },
  { label: 'Каталог', href: '/catalog' },
  { label: 'Про нас', href: '/about' },
  { label: 'Контакти', href: '#contacts' },
];

export default function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>B</span>
          BabyHub
        </Link>

        <nav className={styles.nav} aria-label="Основна навігація">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link href="/login" className={styles.secondaryButton}>
            Увійти
          </Link>
          <Link href="/register" className={styles.primaryButton}>
            Реєстрація
          </Link>
        </div>
      </div>
    </header>
  );
}
