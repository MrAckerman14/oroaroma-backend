import { DataTypes } from 'sequelize'

export default (sequelize) => {
  const CashClosure = sequelize.define('cash_closure', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },


    createdBy: { type: DataTypes.INTEGER, allowNull: false },

    from_date: { type: DataTypes.DATE, allowNull: false },
    to_date: { type: DataTypes.DATE, allowNull: false },

    total_cash: { type: DataTypes.INTEGER, allowNull: false },
    total_trans: { type: DataTypes.INTEGER, allowNull: false },
    total_sale: { type: DataTypes.INTEGER, allowNull: false },
    total_messenger_cost: { type: DataTypes.INTEGER, allowNull: false },
    net_total: { type: DataTypes.INTEGER, allowNull: false },
    total_perfumes: { type: DataTypes.INTEGER, allowNull: false },

    status: { type: DataTypes.STRING, defaultValue: 'Abierto' }
  }, { paranoid: true })

  CashClosure.associate = (models) => {
    CashClosure.belongsTo(models.user, { foreignKey: 'createdBy', as: 'creator' })
    CashClosure.hasMany(models.cash_closure_detail, { foreignKey: 'closureId' })
  }

  return CashClosure
}
