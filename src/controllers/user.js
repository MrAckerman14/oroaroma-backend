import db from '@/database';
import { Op } from "sequelize";
import dayjs from "dayjs";
import { compare, hash } from 'bcrypt';

export const getDataUser = async (req, res, next) =>{
const Dfrom = dayjs().startOf("month").toDate();
const days = dayjs().diff(Dfrom, "day") + 1;
    try{
        const { from, to } = req.query;
        const where = {}

       if(from && to){
        where.createdAt = {
            [Op.between]: [from, to],
        };
       }

    const messengers = await db.models.user.findAll({
        where: { rol: 'Mensajero' },
        include: [{
            model: db.models.sale,
            as: 'messenger',
            attributes: [],
            where,
            required: false
        }],
        attributes: [
            'id','name', 'email', 'rol','status',

            // [db.sequelize.fn('COUNT', db.sequelize.col('messenger.id')), 'count_delivery'],
        //    [db.sequelize.literal(
        //         `COUNT(CASE WHEN "messenger"."state" = 'Finalizado' THEN COALESCE("messenger"."id", 0) ELSE 0 END)`
        //     ), 'count_delivery'],

            [db.sequelize.literal(`
                SUM(
                    CASE 
                        WHEN "messenger"."state" = 'Finalizado' 
                        THEN 1 
                        ELSE 0 
                    END
                )
            `), 'count_delivery'],
            // [db.sequelize.fn('SUM', db.sequelize.col('messenger.delivery_pay')), 'money_delivery'],
            [
            db.sequelize.literal(`
                SUM(
                CASE 
                    WHEN "messenger"."state" = 'Entrega pendiente'
                    AND "messenger"."type_pay" = 1
                    THEN COALESCE("messenger"."amount", 0)
                    ELSE 0
                END
                )
            `),
            'money_pending'
            ],

            [db.sequelize.literal(
                `SUM(CASE WHEN "messenger"."state" = 'Finalizado' THEN COALESCE("messenger"."delivery_pay", 0) ELSE 0 END)`
            ), 'delivery_pay']
        ],
        group: ['user.id']
    });

    const sellers = await db.models.user.findAll({
        where: { rol: 'Vendedor' },
        include: [{
            model: db.models.sale,
            as: 'seller',
            attributes: [],
            where,
            required: false
        }],
        attributes: [
            'id','name', 'email', 'rol','status',
            // [db.sequelize.fn('COUNT', db.sequelize.col('seller.id')), 'count_delivery'],
            // [db.sequelize.fn('SUM', db.sequelize.col('seller.count_perfume')), 'count_perfum'],
            // [db.sequelize.fn('SUM', db.sequelize.col('seller.delivery_pay')), 'money_delivery'],
            // [db.sequelize.fn('SUM', db.sequelize.col('seller.amount')), 'cash_perfume'],

            // [
            // db.sequelize.literal(``),
            // 'cash_net'
            // ],

            [db.sequelize.literal(
                `SUM(CASE WHEN "seller"."state" = 'Finalizado' THEN COALESCE("seller"."count_perfume", 0) ELSE 0 END)`
            ), 'count_perfum'],
            [db.sequelize.literal(
                `COUNT(CASE WHEN "seller"."state" = 'Finalizado' THEN COALESCE("seller"."id", 0) ELSE 0 END)`
            ), 'count_delivery'],
            [db.sequelize.literal(
                `SUM(CASE WHEN "seller"."state" = 'Finalizado' THEN COALESCE("seller"."delivery_pay", 0) ELSE 0 END)`
            ), 'money_delivery'],
            [db.sequelize.literal(
                `SUM(CASE WHEN "seller"."state" = 'Finalizado' THEN COALESCE("seller"."amount", 0) ELSE 0 END)`
            ), 'cash_perfume'],
            // [db.sequelize.literal(
            //     `SUM(CASE WHEN "seller"."state" = 'Finalizado' THEN COALESCE(SUM(seller.amount),0) - COALESCE(SUM(seller.delivery_pay),0) ELSE 0 END)`
            // ), 'cash_net']
            [
                db.sequelize.literal(`
                    SUM(
                    CASE 
                        WHEN "seller"."state" = 'Finalizado'
                        THEN COALESCE("seller"."amount", 0)
                        - COALESCE("seller"."delivery_pay", 0)
                        ELSE 0
                    END
                    )
                `),
                'cash_net'
                ]

        ],
        group: ['user.id']
    });

    const employees = await db.models.user.findAll({
        where: { rol: 'Empleado' },
        include: [{
            model: db.models.sale,
            as: 'employee',
            attributes: [],
             where: {
                ...where,           
                seller_id: null,
                state: 'Finalizado'   
            },
            required: false
        }],
        attributes: [
            'id','name', 'email', 'rol','status',
            [db.sequelize.fn('COUNT', db.sequelize.col('employee.id')), 'count_delivery'],
            [db.sequelize.fn('SUM', db.sequelize.col('employee.delivery_pay')), 'money_delivery'],
            [db.sequelize.fn('SUM', db.sequelize.col('employee.amount')), 'cash_net'],
             [db.sequelize.fn('SUM', db.sequelize.col('employee.count_perfume')), 'count_perfum'],

            [
            db.sequelize.literal(`COALESCE(SUM(employee.amount),0)/${days}`),
            'average'
            ]
        ],
        group: ['user.id']
    });

     const admins = await db.models.user.findAll({
        where: { rol: 'Admin' }   
    });


        var data = [...messengers, ...employees, ...sellers, ...admins]

        return res.status(200).json({ data: data});
    }catch(err){
        res.status(303).json({ data: "Error buscando usuarios, "+ err })
    }
}

export const deleteUser = async (req, res) => {
    try{
        const user = db.models.user.destroy({ where: {id: req.params.id} });
            if(!user)return res.status(403).json({ data: "No se pudo eliminar" });
                return res.status(200).json({ data: "Eliminado" });
    }catch(err){
        res.status(403).json({ data: "error eliminando usuario" });
    }
}

export const updateUser = async (req, res) => {
    // res.status(200).json({ data: req.body })
    // console.log("entra")
    try{
        // const users = db.models.user.findOne({ where: { id: req.params.od}})

        if(req.body.password){
            req.body.password =  await hash(req.body.password, 10);
        }

        const user = db.models.user.update(req.body, { where: { id: req.params.id}});
        if(!user)return res.status(403).json({  data: "Error al editar usuario"});
            return res.status(200).json({ data: "Actualizado!"});
    }catch(err){
         res.status(403).json({ data: "error editando usuario" });
    }
}

export const createAdminUser = (req, res) =>{
    try{
// fields: ['name', 'email', 'password', 'rol', 'state'],
        db.models.user.create({
            name: 'admin',
            email: 'admin@admin.com',
            password: '123456',
            rol: 'Admin',
            state: 'Activo'
        })
        .then(response => { 
            res.status(201).json({ data: response})
        })
        .catch(err => {
            res.status(303).json({ data: "Error creando usuario " + err})
        })
     }catch(err){
         res.status(403).json({ data: "error creado usuario "+err });
    }
}