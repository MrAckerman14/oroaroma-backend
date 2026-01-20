import { Router } from "express";
import { authenticationMiddleware } from "@/middleware";
import { addSale, getSales, updateSale, deleteSale, createClosure} from "@/controllers/sale";

const route = Router();

route.get('/', authenticationMiddleware, getSales);
route.post('/add', authenticationMiddleware, addSale);
route.put('/update/:id', authenticationMiddleware, updateSale);
route.delete('/delete/:id', authenticationMiddleware, deleteSale);
route.get('/create-closure', authenticationMiddleware, createClosure)

export default route;