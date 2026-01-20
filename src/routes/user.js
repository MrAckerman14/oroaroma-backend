import { Router } from "express";
import { authenticationMiddleware  } from "@/middleware";
import { getUsers, deleteUser, updateUser, getDataUser, createAdminUser } from "@/controllers/user";

const route = Router();

route.get('/', authenticationMiddleware, getDataUser);
route.delete('/delete/:id', authenticationMiddleware, deleteUser);
route.put('/update/:id', authenticationMiddleware, updateUser);
route.get('/create-admin', createAdminUser);

export default route;