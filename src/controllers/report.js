import db from "@/database"
import { Op } from "sequelize";


export const report_cash_reconciliation = async (req, res) => {
    try{ 
        const { from, to } =  req.query

        const cash = await db.models.sale.sum('amount',{
             where: { 
                createdAt: { [Op.between]: [from, to] },
                type_pay: 1, //efectivo,
                state: "Finalizado"
            }
        });

        const trans = await db.models.sale.sum('amount',{
             where: { 
                createdAt: { [Op.between]: [from, to] },
                type_pay: 2, //transferencia
                state: "Finalizado"
            }
        });

        const cash_messengers = await db.models.sale.sum('delivery_pay',{
             where: { 
                createdAt: { [Op.between]: [from, to] },
                state: "Finalizado"
            }
        });

        const sellerTotals = await db.models.sale.findAll({
          attributes: [
            'seller_id',
            [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'],

            [
              db.sequelize.literal('SUM("sale"."count_perfume")'), 
              'perfumes_sold'
            ],

            [
              db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('sale.id'))), 
              'orders_count'
            ], //

            [
              db.sequelize.literal(`
                COUNT(CASE WHEN "sale"."messenger_id" IS NOT NULL THEN "sale"."id" ELSE NULL END)
              `),
              'deliveries'
            ],

            [
              db.sequelize.literal(`
                SUM("sale"."delivery_pay") FILTER (WHERE "sale"."messenger_id" IS NOT NULL)
              `),
              'messenger_cost'
            ],

            [
              db.sequelize.fn(
                'SUM',
                db.sequelize.literal(`"details"."count" * "details->product"."sale_price"`)
              ),
              'perfume_cost'
            ]
          ],
          where: {
            createdAt: { [Op.between]: [from, to] },
            seller_id: { [Op.not]: null },
            state: "Finalizado"
          },
          include: [
            {
              model: db.models.user,
              as: 'seller',
              attributes: ['name'] 
            },
            {
              model: db.models.saleDetail,
              as: 'details',
              attributes: [],
              include: [{
                model: db.models.stores,
                as: 'product',
                attributes: []
              }]
            }
          ],
          group: ['seller_id', 'seller.id', 'seller.name'],
          raw: true
        });

        const messengerTotals = await db.models.sale.findAll({
            attributes: [
                'messenger_id',
                // [db.sequelize.fn('SUM', db.sequelize.col('delivery_pay')), 'total'],
                 [db.sequelize.literal(`
                    COUNT(
                        CASE 
                            WHEN "state" IN ('Finalizado', 'Cancelado') 
                            THEN "sale"."id" 
                            ELSE NULL 
                        END
                    )
                `), 'count_delivery'],
                [
                db.sequelize.literal(`
                    SUM(
                    CASE 
                        WHEN "state" = 'Entrega pendiente'
                        AND "type_pay" = 1
                        THEN COALESCE("amount", 0)
                        ELSE 0
                    END
                    )
                `),
                'money_pending'
                ],
                
                [db.sequelize.literal(`
                    SUM(
                        CASE 
                            WHEN "state" IN ('Finalizado', 'Cancelado') 
                            THEN COALESCE("delivery_pay", 0)
                            ELSE 0
                        END
                    )
                `), 'earned']
            ],
            where: {
                createdAt: { [Op.between]: [from, to] },
                state: "Finalizado"
            },
            include: [{
                model: db.models.user,
                as: 'messenger',
                attributes: ['id', 'name']
            }],
            group: ['messenger_id', 'messenger.id']
            });

            const totalGeneral = await db.models.sale.sum('amount', {
            where: {
                createdAt: { [Op.between]: [from, to] },
                state: "Finalizado"
            }
            });

        const employeeTotals = await db.models.sale.findAll({
            attributes: [
                'employee_id',

                [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total'],
                [db.sequelize.literal(`
                    SUM(
                        CASE 
                            WHEN type_pay = 1 THEN amount 
                            ELSE 0 
                        END
                    )
                `), 'cash_total'],
                [db.sequelize.literal(`
                    SUM(
                        CASE 
                            WHEN type_pay = 2 THEN amount 
                            ELSE 0 
                        END
                    )
                `), 'transfer_total'],
                [db.sequelize.fn('SUM', db.sequelize.col('delivery_pay')), 'messenger_cost'],
                [db.sequelize.fn('COUNT', db.sequelize.col('sale.id')), 'orders_count'],
                [db.sequelize.fn('SUM', db.sequelize.col('count_perfume')), 'perfumes_sold']
                
            ],
            where: {
                createdAt: { [Op.between]: [from, to] },
                 state: "Finalizado"
            },
            include: [{
                model: db.models.user,
                as: 'employee',
                attributes: ['id', 'name', 'rol']
            }],
            group: ['employee_id', 'employee.id']
            });

            return res.status(200).json({ data: {
                total_sale: totalGeneral,
                total_cash: cash,
                total_trans: trans,
                total_cash_messenger: cash_messengers,
                detail_messenger: messengerTotals,
                detail_seller: sellerTotals,
                detail_employee: employeeTotals,
                neto_total: (cash - cash_messengers)
            }})
    }catch(err){
        res.status(403).json({ data: "Error al obtener el producto! " +err});
    }
}


export const reportClosure = async (req, res) => {
  try {
    const { from, to } = req.query

    const where = {}

    if (from && to) {
      where.createdAt = { [Op.between]: [from, to] }
    }

    const closures = await db.models.cash_closure.findAll({
      include: [{
        model: db.models.user,
        as: 'creator',
        attributes: ['id', 'name']
      }],
     where,
    order: [['id','DESC']]
    })

    return res.json({ data: closures })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}


export const getClosureDetails = async (req, res) => {
  try {
    const closureId = Number(req.params.id)

    const closure = await db.models.cash_closure.findByPk(closureId)
    if (!closure) return res.status(404).json({ error: 'Cierre no encontrado' })

    // Ventas del cierre
    const saleIds = await db.models.cash_closure_detail.findAll({
      where: { closureId },
      attributes: ['saleId'],
      raw: true
    })

    const ids = saleIds.map(s => s.saleId)

    if (!ids.length) return res.json({ closure, sales: [] })

    const where = { id: { [Op.in]: ids } }

    // Totales
    const totals = await db.models.sale.findOne({
      attributes: [
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'total_sale'],
        [db.sequelize.fn('SUM', db.sequelize.literal(`CASE WHEN type_pay = 1 THEN amount ELSE 0 END`)), 'total_cash'],
        [db.sequelize.fn('SUM', db.sequelize.literal(`CASE WHEN type_pay = 2 THEN amount ELSE 0 END`)), 'total_trans'],
        [db.sequelize.fn('SUM', db.sequelize.col('delivery_pay')), 'total_messenger_cost'],
        [db.sequelize.fn('SUM', db.sequelize.col('count_perfume')), 'total_perfumes']
      ],
      where,
      raw: true
    })

    const net_total = Number(totals.total_cash || 0) - Number(totals.total_messenger_cost || 0)

    // Mensajeros
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
                    [db.sequelize.literal(`
                    COUNT(
                        CASE 
                            WHEN "messenger"."state" IN ('Finalizado', 'Cancelado') 
                            THEN "messenger"."id" 
                            ELSE NULL 
                        END
                    )
                `), 'deliveries'],
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
                
                [db.sequelize.literal(`
                    SUM(
                        CASE 
                            WHEN "messenger"."state" = 'Entrega pendiente' 
                            THEN COALESCE("messenger"."delivery_pay", 0)
                            ELSE 0
                        END
                    )
                `), 'earned']
            ],
            group: ['user.id']
        });
    
    // Vendedores
   const sellers = await db.models.sale.findAll({
    attributes: [
      'seller_id',
      [
        db.sequelize.literal('SUM("sale"."amount")'), 
        'sold'
      ],

      [
        db.sequelize.literal('SUM("sale"."count_perfume")'), 
        'perfumes'
      ],

      [
        db.sequelize.fn('COUNT', db.sequelize.fn('DISTINCT', db.sequelize.col('sale.id'))), 
        'orders'
      ],

      [
        db.sequelize.literal(`
          COUNT(CASE WHEN "sale"."messenger_id" IS NOT NULL THEN "sale"."id" ELSE NULL END)
        `),
        'deliveries'
      ],

      [
        db.sequelize.literal(`
          SUM("sale"."delivery_pay") FILTER (WHERE "sale"."messenger_id" IS NOT NULL)
        `),
        'delivery_cost'
      ],

      [
        db.sequelize.fn(
          'SUM',
          db.sequelize.literal(`"details"."count" * "details->product"."sale_price"`)
        ),
        'perfume_cost'
      ]
    ],
    where: {
      ...where,
      seller_id: { [Op.not]: null },
      state: "Finalizado"
    },
    include: [
      {
        model: db.models.user,
        as: 'seller',
        attributes: ['name'] 
      },
      {
        model: db.models.saleDetail,
        as: 'details',
        attributes: [],
        include: [{
          model: db.models.stores,
          as: 'product',
          attributes: []
        }]
      }
    ],
    group: ['seller_id', 'seller.id', 'seller.name'],
    raw: true
  });

//     const sellersWithPending = sellers.map(s => {
//   const sold = Number(s.sold || 0)
//   const perfumeCost = Number(s.perfume_cost || 0)

//   return {
//     ...s,
//     pending_payment: sold - perfumeCost
//   }
// })

    // Empleados
    const employees = await db.models.sale.findAll({
      attributes: [
        'employee_id',
        [db.sequelize.fn('SUM', db.sequelize.col('amount')), 'sold'],
        [db.sequelize.fn('COUNT', db.sequelize.col('sale.id')), 'orders'],
         [db.sequelize.literal(`
          SUM(
              CASE 
                  WHEN type_pay = 1 THEN amount 
                  ELSE 0 
              END
          )`), 'cash'],
        [db.sequelize.literal(`
            SUM(
                CASE 
                    WHEN type_pay = 2 THEN amount 
                    ELSE 0 
                END
            )
        `), 'transfer_total'],
         [db.sequelize.fn('SUM', db.sequelize.col('delivery_pay')), 'money_delivery'],
      ],
      where: {
        ...where,
        state: "Finalizado"
      },
      include: [{
        model: db.models.user,
        as: 'employee',
        attributes: ['id', 'name']
      }],
      group: ['employee_id', 'employee.id'],
      raw: true
    })

    // Ventas detalladas
    const sales = await db.models.sale.findAll({
      where,
      include: [
        { model: db.models.user, as: 'employee', attributes: ['id', 'name'] },
        { model: db.models.user, as: 'messenger', attributes: ['id', 'name'] },
        { model: db.models.user, as: 'seller', attributes: ['id', 'name'] }
      ],
      order: [['createdAt', 'ASC']]
    })


    return res.json({
      closure,
      totals: { ...totals, net_total },
      messengers,
      sellers: sellers,
      employees,
      sales
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}

export const updateClosureStatus = async (req, res) => {
  const update = await db.models.cash_closure.update(req.body, { where: { id: req.params.id }})
  .then(response => res.status(200).json({ data: "Actualizado"}))
  .catch(err => {
    res.status(400).json({ data: "Error al actualizar "+ err})
    console.log(err)
  })
}

async function getDataInventoryReport(from, to){
   try {
    const products = await db.models.stores.findAll({
      attributes: [
        'id',
        'name',
        'stock',
        'purchase_price',
        [
          db.sequelize.literal(`stock * purchase_price`),
          'inventory_value'
        ]
      ],
      where: {
        deletedAt: null,
        //  createdAt: { [Op.between]: [from, to] },
      },
      raw: true
    })

    
    const totals = products.reduce(
      (acc, p) => {
        acc.total_products += Number(p.stock || 0)
        acc.total_inventory_value += Number(p.inventory_value || 0)
        return acc
      },
      { total_products: 0, total_inventory_value: 0 }
    )

    return {
      products,
      totals
    }
  } catch (err) {
    console.error(err)
  }
}

export const getGeneralInventoryReport = async (req, res) => {
  const { from, to } = req.query
  getDataInventoryReport(from, to)
  .then(response => { 
    res.status(200).json({  data: {
      products: response.products,
      totals: response.totals
    }})
  })
  .catch(err => res.status(403).json({ data: "Error al obtener ", err}))

}


export const saveInventoryReport = async (req, res) => {
  const t = await db.sequelize.transaction()

  try {
    const { from, to } = req.query
    const createdBy = req.user.id

    const { products, totals } = await getDataInventoryReport(from, to)

    // 2️⃣ Crear reporte (cabecera)
    const report = await db.models.InventoryReport.create({
      from,
      to,
      created_by: createdBy,
      total_products: totals.total_products,
      total_inventory_value: totals.total_inventory_value
    }, { transaction: t })

    // 3️⃣ Crear detalles
    const details = products.map(p => ({
      inventory_report_id: report.id,
      product_id: p.id,
      product_name: p.name,
      price: p.purchase_price,
      stock: p.stock,
      inventory_value: p.inventory_value
    }))

    await db.models.InventoryReportDetail.bulkCreate(details, {
      transaction: t
    })

    await t.commit()

    res.status(201).json({
      message: 'Reporte guardado correctamente',
      report_id: report.id
    })

  } catch (err) {
    await t.rollback()
    console.error(err)
    res.status(500).json({ error: err.message })
  }
}


export const getInventoryReports = async (req, res) => {
  const { from, to } = req.query

  const where = {}

  if (from && to) {
    where.createdAt = {
      [Op.between]: [from, to]
    }
  }

  const reports = await db.models.InventoryReport.findAll({
    where,
    include: [
      {
        model: db.models.InventoryReportDetail,
        as: 'details'
      }
    ],
    order: [['createdAt', 'DESC']]
  })

  res.json(reports)
}

export const getInventoryReportById = async (req, res) => {
  const { id } = req.params

  const report = await db.models.InventoryReport.findByPk(id, {
    include: [
      {
        model: db.models.InventoryReportDetail,
        as: 'details'
      }
    ]
  })

  if (!report) {
    return res.status(404).json({ message: 'Reporte no encontrado' })
  }

  res.json(report)
}
