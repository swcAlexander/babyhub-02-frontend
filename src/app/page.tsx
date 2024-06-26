'use client'
import Image from 'next/image';
import styles from './page.module.css';
import { useEffect, useState } from 'react';

interface ItemType {
  _id: string;
  title: string;
}

const Home = () => {
  const [catalog, setCatalog] = useState<ItemType[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('./api/items');
        const data: ItemType[] = await response.json();
        console.log(data, 'data')
        setCatalog(data);
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, []);
  console.log(catalog, 'catalog')

  return (
    <main className={styles.main_page}>
      <Image
        src="/Logo-01@01.png"
        width="327"
        height="334"
        alt="Logo"
        className={styles.centred}
      />
      <h1 className={styles.title}>Babyhub</h1>
      <button type="button" className={styles.log_button}>
        <a href="/register">Sign up</a>
      </button>
      <button type="button" className={styles.log_button}>
        <a href="/login">Login</a>
      </button>
      <ul>
        {catalog.map((itemka: ItemType) => (
          <li key={itemka._id}>{itemka.title}</li>
        ))}
      </ul>
    </main>
  );
};

export default Home;
