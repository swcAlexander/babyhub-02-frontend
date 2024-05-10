import { model, Schema } from 'mongoose';

const itemSchema = new Schema(
  {
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
    specifications: [],
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'user',
    },
  },
  { versionKey: false, timestamps: true }
);

const Item = model('item', itemSchema);
export default Item;
