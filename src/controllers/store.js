import db from "@/database";

export const add = async (req, res) => {
    try{
        if (req.file) {
            req.body.image_path = '/uploads/img/' + req.file.filename
        }
        const product = await db.models.stores.create(req.body);
        if(!product)return res.status(403).json({ data: "Error al agregar"});
            return res.status(201).json({ data: "Agregado!"});
    }catch(err){
        res.status(403).json({
            data: "Error al agregar el producto! "+ err
        })
    }
}

export const update = async (req, res) => {
    try{
        if (req.file) {
            req.body.image_path = '/uploads/img/' + req.file.filename
        }
        
        const update = await db.models.stores.update(req.body, { 
            where: { 
                id: req.params.id
            }
        })
        if(!update)return res.status(403).json({ data: "Error al actualiar" });
            return res.status(200).json({ data: "Actualiado!"})
    }catch(err){
        res.status(403).json({ data: "Error al actualizar el producto!"});
    }
}

export const deleteProduct = async (req, res) => {
    try{
        const deleteProduct = await db.models.stores.destroy({ where: {id: req.params.id} });
        if(!deleteProduct)return res.status(402).json({ data: "Error al eliminar" });
            return res.status(200).json({ data: "Eliminado!"})
    }catch(err){
         res.status(403).json({ data: "Error al eliminar el producto! "+ err});
    }
}

export const get = async (req, res) => {
    try{ 
        const products = await db.models.stores.findAll();
          if(!products)return res.status(403).json({ data: "Error al listar los productos" });
            return res.status(200).json({ data: products})
    }catch(err){
        res.status(403).json({ data: "Error al obtener el producto! " +err});
    }
}