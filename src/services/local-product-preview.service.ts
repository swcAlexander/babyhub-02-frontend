import 'server-only';
import mongoose from 'mongoose';

const DATABASE = 'db-babyhub-test';
const PRODUCT_ID = '1e9f418c65cc80c3d3a56184';
const PRODUCT_SLUG = 'avtokreslo-adbor-capri';
const MEDIA_ID = '2f19079efd10749817072a2d';

type PreviewProduct = {
  name?: { uk?: string };
  slug?: { uk?: string };
  status?: string;
  category?: mongoose.Types.ObjectId;
  images?: mongoose.Types.ObjectId[];
  shortDescription?: { uk?: string };
  description?: { uk?: string };
};

type PreviewMedia = {
  url: string;
  width: number;
  height: number;
  alt?: { uk?: string };
};

// This deliberately does not import the public services or their shared DB_HOST connection.
export async function getLocalProductPreview(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'development') return null;

  const uri = env.DB_HOST_TEST?.trim();
  try {
    if (!uri) throw new Error();
    const parsed = new URL(uri);
    const databasePath = decodeURIComponent(parsed.pathname);
    if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol) ||
        !['', '/', `/${DATABASE}`].includes(databasePath)) throw new Error();
  } catch {
    throw new Error('Local preview requires DB_HOST_TEST with database db-babyhub-test.');
  }

  let connection: mongoose.Connection | undefined;
  try {
    connection = mongoose.createConnection(uri, {
      dbName: DATABASE,
      autoIndex: false,
      autoCreate: false,
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
    });
    await connection.asPromise();
    const db = connection.db;
    if (!db || db.databaseName !== DATABASE) throw new Error();

    // Native reads avoid model initialization, index creation and the default connection.
    const product = await db.collection<PreviewProduct>('products').findOne({
      _id: new mongoose.Types.ObjectId(PRODUCT_ID),
      'slug.uk': PRODUCT_SLUG,
      status: 'draft',
    });
    if (!product?.name?.uk?.trim() || !product.category) return null;
    const category = await db.collection('categories').findOne({
      _id: product.category,
      status: 'draft',
    }, { projection: { _id: 1 } });
    if (!category || !product.images?.some((id) => id.toString() === MEDIA_ID)) return null;

    const media = await db.collection<PreviewMedia>('media').findOne({
      _id: new mongoose.Types.ObjectId(MEDIA_ID),
    }, { projection: { url: 1, width: 1, height: 1, alt: 1 } });
    if (!media) throw new Error();
    const imageUrl = new URL(media.url);
    if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'res.cloudinary.com' ||
        !imageUrl.pathname.startsWith('/dmvl4lxnq/image/upload/') ||
        imageUrl.username || imageUrl.password || imageUrl.port ||
        !Number.isInteger(media.width) || media.width <= 0 ||
        !Number.isInteger(media.height) || media.height <= 0) throw new Error();

    return {
      id: product._id.toString(),
      name: product.name.uk,
      shortDescription: product.shortDescription?.uk,
      description: product.description?.uk,
      image: { url: media.url, width: media.width, height: media.height, alt: media.alt?.uk || product.name.uk },
    };
  } catch {
    // Do not expose credentials or raw driver errors in the Next.js overlay/logs.
    throw new Error('Local preview could not read the expected test product and Media.');
  } finally {
    await connection?.close();
  }
}
