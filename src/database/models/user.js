import { compare, hash } from 'bcrypt';
import { DataTypes, Model } from 'sequelize';

import { tokenHelper, mailHelper } from '@/helpers';

export default function (sequelize) {
  class User extends Model {
    // get fullName() {
    //   return `${this.name} ${this.lastName}`;
    // }

    generateToken(expiresIn = '1h') {
      const data = { id: this.id, email: this.email };
      return tokenHelper.generateToken(data, expiresIn);
    }

    validatePassword(plainPassword) {
      return compare(plainPassword, this.password);
    }

    async changePassword(plainPassword){
      return  await hash(plainPassword, 10);
    }

    sendMail(mail) {
      const payload = { ...mail, to: `${this.fullName} <${this.email}>` };
      return mailHelper.sendMail(payload);
    }

    static associate(models) {
        // Ventas como vendedor
      User.hasMany(models.sale, {
        as: 'seller',
        foreignKey: 'seller_id'
      })

      // Ventas como mensajero
      User.hasMany(models.sale, {
        as: 'messenger',
        foreignKey: 'messenger_id'
      })

      // Ventas como empleado
      User.hasMany(models.sale, {
        as: 'employee',
        foreignKey: 'employee_id'
      })
      // User.hasMany(models.tweet, { foreignKey: 'userId' });
    }
  }

  User.init({
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    count_delivery: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    money_delivery: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    average: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    amount_pending: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    count_perfum: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    cash_delivery: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    cash_perfume: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    cash_net: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    rol: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  }, {
    modelName: 'user',
    sequelize,
  });

  User.addHook('beforeSave', async (instance) => {
    if (instance.changed('password')) {
      // eslint-disable-next-line no-param-reassign
      instance.password = await hash(instance.password, 10);
        // console.log("nueva pas222222: ", instance)
    }
  });

  // User.addHook('beforeUpdate', async (instance) => {
  //   if (instance.changed('password')) {
  //     // eslint-disable-next-line no-param-reassign
  //     instance.password = await hash(instance.password, 10);

  //     console.log("nueva pas: ", instance)
  //   }
  // });


  // User.addHook('afterCreate', (instance) => {
  //   // Send welcome message to user.
  //   const payload = {
  //     subject: 'Welcome to Express Starter',
  //     html: 'Your account is created successfully!',
  //   };
  //   instance.sendMail(payload);
  // });

  // User.addHook('afterDestroy', (instance) => {
  //   // Send good by message to user.
  //   const payload = {
  //     subject: 'Sorry to see you go',
  //     html: 'Your account is destroyed successfully!',
  //   };
  //   instance.sendMail(payload);
  // });

  return User;
}
