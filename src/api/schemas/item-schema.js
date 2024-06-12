import Joi from 'joi';

const itemSchma = new Joi.object({
  title: Joi.string().required().messages({
    'any.required': `"title" must bi exsist`,
  }),
  price: Joi.string().required().messages({
    'any.required': `"price" must bi exsist`,
  }),
  poster: Joi.string(),
  kind: Joi.string().required().messages({
    'any.required': `"kind" must bi exsist`,
  }),
  availability: Joi.boolean(),
  specifications: Joi.array(),
});

export default itemSchma;
