export const up = (queryInterface, Sequelize) => queryInterface.createTable('users', {
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: Sequelize.INTEGER,
  },
  name: {
    allowNull: false,
    type: Sequelize.STRING,
  },

  count_delivery: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   money_delivery: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   average: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   amount_pending: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   status: {
    allowNull: true,
    type: Sequelize.STRING,
  },

   count_perfum: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   cash_delivery: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   cash_perfume: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   cash_net: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   cashrol_net: {
    allowNull: true,
    type: Sequelize.INTEGER,
  },

   rol: {
    allowNull: true,
    type: Sequelize.STRING,
  },
  
  email: {
    allowNull: true,
    type: Sequelize.STRING(50),
  },
  password: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  createdAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
  updatedAt: {
    allowNull: false,
    type: Sequelize.DATE,
  },
  deletedAt: {
    allowNull: true,
    type: Sequelize.DATE,
  }
});

export const down = (queryInterface) => queryInterface.dropTable('users');
