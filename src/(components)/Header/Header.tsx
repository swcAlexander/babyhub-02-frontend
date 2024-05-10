'use client'
import styles from './header.module.css';

interface HeaderProps {
  title: string;
}
const Header = ({ title }: HeaderProps) => {

  return (
    <header className={styles.site_header}>
      <h2>{title}</h2>
      <div className={styles.navigation}>
        <ul className={styles.nav}>
          <li className={styles.nav_item}><a href="#">Головна</a></li>
          <li className={styles.nav_item}><a href="#">Переклади</a></li>
          <li className={styles.nav_item}><a href="#">Статті</a></li>
          <li className={styles.nav_item}><a href="#">Про переклад</a></li>
          <li className={styles.nav_item}><a href="#">Контакти</a></li>
        </ul>
      </div>

      <input type="checkbox" id="nav-trigger" className={styles.nav_trigger} />
      <label htmlFor="nav-trigger" className={styles.label_checkbox}></label>

    </header>
  );
};
export default Header;
