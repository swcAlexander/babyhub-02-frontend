import express from 'express';
import { authenticate } from '../middleware/index.js';
import articleController from "../controllers/articleController.js";


const articleRouter = express.Router();

articleRouter.get('/', articleController.getAll);
articleRouter.get('/:articleId', articleController.getById);
articleRouter.post('/',authenticate, articleController.add);
articleRouter.patch('/:articleId',authenticate, articleController.updateById);
articleRouter.delete('/:articleId', authenticate, articleController.deleteById);

export default articleRouter;