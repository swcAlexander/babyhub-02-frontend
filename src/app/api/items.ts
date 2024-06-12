import { NextApiRequest, NextApiResponse } from 'next';
import controllers from './controllers/itemController'


const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method === 'GET') {
    return controllers.getAll(req, res);
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
};

export default handler;

// import clientPromise from '../../lib/mongodb';

// export default async function handler(req, res) {
//   try {
//     const client = await clientPromise;
//     const db = client.db('your-database-name');

//     switch (req.method) {
//       case 'GET':
//         const data = await db.collection('your-collection-name').find({}).toArray();
//         res.status(200).json(data);
//         break;
//       case 'POST':
//         const newData = req.body;
//         await db.collection('your-collection-name').insertOne(newData);
//         res.status(201).json({ message: 'Data inserted successfully' });
//         break;
//       default:
//         res.status(405).end(); // Method Not Allowed
//         break;
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// }