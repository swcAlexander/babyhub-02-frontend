import mongoose, { type Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  fullName?: string;
  roles: Array<'admin' | 'editor' | 'manager'>;
  accountStatus: 'pending' | 'active' | 'disabled';
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    passwordHash: {
      type: String,
      required: true,
      trim: true,
      minlength: 60,
    },
    fullName: { type: String, trim: true },
    roles: {
      type: [String],
      enum: ['admin', 'editor', 'manager'],
      default: ['editor'],
    },
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'disabled'],
      default: 'pending',
    },
  },
  { timestamps: true, versionKey: false }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ accountStatus: 1, roles: 1 });

const User = mongoose.models.User || mongoose.model<IUser>('User', userSchema);

export default User;
