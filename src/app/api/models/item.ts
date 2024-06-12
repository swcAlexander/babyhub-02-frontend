import mongoose, { Document, Model, Types, Schema } from 'mongoose';

interface ItemInterface extends Document {
  title: string;
  price: string;
  poster?: string;
  kind?: string;
  availability?: boolean;
  specifications?: any[];
  owner: Types.ObjectId;
}

const itemSchema = new Schema<ItemInterface>({
  title: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  poster: {
    type: String,
  },
  kind: {
    type: String,
    default: 'інше',
  },
  availability: {
    type: Boolean,
    default: true,
  },
  specifications: {
    type: [Schema.Types.Mixed],
    default: [],
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true,
  },
},
{
  versionKey: false,
  timestamps: true,
});

const Item: Model<ItemInterface> = mongoose.models.Itam || mongoose.model<ItemInterface>('Item', itemSchema);

export default Item;