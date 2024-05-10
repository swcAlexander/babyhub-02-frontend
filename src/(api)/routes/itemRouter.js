import express from 'express';
import itemController from '../controllers/itemController.js';
import { authenticate, isValidId, upload } from '../middleware/index.js';

const itemRouter = express.Router();

itemRouter.get('/', itemController.getAll);
itemRouter.get('/', authenticate, itemController.getFavorite);
itemRouter.get('/:itemId', itemController.getById);
itemRouter.post('/', upload.single('poster'), itemController.add);
itemRouter.put('/:itemId', isValidId, authenticate, itemController.updateById);
itemRouter.patch(
  '/:itemId',
  isValidId,
  authenticate,
  itemController.updateById
);
itemRouter.delete('/:itemId', isValidId, itemController.deleteById);
export default itemRouter;
