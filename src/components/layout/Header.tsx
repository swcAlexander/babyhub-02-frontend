import Link from 'next/link';
import { buildLocalizedPath, type Locale } from '@/lib/locale';

const navItems = [
  { label: 'Головна', href: '/' },
  { label: 'Каталог', href: '/catalog' },
  { label: 'Про нас', href: '/about' },
  { label: 'Контакти', href: '/contacts' },
];

export default function Header({ locale = 'uk' }: { locale?: Locale }) {
  return (
    <header className="header">
      <div className="header__inner">
        <Link href={buildLocalizedPath(locale, '/')} className="header__brand">
          <span className="header__brandMark">B</span>
          BabyHub
        </Link>

        <nav className="header__nav" aria-label="Основна навігація">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={buildLocalizedPath(locale, item.href)}
              className="header__navLink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header__actions">
          <Link href="/login" className="header__secondaryButton">
            Увійти
          </Link>
          <Link href="/register" className="header__primaryButton">
            Реєстрація
          </Link>
        </div>
      </div>
    </header>
  );
}
