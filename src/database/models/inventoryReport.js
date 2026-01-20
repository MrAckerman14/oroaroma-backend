import { DataTypes } from 'sequelize'

export default (sequelize) => {
  const InventoryReport = sequelize.define('InventoryReport', {
    from: { type: DataTypes.DATE, allowNull: false },
    to: { type: DataTypes.DATE, allowNull: false },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    total_products: { type: DataTypes.INTEGER, allowNull: false },
    total_inventory_value: { type: DataTypes.DECIMAL(18,2), allowNull: false }
  }, {
    tableName: 'inventory_reports'
  })

  InventoryReport.associate = models => {
    InventoryReport.hasMany(models.InventoryReportDetail, {
      as: 'details',
      foreignKey: 'inventory_report_id'
    })
  }

  return InventoryReport
}

