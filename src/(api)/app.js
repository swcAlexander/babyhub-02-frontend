import express from 'express';
import logger from 'morgan';
import cors from 'cors';
import 'dotenv/config';

import itemRouter from './routes/itemRouter.js';
import authRouter from './routes/authRouter.js';
import articleRouter from './routes/articleRouter.js';

const app = express();

const formatLogger = app.get('env') === 'development' ? 'dev' : 'short';

app.use(logger(formatLogger));
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/items', itemRouter);
app.use('/api/users', authRouter);
app.use('/api/article', articleRouter);

app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  const { status = 500, message = 'Server Error' } = err;
  res.status(status).json({ message });
});

export default app;
