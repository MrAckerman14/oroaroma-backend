import { DataTypes, Model } from 'sequelize';

export default function (sequelize) {
  class Sale extends Model {
    static associate(models) {
      // Relaciones con la tabla users
    Sale.belongsTo(models.user, {
        as: 'employee',
        foreignKey: 'employee_id',
    });

    Sale.belongsTo(models.user, {
        as: 'messenger',
        foreignKey: 'messenger_id',
    });

    Sale.belongsTo(models.user, {
        as: 'seller',
        foreignKey: 'seller_id',
    });

    Sale.hasMany(models.saleDetail, {
         as: 'details',
         foreignKey: 'sale_id',
    });
    }
  }

  Sale.init(
    {
      amount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      type_pay: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      count_perfume: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      delivery_pay: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      messenger_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
       state: {
        type: DataTypes.STRING,
        allowNull: true
      },
      seller_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      }
    },
    {
      sequelize,
      modelName: 'sale',
      tableName: 'sales',
      timestamps: true,
    }
  );

  return Sale;
}
