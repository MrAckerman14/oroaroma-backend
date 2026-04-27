import db from '@/database';
import { Op } from "sequelize";

export const addSale = async (req, res) => {
  const transaction = await db.sequelize.transaction()

  try {
    const {
      messenger_id,
      seller_id,
      amount,
      description,
      delivery_pay,
      detail,
      count_perfume,
      phone, 
      amount_cash,
      amount_transfer
    } = req.body


    if (!detail || !detail.length) {
      await transaction.rollback()
      return res.status(400).json({ data: 'La venta no tiene perfumes' })
    }

    if(Number(amount) < (Number(amount_cash) + Number(amount_transfer) )) return res.status(400).json({ data: "El total ingresado en efectivo y transferencia supera el monto total de la venta."})

    // Crear venta
    const sale = await db.models.sale.create({
      employee_id: req.user.id,
      messenger_id: messenger_id?.value || null,
      seller_id: seller_id?.value || null,
      amount,
      amount_cash,
      amount_transfer,
      phone: phone,
      description,
      delivery_pay,
      state: 'Entrega pendiente',
      count_perfume: count_perfume 
    }, { transaction })


    for (const item of detail) {
      const store = await db.models.stores.findOne({
        where: { id: item.product_id },
        lock: transaction.LOCK.UPDATE,
        transaction
      })

      if (!store) {
        throw new Error('Producto no existe')
      }

      if (store.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${store.name}`)
      }

      await db.models.saleDetail.create({
        sale_id: sale.id,
        store_id: item.product_id,
        count: item.quantity,
        price: store.sale_price ?? 0
      }, { transaction })

    
      await store.decrement('stock', {
        by: item.quantity,
        transaction
      })
    }


    await transaction.commit()
    return res.status(201).json({ data: 'Venta agregada correctamente' })

  } catch (err) {
    await transaction.rollback()
    console.error(err)
    return res.status(500).json({
      data: 'Error al agregar venta: ' + err.message
    })
  }
}

export const getSales = async (req, res) => {
    try{
        const { from, to  } = req.query
        const where = {}
        const { id, rol } = req.user;

        if (rol !== 'Admin') {
            where.employee_id = id; 
        }

        if(from && to){
          where.createdAt = {
            [Op.between]: [from, to]
          }
        }

        db.models.sale.findAll({
            include: [{
                model: db.models.saleDetail,
                as: "details"
            },
            {
                model: db.models.user,
                as: "employee"    
            },{
                model: db.models.user,
                as: "messenger"    
            },{
                model: db.models.user,
                as: "seller"    
            },
            
        ],
        order: [['id', 'DESC']],
            where
        })
        .then(respose => {
            const data = respose.map((e)=>{
                e.employee_id = e.employee?.name || ''
                e.seller_id = e.seller?.name || ''
                e.messenger_id = e.messenger?.name || ''
              

                return e;
            })
            res.status(200).json({ data: data})
        })
        .catch(err => res.status(403).json({ data: "Error al obtener pedidos! "+err}))
        
    }catch(err){
        res.status(403).json({ data: "Error al buscar ventas, "+ err})
    }
}

export const updateSale = async (req, res, next) => {
  const transaction = await db.sequelize.transaction()

  try {
    const { state } = req.body
    const saleId = req.params.id

    const sale = await db.models.sale.findOne({
      where: { id: saleId },
      transaction
    })

    if (!sale) {
      await transaction.rollback()
      return res.status(404).json({ data: 'Venta no encontrada' })
    }

    const stateChanged = state && state !== sale.state

    // Si el estado cambia a Cancelado y venía de Entrega pendiente, restaurar stock
    if (stateChanged && state === 'Cancelado' && sale.state === 'Entrega pendiente') {
      const details = await db.models.saleDetail.findAll({
        where: { sale_id: saleId },
        transaction
      })

      for (const detail of details) {
        const store = await db.models.stores.findOne({
          where: { id: detail.store_id },
          lock: transaction.LOCK.UPDATE,
          transaction
        })

        if (store) {
          await store.increment('stock', {
            by: detail.count,
            transaction
          })
        }
      }
    }

    await db.models.sale.update(req.body, {
      where: { id: saleId },
      transaction
    })

    await transaction.commit()
    return res.status(200).json({ data: 'Venta actualizada correctamente' })

  } catch (err) {
    await transaction.rollback()
    console.error(err)
    return res.status(500).json({ data: 'Error al actualizar venta: ' + err.message })
  }
}
// export const updateSale = async (req, res, next) =>{
//     try{
//         console.log(req.body)
//         db.models.sale.update(req.body, { where: { id: req.params.id }})
//         .then(response => {

//             res.status(200).json({ data: "Actualizado" })
//         })
//         .catch(err =>  {
//             return  res.status(303).json({ data: "Error al actualizar venta"+ err })
//         })

//     }catch(err){
//         res.status(403).json({ data: "Error al editar estado "+err})
//     }
// }

export const deleteSale = async (req, res) => {
    try{
        const sale = db.models.sale.destroy({ where: {id: req.params.id} });
            if(!sale)return res.status(403).json({ data: "No se pudo eliminar" });
                return res.status(200).json({ data: "Eliminado" });
    }catch(err){
        res.status(403).json({ data: "error eliminando venta" });
    }
}

export const createClosure = async (req, res) => {
  try {
    const { from, to } = req.query;
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ data: 'Usuario no autenticado' });

    // Validar fechas mínimas
    const dateFrom = from ? new Date(from) : null;
    const dateTo = to ? new Date(to) : null;
    if (!dateFrom || isNaN(dateFrom) || !dateTo || isNaN(dateTo)) {
      return res.status(400).json({ data: 'Fechas inválidas' });
    }

    const { sale: Sale, cash_closure: CashClosure, cash_closure_detail: CashClosureDetail } = db.models;

    const closure = await db.sequelize.transaction(async (t) => {
    
      const sales = await db.models.sale.findAll({
        where: {
          createdAt: { [Op.between]: [dateFrom, dateTo] }
         
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!sales || sales.length === 0) {
        const err = new Error('No hay ventas para cerrar');
        err.statusCode = 400;
        throw err;
      }

      const totals = sales.reduce((acc, s) => {
        if(s.state !== "Finalizado")return acc;

        const amount = Number(s.amount) || 0;
        const countPerfume = Number(s.count_perfume) || 0;
        const deliveryPay = Number(s.delivery_pay) || 0;
        const amount_cash = Number(s.amount_cash) || 0;
        const amount_transfer = Number(s.amount_transfer) || 0;

        acc.total_sale += amount;
        acc.total_perfumes += countPerfume;
        acc.total_messenger_cost += deliveryPay;
        acc.total_cash += amount_cash;
        acc.total_trans += amount_transfer;
        
        return acc;
      }, { total_cash: 0, total_trans: 0, total_sale: 0, total_perfumes: 0, total_messenger_cost: 0 });

      const net_total = totals.total_cash - totals.total_messenger_cost;

      const closure = await CashClosure.create({
        // closure_code: `CJA-${Date.now()}`,
        createdBy: userId,
        from_date: dateFrom,
        to_date: dateTo,
        total_cash: totals.total_cash,
        total_trans: totals.total_trans,
        total_sale: totals.total_sale,
        total_messenger_cost: totals.total_messenger_cost,
        net_total,
        total_perfumes: totals.total_perfumes,
        status: 'Pendiente'
      }, { transaction: t });

      const details = sales.map(s => ({
        closureId: closure.id,
        saleId: s.id
      }));
      await CashClosureDetail.bulkCreate(details, { transaction: t });


      return closure;
    });

    return res.status(201).json({ data: 'Caja cerrada', closure_id: closure.id });

  } catch (err) {
    console.error(err);
    const status = err.statusCode || 500;
    return res.status(status).json({ data: err.message || 'Error creando cierre' });
  }
};
