import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import path from 'path';
import gravatar from 'gravatar';
import Jimp from 'jimp';
import 'dotenv/config';

import { sendMail, HttpError } from '../helpers/index.js';
import User from '../models/users.js';
import { ctrlWrapper } from '../decorators/index.js';

const posterPath = path.resolve('public', 'avatars');

const { JWT_SECRET } = process.env;

const signUp = async (req, res) => {
  const { email, password } = req.body;
  const avatarURL = gravatar.url(email, { size: 400 });
  const verificationToken = nanoid();

  if (req.file) {
    const { path: oldPath, filename } = req.file;
    const newPath = path.join(posterPath, filename);
    await fs.rename(oldPath, newPath);
    const poster = path.join('avatars', filename);
    const user = await User.findOne({ email });
    if (user) {
      throw HttpError(409, 'Email in use');
    }
    const hashPassword = await bcrypt.hash(password, 10);

    await sendMail(email, verificationToken);

    const newUser = await User.create({
      ...req.body,
      poster,
      password: hashPassword,
      verificationToken,
    });
    return res.status(201).json({
      username: newUser.username,
      email: newUser.email,
      avatarURL: newPath,
      subscription: 'starter',
    });
  }
  const user = await User.findOne({ email });
  if (user) {
    throw HttpError(409, 'Email in use');
  }
  const hashPassword = await bcrypt.hash(password, 10);
  await sendMail(email, verificationToken);
  

  const newUser = await User.create({
    ...req.body,
    avatarURL,
    password: hashPassword,
    verificationToken,
  });
  
  res.status(201).json({
    username: newUser.username,
    email: newUser.email,
    avatarURL: avatarURL,
    subscription: 'starter',
  });
};
const signIn = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError(401, 'Email is wrong');
  }
  const passwordCompare = await bcrypt.compare(password, user.password);
  if (!passwordCompare) {
    throw HttpError(401, 'Email or password is wrong');
  }
  if (!user.verify) {
    throw HttpError(401, 'Email not verify');
  }
  const { _id: id } = user;
  const payload = {
    id,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
  await User.findByIdAndUpdate(id, { token });
  res.json({
    token,
    user: {
      email,
      subscription: 'starter',
    },
  });
};

const getCurrent = (req, res) => {
  const { name, email } = req.user;
  res.json({
    name,
    email,
  });
};
const verify = async (req, res) => {
  const { verificationToken } = req.params;
  const user = await User.findOne({ verificationToken });
  if (!user) {
    throw HttpError(404, 'User not found');
  }
  await User.findByIdAndUpdate(user._id, {
    verify: true,
    verificationToken: null,
  });
  res.json({
    message: 'Verification successful',
  });
};

const resendVerifyEmail = async (req, res) => {
  const { email } = req.body;
  const user = User.findOne({ email });
  if (!user) {
    throw HttpError(404, 'Email not found');
  }
  if (user.verify) {
    throw HttpError(400, 'Email already verify');
  }
  res.json({
    message: 'Verification successful',
  });
  await sendMail(email, user.verificationToken);
};

const signout = async (req, res) => {
  const { _id } = req.user;
  await User.findByIdAndUpdate(_id, { token: '' });
  res.json({
    message: 'Signout is success',
  });
};

const updateAvatar = async (req, res) => {
  const { _id } = req.user;
  const { path: oldPath, originalname } = req.file;
  const img = await Jimp.read(oldPath);
  await img
    .autocrop()
    .cover(250, 250, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE)
    .writeAsync(oldPath);

  const filename = `${Date.now()}-${originalname}`;
  const newPath = path.join(avatarDir, filename);
  await fs.rename(oldPath, newPath);
  const avatarURL = path.join('avatars', filename);
  await User.findByIdAndUpdate(_id, { avatarURL });
  res.status(200).json({ avatarURL });
};

const getAll = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;
  const result = await User.find({}, '-createdAt -updatedAt', {
    skip,
    limit,
  });
  res.json(result);
};

const getById = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { itemId } = req.params;
  const result = await User.findOne({ _id: itemId });
  if (!result) {
    throw HttpError(404);
  }
  res.json(result);
};

const updateById = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { itemId } = req.params;
  const result = await Item.findOneAndUpdate({ _id: itemId }, req.body, {
    new: true,
  });
  res.status(201).json(result);
};

const deleteById = async (req, res) => {
  const { subscription } = req.user;
  if (subscription !== 'admin') throw HttpError(403);
  const { itemId } = req.params;
  const result = await Item.findOneAndDelete({ _id: itemId });
  if (!result) {
    throw HttpError(404);
  }
  res.status(204).send();
};

export default {
  signUp: ctrlWrapper(signUp),
  signIn: ctrlWrapper(signIn),
  getCurrent: ctrlWrapper(getCurrent),
  signout: ctrlWrapper(signout),
  updateAvatar: ctrlWrapper(updateAvatar),
  verify: ctrlWrapper(verify),
  resendVerifyEmail: ctrlWrapper(resendVerifyEmail),
  getAll: ctrlWrapper(getAll),
  getById: ctrlWrapper(getById),
  updateById: ctrlWrapper(updateById),
  deleteById: ctrlWrapper(deleteById),
};
