import {HttpError} from '../helpers/index.js';
import ctrlWrapper from '../decorators/ctrlWrapper.js';
import Article from '../models/articles.js';

const getAll = async (req, res) => {
  const result = await Article.getAll();
  res.status(201).json(result);
};
const getById = async (req, res) => {
  const { title } = req.body;
  const result = await Article.findOne({ title });
  res.status(201).json(result);
};
const add = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const result = await Article.create({ ...req.body });
  res.status(201).json(result);
};
const updateById = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { articleId } = req.params;
  const result = await Article.findByIdAndUpdate({ _id: articleId }, req.body, {
    new: true,
  });
  res.status(201).json(result);
};
const deleteById = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { articleId } = req.params;
  const result = await Article.findOneAndDelete({ _id: articleId });
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
