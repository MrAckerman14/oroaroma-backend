import { DataTypes } from 'sequelize'

export default (sequelize) => {
  const CashClosureDetail = sequelize.define('cash_closure_detail', {
    closureId: { type: DataTypes.INTEGER, allowNull: false },
    saleId: { type: DataTypes.INTEGER, allowNull: false }
  })

  CashClosureDetail.associate = (models) => {
    CashClosureDetail.belongsTo(models.cash_closure, { foreignKey: 'closureId' })
    CashClosureDetail.belongsTo(models.sale, { foreignKey: 'saleId' })
  }

  return CashClosureDetail
}
