import fs from 'fs/promises';
import { HttpError, cloudinary } from '../helpers/index.js';
import { ctrlWrapper } from '../decorators/index.js';
import Item from '../models/items.ts';
import { Request, Response } from 'express';

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

const getAll: (req: any, res: any, next: any) => Promise<void> = async (req, res) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const result = await Item.find({}, '-createdAt -updatedAt', {
      skip,
      limit: parseInt(limit),
    }).populate('owner', 'name email');
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server Error' });
  }
};

const getById = async (req: CustomRequest, res: Response): Promise<void> => {
  const { _id: owner } = req.user;
  const { itemId } = req.params;
  const result = await Item.findOne({ _id: itemId, owner });
  if (!result) {
    throw HttpError(404);
  }
  res.json(result);
};

const add = async (req: CustomRequest, res: Response): Promise<void> => {
  const { path: oldPath } = req.file;
  const { url: poster } = await cloudinary.uploader.upload(oldPath, {
    folder: 'items',
  });
  await fs.unlink(oldPath);
  const result = await Item.create({ ...req.body, poster });
  res.status(201).json(result);
};

const updateById = async (req: CustomRequest, res: Response): Promise<void> => {
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

const deleteById = async (req: CustomRequest, res: Response): Promise<void> => {
  const { _id: owner, subscription } = req.user;
  const { itemId } = req.params;
  if (subscription !== 'admin') throw HttpError(403);
  const result = await Item.findOneAndDelete({ _id: itemId, owner });
  if (!result) {
    throw HttpError(404);
  }
  res.status(204).send();
};

const controllers = {
  getAll: ctrlWrapper(getAll),
  getById: ctrlWrapper(getById),
  add: ctrlWrapper(add),
  updateById: ctrlWrapper(updateById),
  deleteById: ctrlWrapper(deleteById),
};

export default controllers;
