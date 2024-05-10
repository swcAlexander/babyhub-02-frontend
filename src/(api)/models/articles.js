import { model, Schema } from 'mongoose';
import Joi from 'joi';

const artiicleSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    subscription: {
      type: String,
      required: true,
    },
  },
  { versionKey: false, timestamps: true }
);

const Article = model('article', artiicleSchema);
export default Article;

export const articleSchma = new Joi.object({
  title: Joi.string().required().messages({
    'any.required': `"title" must bi exsist`,
  }),
  body: Joi.string().required().messages({
    'any.required': `"price" must bi exsist`,
  }),
  subscription: Joi.string(),
});
