
import Image from 'next/image';
import styles from './page.module.css';
import controller from '@/(api)/controllers/itemController';

interface Item {
  _id: string;
  name: string;
  // Інші поля, які містяться у вашій моделі Item
}

interface HomeProps {
  catalog: Item[];
}

interface CustomRequest extends Request {
  query: {
    [key: string]: string | undefined;
  };
  user: {
    _id: string;
    subscription: string;
  };
  file: {
    path: string;
  };
  params: {
    itemId: string;
  };
}

const fetchCatalog = async (): Promise<Item[]> => {
  try {
    const req = {
      query: { page: '1', limit: '20' },
      user: { _id: '', subscription: '' },
      file: { path: '' },
      params: { itemId: '' },
      get: (header: string) => '',
      headers: {},
      accepts: () => false,
      acceptsCharsets: () => false,
      acceptsEncodings: () => false,
      acceptsLanguages: () => false,
      is: () => false,
      header: () => '',
    } as Partial<Request> as CustomRequest;

    const res = {
      status: () => ({
        json: (result: Item[]) => {
          catalog = result;
        },
      }),
    } as unknown as Response;

    let catalog: Item[] = [];
    await controller.getAll(req, res, null);
    return catalog;
  } catch (error) {
    console.error("Error fetching catalog:", error);
    return [];
  }
};


const Home = ({ catalog }: HomeProps) => {
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
        {catalog.map((item) => (
          <li key={item._id}>{item.name}</li>
        ))}
      </ul>
    </main>
  );
};

export default Home;