import itemSchema from '../../schemas/item-schema.js';

import { validateBody } from '../../decorators/index.js';

const addItemValidate = validateBody(itemSchema.itemAddSchema);
const putItemValidate = validateBody(itemSchema.itemPutSchema);
const patchItemValidate = validateBody(itemSchema.updateFavoriteSchema);

export default {
  addItemValidate,
  putItemValidate,
  patchItemValidate,
};
