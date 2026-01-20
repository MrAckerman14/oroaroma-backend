import { DataTypes, Model } from 'sequelize';

export default function (sequelize) {
  class Store extends Model {
    static associate(models) {
    Store.hasMany(models.saleDetail, {
      as: 'salesDetails',
      foreignKey: 'store_id',
    });

    }
  }

  Store.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    purchase_price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    sale_price: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    stock: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    image_path: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    modelName: 'stores',
    sequelize,
  });

  return Store;
}
