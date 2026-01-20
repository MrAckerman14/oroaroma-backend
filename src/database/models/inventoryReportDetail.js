import { DataTypes } from 'sequelize'

export default (sequelize) => {
  const InventoryReportDetail = sequelize.define('InventoryReportDetail', {
    inventory_report_id: { type: DataTypes.INTEGER, allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    product_name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.DECIMAL(18,2), allowNull: false },
    stock: { type: DataTypes.INTEGER, allowNull: false },
    inventory_value:  { type: DataTypes.DECIMAL(18,2), allowNull: false }
  }, {
    tableName: 'inventory_report_details'
  })

  InventoryReportDetail.associate = models => {
    InventoryReportDetail.belongsTo(models.InventoryReport, {
      as: 'report',
      foreignKey: 'inventory_report_id'
    })
  }

  return InventoryReportDetail
}
