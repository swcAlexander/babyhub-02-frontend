import { Schema, model } from 'mongoose';
import { handlleSaveError, runValidateAtupdate } from './hooks.js';

const validRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;

const userSchema = new Schema(
  {
    password: {
      type: String,
      required: [true, 'Set password for user'],
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: validRegex,
      unique: true,
    },
    subscription: {
      type: String,
      enum: ['starter', 'pro', 'business', 'admin'],
      default: 'starter',
    },
    avatar: {
      type: String,
    },
    token: {
      type: String,
    },
    verify: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
    },
  },
  { versionKey: false, timestamps: true }
);

userSchema.pre('findOneAndUpdate', runValidateAtupdate);
userSchema.post('findOneAndUpdate', handlleSaveError);
userSchema.post('save', handlleSaveError);

const User = model('user', userSchema);
export default User;
