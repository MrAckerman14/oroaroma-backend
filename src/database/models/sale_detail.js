import { DataTypes, Model } from 'sequelize';

export default function (sequelize) {
  class SaleDetail extends Model {
    static associate(models) {
      SaleDetail.belongsTo(models.sale, {
        as: 'sale',
        foreignKey: 'sale_id',
      });

      SaleDetail.belongsTo(models.stores, {
        as: 'product',
        foreignKey: 'store_id',
      });
    }
  }

  SaleDetail.init(
    {
      count: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      price: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: 'saleDetail',
      tableName: 'sale_details',
      timestamps: true,
    }
  );

  return SaleDetail;
}
