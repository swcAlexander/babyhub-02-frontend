import { HttpError } from '../helpers/index.js';
import ctrlWrapper from '../decorators/ctrlWrapper.js';
import Article from '../models/articles.js';

type RequestLike = {
  body?: Record<string, any>;
  user?: { subscription?: string };
  params?: { articleId?: string };
};

const articleModel = Article as any;

const getAll = async (req: RequestLike, res: any) => {
  const result = await articleModel.getAll();
  res.status(201).json(result);
};

const getById = async (req: RequestLike, res: any) => {
  const { title } = req.body ?? {};
  const result = await articleModel.findOne({ title });
  res.status(201).json(result);
};

const add = async (req: RequestLike, res: any) => {
  const { subscription } = req.user ?? {};
  if (subscription !== 'admin') throw HttpError(403);
  const result = await articleModel.create({ ...(req.body ?? {}) });
  res.status(201).json(result);
};

const updateById = async (req: RequestLike, res: any) => {
  const { subscription } = req.user ?? {};
  if (subscription !== 'admin') throw HttpError(403);
  const { articleId } = req.params ?? {};
  const result = await articleModel.findByIdAndUpdate({ _id: articleId }, req.body ?? {}, {
    new: true,
  });
  res.status(201).json(result);
};

const deleteById = async (req: RequestLike, res: any) => {
  const { subscription } = req.user ?? {};
  if (subscription !== 'admin') throw HttpError(403);
  const { articleId } = req.params ?? {};
  const result = await articleModel.findOneAndDelete({ _id: articleId });
  if (!result) {
    throw HttpError(404);
  }
  res.status(204).send();
};

export default {
  getAll: ctrlWrapper(getAll),
  getById: ctrlWrapper(getById),
  add: ctrlWrapper(add),
  updateById: ctrlWrapper(updateById),
  deleteById: ctrlWrapper(deleteById),
};
