import fs from 'fs/promises';
import { HttpError, cloudinary } from '../helpers/index.js';
import { ctrlWrapper } from '../decorators/index.js';
import Item from '../models/items.js';

const getAll = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const result = await Item.find({}, '-createdAt -updatedAt', {
    skip,
    limit,
  }).populate('owner', 'name email');
  res.status(200).json(result);
};

const getFavorite = async (req, res) => {};

const getById = async (req, res) => {
  const { _id: owner } = req.user;
  const { itemId } = req.params;
  const result = await Item.findOne({ _id: itemId, owner });
  if (!result) {
    throw HttpError(404);
  }
  res.json(result);
};

const add = async (req, res) => {
  // const { _id: owner, subscription } = req.user;
  const { path: oldPath } = req.file;
  const { url: poster } = await cloudinary.uploader.upload(oldPath, {
    folder: 'items',
  });
  await fs.unlink(oldPath);
  const result = await Item.create({ ...req.body, poster });
  res.status(201).json(result);
  // if (subscription === 'admin') {
  //   const { url: poster } = await cloudinary.uploader.upload(oldPath, {
  //     folder: 'items',
  //   });
  //   await fs.unlink(oldPath);
  //   const result = await Item.create({ ...req.body, poster, owner });
  //   res.status(201).json(result);
  // } else {
  //   throw HttpError(403);
  // }
};

const updateById = async (req, res) => {
  const { _id: owner, subscription } = req.user;
  const { itemId } = req.params;
  if (subscription === 'admin') {
    const result = await Item.findOneAndUpdate(
      { _id: itemId, owner },
      req.body,
      {
        new: true,
      }
    );
    res.status(201).json(result);
  } else {
    throw HttpError(403);
  }
};

const deleteById = async (req, res) => {
  const { _id: owner, subscription } = req.user;
  const { itemId } = req.params;
  if (subscription !== 'admin') throw HttpError(403);
  const result = await Item.findOneAndDelete({ _id: itemId, owner });
  if (!result) {
    throw HttpError(404);
  }
  res.status(204).send();
};

export default {
  getAll: ctrlWrapper(getAll),
  getFavorite: ctrlWrapper(getFavorite),
  getById: ctrlWrapper(getById),
  add: ctrlWrapper(add),
  updateById: ctrlWrapper(updateById),
  deleteById: ctrlWrapper(deleteById),
};
