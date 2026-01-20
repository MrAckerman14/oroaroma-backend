import { Router } from "express";
import { authenticationMiddleware } from "@/middleware";
import { add, update, deleteProduct, get } from "@/controllers/store";
import uploadStore from '../middleware/uploadStore.js';

const router = Router();

router.get('/', authenticationMiddleware, get);
router.post('/add', authenticationMiddleware, uploadStore.single('image'), add);
router.put('/update/:id', authenticationMiddleware,uploadStore.single('image'), update);
router.delete('/delete/:id', authenticationMiddleware, deleteProduct);

export default router;